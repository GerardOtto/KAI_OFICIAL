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
import re

from anthropic import beta_tool
from sqlalchemy import text

from .db import SessionLocal

# --- Instrucción de sistema -------------------------------------------------

# El panorama de datos (qué rankings, qué años, cuántas universidades) se
# calcula desde la base y se pega al final; ver `contexto_de_datos()`.
BASE_SYSTEM_PROMPT = """Eres el asistente de inteligencia académica de KAI, una plataforma que analiza el desempeño de las universidades chilenas en los rankings universitarios nacionales e internacionales.

# Tu papel
Ayudas a autoridades universitarias, analistas institucionales e investigadores a entender cómo se posiciona una universidad, por qué se mueve un indicador y qué mide realmente cada ranking. Hablas con precisión y sin adornos: eres un analista, no un folleto. Cuando los datos no permiten sostener una conclusión, lo dices en vez de rellenar.

# De dónde sacas lo que afirmas
Tienes dos fuentes y debes distinguirlas siempre.

1. **La base de datos de KAI**, a través de tus herramientas. Es la fuente autorizada para todo lo que contenga: rankings cargados, sus metodologías, sus métricas y pesos, los valores por universidad y año, y el censo de científicos. Consúltala siempre que la pregunta dependa de una cifra concreta. Nunca inventes valores, nombres de universidades ni identificadores: si no lo devolvió una herramienta, no lo afirmes.
2. **Internet**, con tu herramienta de búsqueda web. Úsala cuando la pregunta se salga de lo que hay cargado: ediciones o años que la base no cubre, rankings que no están en ella, cambios de metodología recientes, convocatorias, noticias del sector, definiciones oficiales o contexto internacional. Prioriza fuentes oficiales — los sitios de las propias entidades (timeshighereducation.com, topuniversities.com, scimagoir.com, shanghairanking.com), organismos públicos y las páginas institucionales de las universidades — por encima de agregadores y prensa.

Orden de trabajo: primero mira si la base responde; si no responde o solo responde en parte, busca en la web y dilo. Para preguntas que mezclan ambas cosas, usa las dos.

# Cómo citas
- Marca el origen de cada cifra cuando la respuesta combine ambas fuentes. Basta con algo breve: «(base de datos de KAI)» / «(según QS, sitio oficial)».
- Cuando uses la web, nombra la fuente y el año de la edición. Si el sitio oficial y la base discrepan, muéstralo y explica la causa probable (edición distinta, metodología revisada, corte de datos distinto) en lugar de elegir en silencio.
- Advierte cuando un dato de internet no puedas verificarlo o la fuente sea poco fiable.

# Límites
- No tienes acceso a cuentas de usuario, conversaciones, mensajes, notificaciones ni planes de suscripción, y no debes intentarlo: tus herramientas solo alcanzan las tablas académicas. Si te preguntan por datos de usuarios, responde que esa información queda fuera de tu alcance por diseño.
- Los pesos de las métricas cambiaron a lo largo de los años en varios rankings (con claridad en Shanghai GRAS y THE). Antes de sumar o comparar pesos, comprueba de qué años son; una suma que mezcla versiones de la metodología no significa nada.
- Shanghai GRAS y QS por Disciplina son multidisciplinarios: sus métricas se repiten por disciplina. Agregarlas sin fijar una disciplina produce cifras infladas y sin sentido.

# Formato
La interfaz renderiza Markdown (GitHub Flavored Markdown).
- Usa **negrita** para las cifras y los nombres que importan. Los asteriscos van pegados al texto: `**así**`, nunca `** así **`.
- Presenta en una tabla cualquier comparación de dos o más universidades, métricas o años. Alinea a la derecha las columnas numéricas con `---:` en la fila de separación.
- Usa listas para enumeraciones y `código` para nombres exactos de métricas o identificadores.
- No abras la respuesta con un encabezado ni la cierres con un resumen de lo que acabas de decir."""


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

        lineas = [f"- `{f.id_ranking}` **{f.nombre_ranking}** ({f.nivel_ranking}): "
                  f"{f.metricas} métricas"
                  + (f" en {f.disciplinas} disciplinas" if (f.disciplinas or 0) > 1 else "")
                  + (f", {f.universidades} universidades con datos entre {f.desde} y {f.hasta}."
                     if f.desde else ", sin valores cargados.")
                  for f in filas]
        _contexto = (
            "\n\n# Qué hay cargado ahora mismo en la base de datos\n"
            f"{len(filas)} rankings, {totales.unis} universidades "
            f"({totales.paises} país/es) y {totales.cientificos} científicos.\n"
            + "\n".join(lineas)
            + "\nCualquier ranking, universidad, año o indicador fuera de esta lista no está en la "
              "base: para responder sobre eso hay que buscar en internet."
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

TOPE_FILAS = 300

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
    aviso = (f"\n[{len(filas)} filas en total; se muestran las primeras {TOPE_FILAS}. "
             "Acota la consulta para verlas todas.]") if len(filas) > TOPE_FILAS else ""
    return f"{cabecera}\n{cuerpo}{aviso}"


def _consulta(sql: str, params: dict, columnas: list[str], vacio: str) -> str:
    db = SessionLocal()
    try:
        return _tabla(db.execute(text(sql), params).fetchall(), columnas, vacio)
    finally:
        db.close()


# --- Herramientas: rankings y metodología -----------------------------------

def listar_rankings() -> str:
    """Lista los rankings cargados con su alcance: nivel, categoría, entidad que lo publica, cuántas métricas y universidades tiene y qué años cubre.

    Empieza por aquí cuando no sepas qué ranking usar o qué identificador tiene.
    """
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
    """Devuelve la descripción y la metodología completa de un ranking, más sus disciplinas y los años con datos.

    Úsala cuando pregunten qué mide un ranking, cómo pondera o en qué se
    diferencia de otro.

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
    """Busca métricas de un ranking: nombre, descripción, tipo, disciplina y peso, con los años en que rige cada peso.

    Un mismo indicador puede aparecer varias veces con pesos distintos porque la
    metodología cambió entre ediciones: la columna `anios_del_peso` dice a qué
    años corresponde cada valor. Filtra siempre que el ranking sea grande
    (Shanghai GRAS y QS por Disciplina tienen cientos de métricas).

    Args:
        ranking_id: ID del ranking (ver listar_rankings).
        texto: Fragmento del nombre o de la descripción de la métrica. Vacío para no filtrar por texto.
        disciplina: Disciplina exacta o fragmento (ej. "Physics"). Vacío para todas.
    """
    return _consulta(
        f"""
        SELECT m.id_metrica, m.nombre_metrica, m.disciplina, m.tipo_metrica, m.peso_metrica,
               string_agg(DISTINCT mu.anio_metrica::text, ', ' ORDER BY mu.anio_metrica::text) AS anios_del_peso,
               left(coalesce(m.descripcion_metrica, ''), 120) AS descripcion
        FROM metrica m
        LEFT JOIN metrica_universidad mu ON mu.id_metrica = m.id_metrica
        WHERE m.id_ranking = :rid
          AND ({_contiene('m.nombre_metrica', 'txt')}
               OR {_contiene('m.descripcion_metrica', 'txt')})
          AND {_contiene('m.disciplina', 'dis')}
        GROUP BY m.id_metrica, m.nombre_metrica, m.disciplina, m.tipo_metrica,
                 m.peso_metrica, m.descripcion_metrica
        ORDER BY m.disciplina, m.nombre_metrica
        """,
        {"rid": ranking_id, "txt": texto or "", "dis": disciplina or ""},
        ["id_metrica", "metrica", "disciplina", "tipo", "peso_%", "anios_del_peso", "descripcion"],
        "Ninguna métrica coincide con ese filtro. Prueba sin filtros o revisa el ranking con detalle_ranking.",
    )


# --- Herramientas: universidades y valores ----------------------------------

def buscar_universidades(texto: str = "", pais: str = "") -> str:
    """Busca universidades por nombre o país y devuelve su id, junto a en cuántos rankings tiene datos.

    Necesitas el id para casi todo lo demás. Basta un fragmento del nombre
    ("Católica", "Chile", "Concepción").

    Args:
        texto: Fragmento del nombre de la universidad. Vacío para listar todas.
        pais: País a filtrar (ej. "Chile"). Vacío para todos.
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
    """Devuelve los valores de las métricas de un ranking para un año, universidad por universidad.

    Es la consulta transversal: qué sacó cada universidad en cada indicador de
    una edición. Filtra por universidad, por métrica o por disciplina para no
    traer miles de filas.

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
        "No hay valores para esa combinación. Comprueba el año con detalle_ranking.",
    )


def consultar_tendencia(ranking_id: int, metrica_id: int, universidad_ids: str = "") -> str:
    """Obtiene la serie histórica (año, valor) de una métrica de un ranking para una o más universidades.

    Args:
        ranking_id: ID del ranking.
        metrica_id: ID de la métrica (ver buscar_metricas).
        universidad_ids: IDs de universidades separados por coma (ej. "1,22"). Vacío = todas las que tengan datos.
    """
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
         "uids": _ids(universidad_ids) or [0], "sin_u": not _ids(universidad_ids)},
        ["universidad", "anio", "valor"],
        "No hay datos para esa combinación de ranking, métrica y universidades.",
    )


def consultar_ranking_resumen(ranking_id: int, anio: int, disciplina: str = "") -> str:
    """Calcula el score total (suma ponderada de las métricas) por universidad para un ranking y año, de mayor a menor.

    En rankings multidisciplinarios (Shanghai GRAS, QS por Disciplina) hay que
    fijar `disciplina`: sin ella se suman todas las disciplinas a la vez y el
    resultado no significa nada.

    Args:
        ranking_id: ID del ranking.
        anio: Año a consultar.
        disciplina: Disciplina exacta o fragmento. Obligatoria en rankings multidisciplinarios.
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


# --- Herramientas: científicos ----------------------------------------------

def buscar_cientificos(texto: str = "", universidad_id: int = 0, campo: str = "",
                       ordenar_por: str = "composite_score", limite: int = 25) -> str:
    """Busca científicos del censo (World's Top 2% de Stanford/Elsevier y censo Scopus) con sus indicadores bibliométricos.

    Devuelve h-index, citas, artículos, ranking global y score compuesto.

    Args:
        texto: Fragmento del nombre del científico. Vacío para no filtrar.
        universidad_id: ID de universidad para filtrar. 0 = todas.
        campo: Campo o subcampo principal (ej. "Physics"). Vacío para todos.
        ordenar_por: Criterio: "composite_score", "h_index", "citas_totales", "num_articulos" o "rank_global".
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
    """Ejecuta una consulta SQL de solo lectura sobre las tablas académicas cuando las demás herramientas no bastan.

    Úsala para cruces, agregaciones o filtros que no cubren las otras
    herramientas (rankings donde una universidad subió, correlaciones entre
    indicadores, conteos por disciplina...). Es PostgreSQL. Una sola sentencia
    SELECT o WITH, sin punto y coma final. Pon siempre un LIMIT.

    Tablas y columnas disponibles:
      ranking(id_ranking, nombre_ranking, descripcion_ranking, nivel_ranking,
              categoria_ranking, pais_ranking, metodologia_ranking)
      universidad(id_universidad, nombre_universidad, pais_universidad)
      metrica(id_metrica, id_ranking, nombre_metrica, descripcion_metrica,
              tipo_metrica, peso_metrica, disciplina)
      metrica_universidad(id_metrica, id_universidad, valor_metrica, anio_metrica)
      cientifico(id_cientifico, nombre_cientifico, id_universidad, institucion_original,
                 campo_principal, subcampo_principal, anio_primera_publicacion,
                 anio_ultima_publicacion, pais_cientifico, orcid)
      cientifico_metrica(id_cientifico, anio_datos, fuente, rank_global, rank_global_ns,
                         h_index, hm_index, citas_totales, num_articulos, composite_score,
                         self_citation_pct)
      cientifico_topico(id_cientifico, topico, fuente, anio_datos, autor_documentos, topico_fwci)

    No existen para ti las tablas de usuarios, conversaciones, mensajes,
    notificaciones ni planes: la consulta se rechaza si las nombras.

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
