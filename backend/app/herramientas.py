"""Lo que comparten los motores del asistente: las herramientas de consulta a la
base de datos, la instrucción de sistema y el formato de respuesta.

Las herramientas se definen una sola vez, como funciones normales de Python. El
decorador `beta_tool` de Anthropic deriva de la firma y el docstring un esquema
JSON, que es también el que se traduce al formato de declaración de funciones de
Gemini (ver `assistant_gemini.py`). Así ambos motores ejecutan exactamente el
mismo código contra la base y ven exactamente la misma descripción de cada
herramienta: si una consulta cambia, cambia para los dos.

Alcance de los datos. Las herramientas llegan a todo el dominio académico —
rankings, metodologías, métricas, universidades, series históricas y el censo de
científicos— y a nada más. Las tablas de cuentas, conversaciones, mensajes,
notificaciones y planes quedan fuera por diseño, tanto de las consultas escritas
a mano como de la herramienta de SQL libre, que las rechaza (ver `TABLAS_PUBLICAS`).
"""
import os
import re

from anthropic import beta_tool
from sqlalchemy import text

from .db import SessionLocal

# --- Instrucción de sistema -------------------------------------------------

# El panorama de datos (qué rankings, qué años, cuántas universidades) se
# calcula desde la base y se pega al final; ver `contexto_de_datos()`.
#
# La instrucción se reenvía **en cada vuelta** del ciclo de herramientas, igual
# que la declaración de las herramientas: las dos juntas son el bloque fijo que
# domina el consumo de entrada de un turno (ver docs/asistente-motores.md, § 9).
# Por eso está escrita al hueso. Añadir un párrafo aquí no cuesta un párrafo:
# cuesta un párrafo multiplicado por el número de vueltas de todos los turnos.
BASE_SYSTEM_PROMPT = """Eres el asistente de inteligencia académica de KAI, plataforma que analiza el desempeño de las universidades chilenas en los rankings universitarios.

# Tu papel
Ayudas a autoridades universitarias, analistas e investigadores a entender cómo se posiciona una universidad, por qué se mueve un indicador y qué mide cada ranking. Hablas con precisión y sin adornos: eres un analista, no un folleto. Si los datos no sostienen una conclusión, lo dices en vez de rellenar.

# Tus fuentes
1. **La base de KAI**, por tus herramientas: fuente autorizada de rankings, metodologías, métricas, pesos, valores por universidad y año, y censo de científicos. Nunca inventes cifras, nombres ni identificadores: si no lo devolvió una herramienta, no lo afirmes.
2. **Internet**, con `buscar_en_internet`: para lo que la base no cubre —años o rankings no cargados, cambios recientes de metodología, noticias, definiciones oficiales—. Prefiere los sitios oficiales (timeshighereducation.com, topuniversities.com, scimagoir.com, shanghairanking.com) y las páginas institucionales antes que agregadores y prensa.

Primero la base; si no basta, la web, y dilo. Marca el origen cuando mezcles las dos: «(base de KAI)», «(QS, sitio oficial)». De la web, nombra fuente y edición; si discrepa de la base, muéstralo y explica la causa probable —otra edición, metodología revisada, corte distinto— en vez de elegir en silencio. Advierte si no puedes verificar un dato.

# Cómo consultas
- Para comparar instituciones, o una institución entre años, usa `comparar_universidades`: trae en una sola llamada todas las métricas con valores, los años pedidos y el score ponderado.
- Pide en la **misma vuelta** todas las consultas independientes que necesites: se ejecutan juntas. Encadenarlas de una en una multiplica el costo del turno.
- No repitas una consulta que ya respondiste en este turno: la respuesta anterior sigue en el contexto.
- Acota los filtros antes de pedir: una consulta amplia devuelve cientos de filas que luego arrastras en todas las vueltas.

# Límites
- No alcanzas cuentas, conversaciones, mensajes, notificaciones ni planes, ni debes intentarlo. Si preguntan por datos de usuarios, di que quedan fuera de tu alcance por diseño.
- Los pesos cambiaron entre ediciones en varios rankings (con claridad en Shanghai GRAS y THE): comprueba de qué año es cada uno antes de sumar o comparar.
- Shanghai GRAS y QS por Disciplina son multidisciplinarios: agregar sin fijar disciplina infla las cifras.
- Algunos rankings publican dos niveles, pilares e indicadores (THE Latam trae ambos). Suma pesos solo con `pondera` verdadero; `parte_de` dice a qué pilar pertenece cada indicador y sirve para explicar la composición sin contarla dos veces.

# Formato
Markdown (GFM). El usuario puede convertir tu respuesta en un reporte ejecutivo en PDF, donde su consulta es el subtítulo y tu texto el cuerpo: escribe para que se sostenga ante una autoridad que lo lea sin ver el chat.
- Abre con el hallazgo, en una o dos frases. El desarrollo viene después.
- Encabezados `##` solo si tratas más de un asunto.
- **Negrita** en las cifras y nombres que importan, con los asteriscos pegados al texto: `**así**`, nunca `** así **`.
- Tabla para cualquier comparación de dos o más universidades, métricas o años, con las columnas numéricas alineadas por `---:`.
- Registro sobrio: sin emojis ni exclamaciones. No abras con encabezado ni cierres con un resumen de lo dicho.

## Gráficos
Cuando compares entre tres y ocho cantidades comparables entre sí —puntajes de instituciones, un indicador por años, los pesos de un ranking— añade un bloque así, que se dibuja como barras en pantalla y en el PDF:

```kai-grafico
titulo: Puntaje total en QS Latam, 2024
unidad: puntos
destacar: PUCV
Pontificia Universidad Catolica de Chile: 88.1
Pontificia Universidad Catolica de Valparaiso: 62.3
```

Una línea `etiqueta: valor` por dato, el valor en cifras. `titulo` es obligatorio; `unidad`, `fuente` y `destacar` (la institución de la consulta) son opcionales. Las barras nacen en cero: no mezcles magnitudes distintas en uno mismo, y no lo uses para posiciones de ranking, donde el mejor es el número más bajo."""


_contexto = None


def contexto_de_datos() -> str:
    """Panorama de lo que hay cargado, leído de la base y cacheado por proceso.

    Va en la instrucción de sistema para que el asistente sepa de antemano qué
    puede responder con datos propios y qué tiene que buscar en internet, sin
    gastar un turno de herramientas en averiguarlo. Se cachea porque el catálogo
    solo cambia cuando se cargan datos nuevos, y eso implica reiniciar el backend.
    """
    global _contexto
    if _contexto is not None:
        return _contexto

    db = SessionLocal()
    try:
        filas = db.execute(text("""
            SELECT r.id_ranking, r.nombre_ranking, r.nivel_ranking,
                   count(DISTINCT m.id_metrica) AS metricas,
                   count(DISTINCT m.disciplina) FILTER (WHERE m.disciplina IS NOT NULL) AS disciplinas,
                   count(DISTINCT mu.id_universidad) AS universidades,
                   min(mu.anio_metrica) AS desde, max(mu.anio_metrica) AS hasta
            FROM ranking r
            LEFT JOIN metrica m ON m.id_ranking = r.id_ranking
            LEFT JOIN metrica_universidad mu ON mu.id_metrica = m.id_metrica
            GROUP BY r.id_ranking, r.nombre_ranking, r.nivel_ranking
            ORDER BY r.id_ranking
        """)).fetchall()
        totales = db.execute(text("""
            SELECT (SELECT count(*) FROM universidad) AS unis,
                   (SELECT count(DISTINCT pais_universidad) FROM universidad) AS paises,
                   (SELECT count(*) FROM cientifico) AS cientificos
        """)).one()
        # Los identificadores de las universidades más presentes en los datos.
        # Ocupan ~100 tokens en cada vuelta, pero ahorran la vuelta entera que el
        # modelo gastaba en `buscar_universidades` antes de poder consultar nada:
        # una vuelta cuesta treinta veces más que esta lista.
        habituales = db.execute(text("""
            SELECT u.id_universidad, u.nombre_universidad
            FROM universidad u
            JOIN metrica_universidad mu ON mu.id_universidad = u.id_universidad
            WHERE u.pais_universidad = 'Chile'
            GROUP BY u.id_universidad, u.nombre_universidad
            ORDER BY count(*) DESC, u.nombre_universidad
            LIMIT 10
        """)).fetchall()

        lineas = [f"- `{f.id_ranking}` **{f.nombre_ranking}** ({f.nivel_ranking}): "
                  f"{f.metricas} métricas"
                  + (f" en {f.disciplinas} disciplinas" if (f.disciplinas or 0) > 1 else "")
                  + (f", {f.universidades} universidades con datos entre {f.desde} y {f.hasta}."
                     if f.desde else ", sin valores cargados.")
                  for f in filas]
        _contexto = (
            "\n\n# Qué hay cargado en la base\n"
            f"{len(filas)} rankings, {totales.unis} universidades "
            f"({totales.paises} país/es) y {totales.cientificos} científicos.\n"
            + "\n".join(lineas)
            + "\n\nIdentificadores de las universidades chilenas con más datos: "
            + "; ".join(f"`{u.id_universidad}` {u.nombre_universidad}" for u in habituales)
            + ".\nUsa estos identificadores y los de los rankings directamente: no gastes una "
              "consulta en averiguar lo que ya está aquí. Lo que no aparezca en esta lista no "
              "está en la base, y para responder sobre ello hay que buscar en internet."
        )
    except Exception:
        # Si la base no responde al arrancar el turno, el asistente sigue siendo
        # utilizable (las herramientas devolverán su propio error); solo pierde
        # este resumen previo. No se cachea, para que el siguiente turno reintente.
        return ""
    finally:
        db.close()
    return _contexto


def system_prompt() -> str:
    return BASE_SYSTEM_PROMPT + contexto_de_datos()


# Se conserva el nombre antiguo por compatibilidad con lo que ya lo importaba.
SYSTEM_PROMPT = BASE_SYSTEM_PROMPT


# --- Utilidades de las herramientas ----------------------------------------

# Tope de filas de un resultado. No es solo una defensa contra una consulta
# desbocada: lo que devuelve una herramienta se reenvía al modelo en todas las
# vueltas siguientes del turno, así que una tabla de 300 filas entregada en la
# segunda vuelta de seis se paga cinco veces. Con 80 filas el resultado más
# grande medido baja de ~3.300 a ~1.600 tokens, y el aviso de recorte empuja al
# modelo a filtrar, que es lo que de verdad ahorra.
TOPE_FILAS = int(os.getenv("KAI_TOPE_FILAS", "80"))

# Los nombres llegaron a la base sin tildes ("Pontificia Universidad Catolica de
# Valparaiso"), pero tanto el usuario como el modelo las escriben. Comparar los
# dos lados sin tildes evita que "Católica" no encuentre nada. Se hace con
# `translate` en vez de con la extensión `unaccent` porque esta no está instalada
# y crearla exigiría permisos de superusuario también en el despliegue.
_CON_TILDE = "áàäâãéèëêíìïîóòöôõúùüûñç"
_SIN_TILDE = "aaaaaeeeeiiiiooooouuuunc"


def _plano(expresion: str) -> str:
    """SQL que devuelve `expresion` en minúsculas y sin tildes."""
    return f"translate(lower({expresion}), '{_CON_TILDE}', '{_SIN_TILDE}')"


def _contiene(columna: str, parametro: str) -> str:
    """Condición 'columna contiene parámetro', ignorando mayúsculas y tildes.

    El parámetro vacío no filtra, que es como se apagan los filtros opcionales.
    """
    izquierda = _plano("coalesce(" + columna + ", '')")
    derecha = _plano(":" + parametro)
    return f"(:{parametro} = '' OR {izquierda} LIKE '%' || {derecha} || '%')"


def _ids(texto: str) -> list[int]:
    """"1, 22, 7" -> [1, 22, 7]. Ignora lo que no sea un número."""
    return [int(x) for x in re.findall(r"\d+", texto or "")]


def _tabla(filas, columnas: list[str], vacio: str) -> str:
    """Filas -> texto tabulado con encabezado, recortado a `TOPE_FILAS`.

    Se entrega como texto plano separado por `|` en vez de JSON: ocupa bastante
    menos contexto por fila y los dos modelos lo leen igual de bien.
    """
    if not filas:
        return vacio
    recorte = filas[:TOPE_FILAS]
    cabecera = " | ".join(columnas)
    cuerpo = "\n".join(" | ".join("" if v is None else str(v) for v in f) for f in recorte)
    aviso = (f"\n[{len(filas)} filas en total; se muestran {TOPE_FILAS}. Filtra por "
             "universidad, métrica o disciplina en vez de pedir el resto: cada fila "
             "que traes se reenvía en todas las vueltas siguientes.]"
             ) if len(filas) > TOPE_FILAS else ""
    return f"{cabecera}\n{cuerpo}{aviso}"


def _consulta(sql: str, params: dict, columnas: list[str], vacio) -> str:
    """Ejecuta y tabula. `vacio` puede ser un texto o una función que lo produzca.

    La forma con función existe para las consultas donde no encontrar nada es
    caro: en vez de devolver «no hay datos» —que obliga al modelo a probar otra
    combinación, y cada intento es una vuelta entera del ciclo—, se aprovecha
    para decirle qué sí existe.
    """
    return _tabla(_filas(sql, params), columnas, vacio() if callable(vacio) else vacio)


def _filas(sql: str, params: dict):
    db = SessionLocal()
    try:
        return db.execute(text(sql), params).fetchall()
    finally:
        db.close()


def _pilar_con_datos(metrica_id: int, universidad_ids: list[int]):
    """El pilar que agrupa a una métrica sin valores, si el pilar sí los tiene.

    Varios rankings cargan los valores en el nivel agregado —THE Latam publica
    «Citation impact» en su metodología, pero los datos están en «Research
    Quality», que lo agrupa—. Sin esto, una pregunta por el indicador fino lleva
    a un resultado vacío, y el modelo se pone a buscar el nombre por sinónimos:
    en la traza medida, doce vueltas para una pregunta de una.
    """
    filas = _filas("""
        SELECT p.id_metrica, p.nombre_metrica
        FROM metrica h
        JOIN metrica p ON p.id_metrica = h.id_metrica_padre
        JOIN metrica_universidad mu ON mu.id_metrica = p.id_metrica
        WHERE h.id_metrica = :mid
          AND (:sin_u OR mu.id_universidad = ANY(:uids))
        GROUP BY p.id_metrica, p.nombre_metrica
        LIMIT 1
    """, {"mid": metrica_id, "uids": universidad_ids or [0], "sin_u": not universidad_ids})
    return (filas[0].id_metrica, filas[0].nombre_metrica) if filas else None


def _metricas_con_datos(ranking_id: int, universidad_ids: list[int], limite: int = 12) -> str:
    """Qué métricas de un ranking sí tienen valores, y para qué años.

    Es la respuesta útil cuando una consulta concreta no devuelve nada: la
    alternativa es que el modelo vaya probando identificadores de uno en uno.
    """
    db = SessionLocal()
    try:
        filas = db.execute(text("""
            SELECT m.id_metrica, m.nombre_metrica,
                   left(coalesce(m.descripcion_metrica, ''), 70) AS que_mide,
                   min(mu.anio_metrica) AS desde, max(mu.anio_metrica) AS hasta,
                   (SELECT string_agg(c.nombre_metrica, ', ')
                      FROM (SELECT nombre_metrica FROM metrica
                             WHERE id_metrica_padre = m.id_metrica
                             ORDER BY nombre_metrica LIMIT 4) c) AS agrupa
            FROM metrica m
            JOIN metrica_universidad mu ON mu.id_metrica = m.id_metrica
            WHERE m.id_ranking = :rid
              AND (:sin_u OR mu.id_universidad = ANY(:uids))
            GROUP BY m.id_metrica, m.nombre_metrica, m.descripcion_metrica
            ORDER BY count(*) DESC, m.nombre_metrica
            LIMIT :lim
        """), {"rid": ranking_id, "uids": universidad_ids or [0],
               "sin_u": not universidad_ids, "lim": limite}).fetchall()
    finally:
        db.close()
    if not filas:
        return ("Ese ranking no tiene valores cargados para esas universidades; comprueba "
                "los identificadores.")
    # La lista lleva de qué se compone cada métrica, no solo su nombre: sin eso
    # el modelo no puede relacionar el concepto de la pregunta («índice de
    # citas») con el nombre que el ranking le da («Research Quality»), y se pone
    # a probar sinónimos, una vuelta del ciclo por cada intento.
    #
    # La descripción solo se incluye si distingue: en varios rankings es la misma
    # frase de plantilla en todas las métricas, y repetirla es gastar tokens en
    # ruido. Con menos descripciones distintas que la mitad de las filas, se omite.
    distintas = {(f.que_mide or "")[:40] for f in filas}
    util = len(distintas) > max(1, len(filas) // 2)

    def detalle(f):
        if f.agrupa:
            return f" [agrupa: {f.agrupa}]"
        return f": {f.que_mide}" if util and f.que_mide else ""

    disponibles = "\n".join(
        f"`{f.id_metrica}` {f.nombre_metrica} ({f.desde}-{f.hasta}){detalle(f)}"
        for f in filas)
    return ("Las métricas de ese ranking con valores cargados son:\n" + disponibles
            + "\nElige la que corresponda por lo que mide, no busques otro nombre.")


# --- Herramientas: rankings y metodología -----------------------------------

def listar_rankings() -> str:
    """Rankings cargados con su alcance: nivel, categoría, editor, métricas, universidades y años cubiertos. Empieza aquí si no sabes qué identificador usar."""
    return _consulta(
        """
        SELECT r.id_ranking, r.nombre_ranking, r.nivel_ranking, r.categoria_ranking,
               r.pais_ranking,
               count(DISTINCT m.id_metrica) AS metricas,
               count(DISTINCT m.disciplina) AS disciplinas,
               count(DISTINCT mu.id_universidad) AS universidades,
               min(mu.anio_metrica) AS desde, max(mu.anio_metrica) AS hasta
        FROM ranking r
        LEFT JOIN metrica m ON m.id_ranking = r.id_ranking
        LEFT JOIN metrica_universidad mu ON mu.id_metrica = m.id_metrica
        GROUP BY r.id_ranking, r.nombre_ranking, r.nivel_ranking, r.categoria_ranking, r.pais_ranking
        ORDER BY r.id_ranking
        """,
        {},
        ["id", "ranking", "nivel", "categoria", "pais_editor", "metricas", "disciplinas",
         "universidades", "desde", "hasta"],
        "No hay rankings cargados.",
    )


def detalle_ranking(ranking_id: int) -> str:
    """Descripción y metodología completa de un ranking, con sus disciplinas y años con datos. Úsala si preguntan qué mide o cómo pondera.

    Args:
        ranking_id: ID del ranking (ver listar_rankings).
    """
    db = SessionLocal()
    try:
        r = db.execute(
            text("""SELECT nombre_ranking, nivel_ranking, categoria_ranking, pais_ranking,
                           descripcion_ranking, metodologia_ranking
                    FROM ranking WHERE id_ranking = :rid"""),
            {"rid": ranking_id},
        ).fetchone()
        if r is None:
            return f"No existe el ranking {ranking_id}. Usa listar_rankings."

        disciplinas = db.execute(
            text("""SELECT DISTINCT disciplina FROM metrica
                    WHERE id_ranking = :rid AND disciplina IS NOT NULL ORDER BY disciplina"""),
            {"rid": ranking_id},
        ).scalars().all()
        anios = db.execute(
            text("""SELECT DISTINCT mu.anio_metrica FROM metrica_universidad mu
                    JOIN metrica m ON m.id_metrica = mu.id_metrica
                    WHERE m.id_ranking = :rid ORDER BY 1"""),
            {"rid": ranking_id},
        ).scalars().all()

        partes = [
            f"{r.nombre_ranking} (id {ranking_id})",
            f"Nivel: {r.nivel_ranking} | Categoría: {r.categoria_ranking} | Publicado desde: {r.pais_ranking}",
            f"Años con datos: {', '.join(str(a) for a in anios) if anios else 'ninguno'}",
            f"Disciplinas ({len(disciplinas)}): " + (", ".join(disciplinas) if disciplinas else "no aplica"),
            "",
            f"Descripción: {r.descripcion_ranking or '(no registrada)'}",
            "",
            f"Metodología: {r.metodologia_ranking or '(no registrada)'}",
        ]
        return "\n".join(partes)
    finally:
        db.close()


def buscar_metricas(ranking_id: int, texto: str = "", disciplina: str = "") -> str:
    """Métricas de un ranking: nombre, descripción, tipo, disciplina, peso, y los años con valores cargados.

    `anios_con_datos` vacío significa que esa métrica está en la metodología pero
    no tiene valores: no la consultes. Un indicador puede repetirse con pesos
    distintos si la metodología cambió entre ediciones. Suma pesos solo con
    `pondera` verdadero: el resto es el otro nivel de la jerarquía y duplicaría el
    total; `parte_de` nombra su pilar. Filtra en los rankings grandes (Shanghai
    GRAS y QS por Disciplina tienen cientos de métricas).

    Args:
        ranking_id: ID del ranking (ver listar_rankings).
        texto: Fragmento del nombre o la descripción. Vacío = sin filtro.
        disciplina: Disciplina exacta o fragmento (ej. "Physics"). Vacío = todas.
    """
    filas = _filas(
        f"""
        SELECT m.id_metrica, m.nombre_metrica, m.disciplina, m.tipo_metrica, m.peso_metrica,
               m.pondera, p.nombre_metrica AS parte_de,
               string_agg(DISTINCT mu.anio_metrica::text, ', ' ORDER BY mu.anio_metrica::text) AS anios_con_datos,
               left(coalesce(m.descripcion_metrica, ''), 120) AS descripcion
        FROM metrica m
        LEFT JOIN metrica_universidad mu ON mu.id_metrica = m.id_metrica
        LEFT JOIN metrica p ON p.id_metrica = m.id_metrica_padre
        WHERE m.id_ranking = :rid
          AND ({_contiene('m.nombre_metrica', 'txt')}
               OR {_contiene('m.descripcion_metrica', 'txt')})
          AND {_contiene('m.disciplina', 'dis')}
        GROUP BY m.id_metrica, m.nombre_metrica, m.disciplina, m.tipo_metrica,
                 m.peso_metrica, m.pondera, p.nombre_metrica, m.descripcion_metrica
        -- Las que tienen valores van primero: son las únicas que se pueden
        -- consultar, y así el modelo no elige una vacía y gasta una vuelta en
        -- descubrir que no hay nada.
        ORDER BY (count(mu.anio_metrica) = 0), m.disciplina, m.nombre_metrica
        """,
        {"rid": ranking_id, "txt": texto or "", "dis": disciplina or ""})

    # Que el filtro no encuentre nada —o solo encuentre métricas sin valores— es
    # el caso caro: el modelo prueba otro identificador, y cada intento es una
    # vuelta entera del ciclo. Se le entrega directamente lo que sí puede consultar.
    if not filas or all(not f.anios_con_datos for f in filas):
        # Si lo que se buscaba existe pero sus valores están en el pilar que lo
        # agrupa, se dice cuál es y se acaba ahí la búsqueda: sugerir una lista
        # no basta —el modelo sigue probando sinónimos—, hay que nombrarlo.
        for f in filas:
            pilar = _pilar_con_datos(f.id_metrica, [])
            if pilar:
                return (f"«{f.nombre_metrica}» (id {f.id_metrica}) está en la metodología pero no "
                        f"tiene valores cargados: sus datos están agregados en `{pilar[0]}` "
                        f"{pilar[1]}, el pilar que la agrupa. Consulta esa.")
        aviso = ("Ninguna métrica coincide con ese filtro. " if not filas else
                 "Ninguna de las métricas que coinciden tiene valores cargados. ")
        return aviso + _metricas_con_datos(ranking_id, [])

    return _tabla(
        filas,
        ["id_metrica", "metrica", "disciplina", "tipo", "peso_%", "pondera", "parte_de",
         "anios_con_datos", "descripcion"],
        "",
    )


# --- Herramientas: universidades y valores ----------------------------------

def buscar_universidades(texto: str = "", pais: str = "") -> str:
    """Universidades por nombre o país, con su id y en cuántos rankings tiene datos. El id hace falta para casi todo lo demás; basta un fragmento ("Católica", "Concepción").

    Args:
        texto: Fragmento del nombre. Vacío = todas.
        pais: País a filtrar (ej. "Chile"). Vacío = todos.
    """
    return _consulta(
        f"""
        SELECT u.id_universidad, u.nombre_universidad, u.pais_universidad,
               count(DISTINCT m.id_ranking) AS rankings,
               min(mu.anio_metrica) AS desde, max(mu.anio_metrica) AS hasta
        FROM universidad u
        LEFT JOIN metrica_universidad mu ON mu.id_universidad = u.id_universidad
        LEFT JOIN metrica m ON m.id_metrica = mu.id_metrica
        WHERE {_contiene('u.nombre_universidad', 'txt')}
          AND {_contiene('u.pais_universidad', 'pais')}
        GROUP BY u.id_universidad, u.nombre_universidad, u.pais_universidad
        ORDER BY u.nombre_universidad
        """,
        {"txt": texto or "", "pais": pais or ""},
        ["id", "universidad", "pais", "rankings_con_datos", "desde", "hasta"],
        "Ninguna universidad coincide. Prueba con menos texto o sin filtros.",
    )


def consultar_valores(ranking_id: int, anio: int, universidad_ids: str = "",
                      metrica_ids: str = "", disciplina: str = "") -> str:
    """Valores de las métricas de un ranking en un año, universidad por universidad. Filtra por universidad, métrica o disciplina: sin filtros devuelve cientos de filas que luego arrastras en cada vuelta.

    Args:
        ranking_id: ID del ranking.
        anio: Año de la edición.
        universidad_ids: IDs separados por coma (ej. "1,22"). Vacío = todas.
        metrica_ids: IDs de métricas separados por coma. Vacío = todas.
        disciplina: Disciplina exacta o fragmento. Vacío = todas.
    """
    return _consulta(
        f"""
        SELECT u.nombre_universidad, m.nombre_metrica, m.disciplina, m.peso_metrica, mu.valor_metrica
        FROM metrica_universidad mu
        JOIN metrica m ON m.id_metrica = mu.id_metrica
        JOIN universidad u ON u.id_universidad = mu.id_universidad
        WHERE m.id_ranking = :rid AND mu.anio_metrica = :anio
          AND (:sin_u OR mu.id_universidad = ANY(:uids))
          AND (:sin_m OR mu.id_metrica = ANY(:mids))
          AND {_contiene('m.disciplina', 'dis')}
        ORDER BY u.nombre_universidad, m.disciplina, m.nombre_metrica
        """,
        {"rid": ranking_id, "anio": anio, "dis": disciplina or "",
         "uids": _ids(universidad_ids) or [0], "sin_u": not _ids(universidad_ids),
         "mids": _ids(metrica_ids) or [0], "sin_m": not _ids(metrica_ids)},
        ["universidad", "metrica", "disciplina", "peso_%", "valor"],
        lambda: f"No hay valores para el año {anio} en esa combinación. "
                + _metricas_con_datos(ranking_id, _ids(universidad_ids)),
    )


def consultar_tendencia(ranking_id: int, metrica_id: int, universidad_ids: str = "") -> str:
    """Serie histórica (año, valor) de una métrica para una o más universidades. Si la métrica no tiene valores propios pero es parte de un pilar que sí los tiene, devuelve la serie del pilar y lo advierte.

    Args:
        ranking_id: ID del ranking.
        metrica_id: ID de la métrica (ver buscar_metricas).
        universidad_ids: IDs separados por coma (ej. "1,22"). Vacío = todas.
    """
    universidades = _ids(universidad_ids)

    def sin_datos() -> str:
        # Antes de rendirse, el nivel agregado: es donde varios rankings cargan
        # de verdad los valores del indicador que se está pidiendo.
        pilar = _pilar_con_datos(metrica_id, universidades)
        if pilar is None:
            return ("No hay datos para esa combinación. "
                    + _metricas_con_datos(ranking_id, universidades))
        id_pilar, nombre = pilar
        serie = consultar_tendencia(ranking_id, id_pilar, universidad_ids)
        return (f"La métrica {metrica_id} no tiene valores cargados: sus datos están en "
                f"`{id_pilar}` {nombre}, el pilar que la agrupa. Su serie es:\n{serie}\n"
                f"Al responder, di que la cifra es la del pilar {nombre}, no la del "
                "indicador suelto.")

    return _consulta(
        """
        SELECT u.nombre_universidad, mu.anio_metrica, mu.valor_metrica
        FROM metrica_universidad mu
        JOIN metrica m ON m.id_metrica = mu.id_metrica
        JOIN universidad u ON u.id_universidad = mu.id_universidad
        WHERE m.id_ranking = :rid AND m.id_metrica = :mid
          AND (:sin_u OR mu.id_universidad = ANY(:uids))
        ORDER BY u.nombre_universidad, mu.anio_metrica
        """,
        {"rid": ranking_id, "mid": metrica_id,
         "uids": universidades or [0], "sin_u": not universidades},
        ["universidad", "anio", "valor"],
        sin_datos,
    )


def consultar_ranking_resumen(ranking_id: int, anio: int, disciplina: str = "") -> str:
    """Score total (suma ponderada de las métricas) por universidad para un ranking y año, de mayor a menor. En los multidisciplinarios (Shanghai GRAS, QS por Disciplina) fija `disciplina`: sin ella se suman todas y el resultado no significa nada.

    Args:
        ranking_id: ID del ranking.
        anio: Año a consultar.
        disciplina: Disciplina exacta o fragmento. Obligatoria en multidisciplinarios.
    """
    return _consulta(
        f"""
        SELECT u.nombre_universidad,
               round(COALESCE(SUM(mu.valor_metrica * (m.peso_metrica / 100.0)), 0), 2) AS score_total,
               count(*) AS metricas_usadas
        FROM metrica m
        JOIN metrica_universidad mu ON mu.id_metrica = m.id_metrica
        JOIN universidad u ON u.id_universidad = mu.id_universidad
        WHERE m.id_ranking = :rid AND mu.anio_metrica = :anio
          AND {_contiene('m.disciplina', 'dis')}
        GROUP BY u.nombre_universidad
        ORDER BY score_total DESC
        """,
        {"rid": ranking_id, "anio": anio, "dis": disciplina or ""},
        ["universidad", "score_total", "metricas_usadas"],
        "No hay datos para ese ranking en ese año.",
    )


def comparar_universidades(ranking_id: int, universidad_ids: str, anios: str = "",
                           disciplina: str = "") -> str:
    """Compara universidades en un ranking: todas sus métricas con valores, los años pedidos y el score ponderado, en una sola llamada.

    Es la herramienta para «quién está mejor», «cómo evolucionó» o «compara A con
    B». Resuelve de una vez lo que si no exige encadenar buscar_metricas,
    consultar_valores y consultar_tendencia.

    Args:
        ranking_id: ID del ranking.
        universidad_ids: IDs separados por coma (ej. "2,55"). Hasta 6.
        anios: Años separados por coma (ej. "2019,2024"). Vacío = el más reciente.
        disciplina: Disciplina exacta o fragmento. Obligatoria en multidisciplinarios.
    """
    universidades = _ids(universidad_ids)[:6]
    if not universidades:
        return ("Hace falta al menos un identificador de universidad. Los de las chilenas "
                "con más datos están en tu contexto; el resto, con buscar_universidades.")
    pedidos = _ids(anios)[:6]

    filas = _filas(
        f"""
        SELECT mu.id_universidad, u.nombre_universidad, mu.anio_metrica,
               m.nombre_metrica, m.peso_metrica, m.pondera, mu.valor_metrica
        FROM metrica_universidad mu
        JOIN metrica m ON m.id_metrica = mu.id_metrica
        JOIN universidad u ON u.id_universidad = mu.id_universidad
        WHERE m.id_ranking = :rid
          AND mu.id_universidad = ANY(:uids)
          AND (:sin_anios OR mu.anio_metrica = ANY(:anios))
          AND {_contiene('m.disciplina', 'dis')}
        """,
        {"rid": ranking_id, "uids": universidades, "anios": pedidos or [0],
         "sin_anios": not pedidos, "dis": disciplina or ""})

    if not filas:
        return "No hay valores para esa combinación. " + _metricas_con_datos(ranking_id, universidades)

    # Sin años pedidos se toma el más reciente: comparar todos los años de todas
    # las universidades devuelve una tabla enorme que nadie pidió.
    años = sorted({f.anio_metrica for f in filas})
    if not pedidos:
        años = años[-1:]
    filas = [f for f in filas if f.anio_metrica in años]

    nombres = {f.id_universidad: f.nombre_universidad for f in filas}
    columnas = [(u, a) for u in universidades if u in nombres for a in años]
    valores = {(f.id_universidad, f.anio_metrica, f.nombre_metrica): f.valor_metrica for f in filas}
    pesos = {f.nombre_metrica: (f.peso_metrica, f.pondera) for f in filas}
    metricas = sorted(pesos, key=lambda n: (-(pesos[n][0] or 0), n))[:TOPE_FILAS]

    def celda(valor):
        return "" if valor is None else f"{valor:g}"

    cabecera = "metrica | peso_% | " + " | ".join(f"u{u}·{a}" for u, a in columnas)
    cuerpo = [
        f"{n} | {pesos[n][0]:g} | " + " | ".join(celda(valores.get((u, a, n))) for u, a in columnas)
        for n in metricas
    ]
    # El score ponderado es lo que de verdad responde «quién está mejor», y
    # calcularlo aparte costaba otra vuelta.
    totales = []
    for u, a in columnas:
        suma = sum((valores.get((u, a, n)) or 0) * (pesos[n][0] or 0) / 100
                   for n in metricas if pesos[n][1])
        totales.append(f"{suma:.2f}")
    cuerpo.append("SCORE PONDERADO (solo métricas que ponderan) |  | " + " | ".join(totales))

    leyenda = "; ".join(f"u{u} = {nombres[u]}" for u in universidades if u in nombres)
    faltan = [str(u) for u in universidades if u not in nombres]
    aviso = f"\nSin datos en este ranking: {', '.join(faltan)}." if faltan else ""
    return f"{leyenda}\n{cabecera}\n" + "\n".join(cuerpo) + aviso


# --- Herramientas: científicos ----------------------------------------------

def buscar_cientificos(texto: str = "", universidad_id: int = 0, campo: str = "",
                       ordenar_por: str = "composite_score", limite: int = 25) -> str:
    """Científicos del censo (World's Top 2% de Stanford/Elsevier y censo Scopus) con sus indicadores: h-index, citas, artículos, rank global y score compuesto.

    Args:
        texto: Fragmento del nombre. Vacío = sin filtro.
        universidad_id: ID de universidad. 0 = todas.
        campo: Campo o subcampo principal (ej. "Physics"). Vacío = todos.
        ordenar_por: "composite_score", "h_index", "citas_totales", "num_articulos" o "rank_global".
        limite: Cuántos devolver (máximo 100).
    """
    columnas = {"composite_score": "cm.composite_score DESC NULLS LAST",
                "h_index": "cm.h_index DESC NULLS LAST",
                "citas_totales": "cm.citas_totales DESC NULLS LAST",
                "num_articulos": "cm.num_articulos DESC NULLS LAST",
                "rank_global": "cm.rank_global ASC NULLS LAST"}
    orden = columnas.get(ordenar_por, columnas["composite_score"])
    return _consulta(
        f"""
        SELECT c.id_cientifico, c.nombre_cientifico, u.nombre_universidad,
               coalesce(c.campo_principal, '') AS campo, coalesce(c.subcampo_principal, '') AS subcampo,
               cm.anio_datos, cm.h_index, cm.citas_totales, cm.num_articulos,
               cm.rank_global, cm.composite_score, cm.fuente
        FROM cientifico c
        LEFT JOIN universidad u ON u.id_universidad = c.id_universidad
        LEFT JOIN cientifico_metrica cm ON cm.id_cientifico = c.id_cientifico
        WHERE {_contiene('c.nombre_cientifico', 'txt')}
          AND (:uid = 0 OR c.id_universidad = :uid)
          AND ({_contiene('c.campo_principal', 'campo')}
               OR {_contiene('c.subcampo_principal', 'campo')})
        ORDER BY {orden}
        LIMIT :lim
        """,
        {"txt": texto or "", "uid": universidad_id or 0, "campo": campo or "",
         "lim": max(1, min(int(limite or 25), 100))},
        ["id", "cientifico", "universidad", "campo", "subcampo", "anio", "h_index",
         "citas", "articulos", "rank_global", "score", "fuente"],
        "Ningún científico coincide con ese filtro.",
    )


def perfil_cientifico(id_cientifico: int) -> str:
    """Ficha completa de un científico: su institución, sus indicadores por año y sus tópicos de investigación.

    Args:
        id_cientifico: ID del científico (ver buscar_cientificos).
    """
    db = SessionLocal()
    try:
        c = db.execute(
            text("""SELECT c.nombre_cientifico, u.nombre_universidad, c.institucion_original,
                           c.campo_principal, c.subcampo_principal, c.pais_cientifico, c.orcid,
                           c.anio_primera_publicacion, c.anio_ultima_publicacion
                    FROM cientifico c
                    LEFT JOIN universidad u ON u.id_universidad = c.id_universidad
                    WHERE c.id_cientifico = :cid"""),
            {"cid": id_cientifico},
        ).fetchone()
        if c is None:
            return f"No existe el científico {id_cientifico}. Usa buscar_cientificos."

        metricas = db.execute(
            text("""SELECT anio_datos, fuente, rank_global, h_index, hm_index, citas_totales,
                           num_articulos, composite_score, self_citation_pct
                    FROM cientifico_metrica WHERE id_cientifico = :cid ORDER BY anio_datos"""),
            {"cid": id_cientifico},
        ).fetchall()
        topicos = db.execute(
            text("""SELECT topico, anio_datos, autor_documentos, topico_fwci
                    FROM cientifico_topico WHERE id_cientifico = :cid
                    ORDER BY coalesce(autor_documentos, 0) DESC, topico"""),
            {"cid": id_cientifico},
        ).fetchall()

        return "\n".join([
            f"{c.nombre_cientifico} (id {id_cientifico})",
            f"Universidad: {c.nombre_universidad or '(sin asignar)'} | Institución declarada: "
            f"{c.institucion_original or '(no registrada)'}",
            f"Campo: {c.campo_principal or '(no registrado)'} / {c.subcampo_principal or ''} | "
            f"País: {c.pais_cientifico or '(no registrado)'} | ORCID: {c.orcid or '(no registrado)'}",
            f"Publicaciones entre {c.anio_primera_publicacion or '?'} y {c.anio_ultima_publicacion or '?'}",
            "",
            "Indicadores por año:",
            _tabla(metricas, ["anio", "fuente", "rank_global", "h_index", "hm_index", "citas",
                              "articulos", "score", "autocitas_%"], "  (sin indicadores cargados)"),
            "",
            f"Tópicos de investigación ({len(topicos)}):",
            _tabla(topicos, ["topico", "anio", "documentos", "fwci"], "  (sin tópicos cargados)"),
        ])
    finally:
        db.close()


# --- Herramienta de SQL libre, acotada al dominio académico -----------------

# Única lista de tablas que la consulta libre puede tocar. Todo lo demás —las
# cuentas de usuario, sus conversaciones, sus mensajes, sus notificaciones y los
# planes contratados— queda fuera, y el guardián de abajo rechaza la consulta
# entera si aparece cualquier otro identificador de tabla.
TABLAS_PUBLICAS = {
    "ranking", "universidad", "metrica", "metrica_universidad",
    "cientifico", "cientifico_metrica", "cientifico_topico",
}

# Tablas que existen pero el asistente no debe ver jamás. Se comprueban aparte de
# la lista blanca porque son el motivo mismo de que exista este guardián: si una
# forma de escribir la consulta se escapara del análisis de relaciones, este
# filtro por palabra la detiene igual.
TABLAS_VETADAS = {"usuario", "conversacion", "mensaje", "notificacion", "plan"}

_COMENTARIOS = re.compile(r"--[^\n]*|/\*.*?\*/", re.S)
# Identificadores en posición de tabla: lo que sigue a FROM, JOIN, INTO o UPDATE.
# Se admiten las comillas dobles de PostgreSQL, que si no quedarían fuera del
# análisis y permitirían colar `FROM "usuario"`.
_RELACIONES = re.compile(r'\b(?:from|join|into|update)\s+("?[a-zA-Z_][\w$."]*)', re.I)
_VETADAS = re.compile(r"\b(" + "|".join(sorted(TABLAS_VETADAS)) + r")s?\b", re.I)
# Palabras que no deben aparecer nunca, ni siquiera dentro de una subconsulta o
# de una llamada a función: escrituras, DDL, catálogos del sistema y ficheros.
_PROHIBIDAS = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|vacuum|"
    r"reindex|call|do|merge|refresh|listen|notify|lock|prepare|execute|set|reset|"
    r"pg_sleep|pg_read_file|pg_read_binary_file|pg_ls_dir|lo_import|lo_export|dblink)\b",
    re.I)
# Esquemas y catálogos internos de PostgreSQL.
_CATALOGOS = re.compile(r"\b(pg_catalog|information_schema|pg_[a-z_]+)\b", re.I)


def _revisar_sql(sql: str) -> str | None:
    """Devuelve el motivo del rechazo, o None si la consulta puede ejecutarse.

    Cuatro capas, porque ninguna basta sola: se prohíben las palabras que
    escriben o leen el sistema; se rechaza cualquier mención de las tablas
    vetadas, escríbase como se escriba; se exige que toda relación citada esté en
    la lista blanca (para que ninguna subconsulta llegue a otro sitio); y, ya en
    la ejecución, la transacción es de solo lectura, que es la garantía que da el
    propio motor de la base y no depende de acertar con estas expresiones.
    """
    limpio = _COMENTARIOS.sub(" ", sql or "").strip().rstrip(";")
    if not limpio:
        return "La consulta está vacía."
    if ";" in limpio:
        return "Solo se admite una sentencia; quita el ';' intermedio."
    if not re.match(r"^\s*(select|with)\b", limpio, re.I):
        return "Solo se admiten consultas de lectura que empiecen por SELECT o WITH."
    if _PROHIBIDAS.search(limpio):
        return "La consulta contiene una operación no permitida: esta herramienta solo lee datos."
    if _CATALOGOS.search(limpio):
        return "No se puede consultar el catálogo interno de PostgreSQL."

    # Nombrar una tabla vetada basta para rechazar la consulta entera, aunque
    # aparezca entre comillas, con esquema delante o dentro de una subconsulta.
    vetada = _VETADAS.search(limpio)
    if vetada:
        return (f"La consulta menciona '{vetada.group(1)}', que contiene datos de las personas "
                "usuarias y queda fuera del alcance del asistente.")

    # Los CTE definen nombres propios que no son tablas reales; se admiten.
    ctes = {n.lower() for n in re.findall(r"\b([a-zA-Z_]\w*)\s+as\s*\(", limpio, re.I)}
    for relacion in _RELACIONES.findall(limpio):
        nombre = relacion.replace('"', "").split(".")[-1].lower()
        if nombre in ctes or nombre in TABLAS_PUBLICAS:
            continue
        return (f"La tabla '{relacion}' no está disponible para el asistente. "
                f"Solo puede consultar: {', '.join(sorted(TABLAS_PUBLICAS))}.")
    return None


def consulta_sql(sql: str) -> str:
    """SQL de solo lectura (PostgreSQL) sobre las tablas académicas, para cruces o agregaciones que las demás herramientas no cubren. Una sola sentencia SELECT o WITH, sin punto y coma, siempre con LIMIT.

    Tablas:
      ranking(id_ranking, nombre_ranking, descripcion_ranking, nivel_ranking, categoria_ranking, pais_ranking, metodologia_ranking)
      universidad(id_universidad, nombre_universidad, pais_universidad)
      metrica(id_metrica, id_ranking, nombre_metrica, descripcion_metrica, tipo_metrica, peso_metrica, disciplina, pondera, id_metrica_padre)
      metrica_universidad(id_metrica, id_universidad, valor_metrica, anio_metrica)
      cientifico(id_cientifico, nombre_cientifico, id_universidad, institucion_original, campo_principal, subcampo_principal, anio_primera_publicacion, anio_ultima_publicacion, pais_cientifico, orcid)
      cientifico_metrica(id_cientifico, anio_datos, fuente, rank_global, rank_global_ns, h_index, hm_index, citas_totales, num_articulos, composite_score, self_citation_pct)
      cientifico_topico(id_cientifico, topico, fuente, anio_datos, autor_documentos, topico_fwci)

    Las tablas de usuarios, conversaciones, mensajes, notificaciones y planes no
    existen para ti: nombrarlas rechaza la consulta.

    Args:
        sql: La sentencia SELECT o WITH a ejecutar.
    """
    motivo = _revisar_sql(sql)
    if motivo:
        return f"ERROR: {motivo}"

    db = SessionLocal()
    try:
        # La transacción de solo lectura la impone PostgreSQL, no estas líneas de
        # Python: aunque el filtro de arriba dejara pasar una escritura, aquí
        # fallaría. El timeout evita que una consulta mal planteada bloquee el turno.
        db.execute(text("SET TRANSACTION READ ONLY"))
        db.execute(text("SET LOCAL statement_timeout = '8s'"))
        resultado_sql = db.execute(text(sql.strip().rstrip(";")))
        filas = resultado_sql.fetchall()
        return _tabla(filas, list(resultado_sql.keys()), "La consulta no devolvió filas.")
    except Exception as e:
        # El error vuelve al modelo para que corrija la consulta y reintente.
        return f"ERROR de SQL: {type(e).__name__}: {str(e)[:400]}"
    finally:
        db.rollback()
        db.close()


FUNCIONES = [
    listar_rankings,
    detalle_ranking,
    buscar_metricas,
    buscar_universidades,
    consultar_valores,
    consultar_tendencia,
    consultar_ranking_resumen,
    comparar_universidades,
    buscar_cientificos,
    perfil_cientifico,
    consulta_sql,
]

# `beta_tool` no es solo un decorador: aplicado aquí deja intactas las funciones
# originales, que el motor de Gemini invoca directamente. Cada objeto expone
# `name`, `description` e `input_schema` (esquema JSON derivado de la firma y del
# docstring), que es la fuente única de la que se traducen ambos formatos.
TOOLS = [beta_tool(f) for f in FUNCIONES]

POR_NOMBRE = {f.__name__: f for f in FUNCIONES}


# --- Contrato de respuesta de los motores ----------------------------------

def resultado(texto: str, modelo: str, motor: str,
              entrada: int = 0, salida: int = 0, ok: bool = True,
              busquedas: int = 0) -> dict:
    """Forma única de respuesta de cualquier motor del asistente.

    Los mensajes de error también viajan por aquí, con `ok=False`, para que la
    capa superior no tenga que distinguir entre respuesta y fallo al mostrar, ni
    conocer qué motor la produjo. `busquedas` cuenta las consultas a internet del
    turno, que en ambos proveedores se facturan aparte de los tokens.
    """
    return {"texto": texto, "tokens_entrada": entrada, "tokens_salida": salida,
            "modelo": modelo, "motor": motor, "ok": ok, "busquedas": busquedas}
