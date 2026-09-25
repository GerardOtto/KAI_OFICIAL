# -*- coding: utf-8 -*-
"""Vigila lo que se reenvía al modelo en cada vuelta del ciclo de herramientas.

La entrada es lo que domina el consumo del asistente: el 56 % de los tokens de
un día medido eran el bloque fijo —instrucción de sistema más declaración de las
herramientas— reenviado en cada vuelta. Un párrafo añadido aquí no cuesta un
párrafo: cuesta un párrafo por vuelta y por turno.

Por eso esta batería pone presupuestos y falla cuando se superan. No pretende
que el texto sea bueno, solo que nadie lo engorde sin darse cuenta. Los tamaños
se miden en caracteres, no en tokens, para no depender de la API: la proporción
medida sobre estos mismos textos es de 3,9 caracteres por token.
"""
import io
import os
import sys
from collections import namedtuple

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

from dotenv import load_dotenv
load_dotenv(os.path.join(RAIZ, ".env"))

from app import conversaciones as conv  # noqa: E402
from app import herramientas as h  # noqa: E402

fallos = []


def comprobar(nombre, condicion, detalle=""):
    print(f"  [{'OK ' if condicion else 'FALLA'}] {nombre}" + (f" -> {detalle}" if detalle and not condicion else ""))
    if not condicion:
        fallos.append(nombre)


CAR_POR_TOKEN = 3.9
def tokens(texto):  # noqa: E302
    return round(len(texto) / CAR_POR_TOKEN)


print("=== 1. Presupuesto del bloque fijo ===")
# El techo es el tamaño que tenía el bloque fijo antes de esta poda: 3.777 tokens
# medidos con el tokenizador del modelo, ~3.600 con el proxy de caracteres que se
# usa aquí. El bloque puede crecer —`comparar_universidades` costó 232 tokens de
# declaración y los recuperó de sobra en vueltas ahorradas—, pero no hasta
# deshacer el ahorro: si alguien vuelve a pasar de ahí, esto falla y obliga a
# justificar el cambio con el número de vueltas que evita.
sistema = h.system_prompt()
descripciones = "".join(t.description or "" for t in h.TOOLS)
esquemas = "".join(str(t.input_schema) for t in h.TOOLS)
fijo = sistema + descripciones + esquemas

print(f"    sistema {len(sistema):,} car. (~{tokens(sistema)} tokens) · "
      f"descripciones {len(descripciones):,} · esquemas {len(esquemas):,}")
comprobar("la instrucción de sistema cabe en el presupuesto",
          len(sistema) <= 6600, f"{len(sistema)} caracteres")
comprobar("las descripciones de las herramientas caben en el presupuesto",
          len(descripciones) <= 5200, f"{len(descripciones)} caracteres")
comprobar("el bloque fijo no supera el tamaño que tenía antes de la poda",
          tokens(fijo) <= 3550, f"~{tokens(fijo)} tokens (techo 3.550)")

print("\n=== 2. Lo que evita vueltas enteras ===")
comprobar("se pide agrupar las consultas en una misma vuelta",
          "misma vuelta" in sistema and "multiplica el costo" in sistema)
comprobar("se prohíbe repetir una consulta ya respondida",
          "No repitas una consulta" in sistema)
comprobar("se pide acotar los filtros antes de consultar", "Acota los filtros" in sistema)
comprobar("el panorama trae los identificadores de los rankings",
          "`1`" in sistema and "rankings," in sistema)
comprobar("y los de las universidades más consultadas",
          "Identificadores de las universidades" in sistema
          and "Universidad de Chile" in sistema)
comprobar("con la instrucción de no gastar una consulta en averiguarlos",
          "no gastes una consulta" in sistema)

print("\n=== 3. La consulta SQL conoce el esquema real ===")
sql = next(t for t in h.TOOLS if t.name == "consulta_sql").description
for columna in ("pondera", "id_metrica_padre", "valor_metrica", "composite_score"):
    comprobar(f"el esquema declara {columna}", columna in sql)
comprobar("no se ofrecen las tablas de personas usuarias",
          "conversacion(" not in sql and "usuario(" not in sql)

print("\n=== 4. Tope de filas de un resultado ===")
Fila = namedtuple("Fila", "a b")
muchas = [Fila(f"universidad {i}", i) for i in range(h.TOPE_FILAS + 40)]
salida = h._tabla(muchas, ["universidad", "valor"], "vacío")
lineas = salida.splitlines()
comprobar("el tope es bastante menor que el antiguo de 300",
          h.TOPE_FILAS <= 120, h.TOPE_FILAS)
comprobar("se recorta al tope", len([l for l in lineas if " | " in l]) == h.TOPE_FILAS + 1,
          len(lineas))
comprobar("se avisa de cuántas filas había", f"{len(muchas)} filas en total" in salida)
comprobar("y se empuja a filtrar en vez de a pedir el resto",
          "Filtra por" in salida and "se reenvía" in salida)
pocas = h._tabla([Fila("x", 1)], ["universidad", "valor"], "vacío")
comprobar("un resultado corto no lleva aviso", "filas en total" not in pocas, pocas)

print("\n=== 5. Ventana e historial recortado ===")
comprobar("la ventana es la mitad de la anterior", conv.VENTANA_MENSAJES <= 10,
          conv.VENTANA_MENSAJES)


class DobleDeBase:
    """Devuelve mensajes inventados sin tocar PostgreSQL."""

    def __init__(self, mensajes):
        self.mensajes = mensajes
        self.limite = None

    def execute(self, _sql, params):
        self.limite = params["n"]
        Msg = namedtuple("Msg", "rol contenido")
        return type("R", (), {
            "fetchall": lambda _s: [Msg(r, c) for r, c in self.mensajes[-params["n"]:]]
        })()


largo = "tabla | de | resultados\n" * 120        # respuesta antigua, muy larga
corto = "¿Y en 2023?"
mensajes = [("user", corto), ("assistant", largo)] * 6      # 12 mensajes
doble = DobleDeBase(mensajes)
historial = conv.historial_para_modelo(doble, 1)

comprobar("se piden solo los mensajes de la ventana", doble.limite == conv.VENTANA_MENSAJES,
          doble.limite)
comprobar("se devuelven en orden y con su papel",
          historial[-1]["role"] == "assistant" and historial[0]["role"] == "user")
intactos = historial[-conv.MENSAJES_INTACTOS:]
comprobar("los últimos mensajes van completos",
          all(m["content"] in (corto, largo) for m in intactos))
antiguos = historial[:-conv.MENSAJES_INTACTOS]
recortados = [m for m in antiguos if m["content"].endswith("…]")]
comprobar("las respuestas antiguas y largas se recortan",
          len(recortados) == len([m for m in antiguos if m["role"] == "assistant"]),
          f"{len(recortados)} de {len(antiguos)}")
comprobar("el recorte se anuncia en el propio mensaje",
          all("recortada para ahorrar contexto" in m["content"] for m in recortados))
comprobar("una pregunta corta antigua no se toca",
          all(m["content"] == corto for m in antiguos if m["role"] == "user"))
comprobar("recortar ahorra de verdad",
          sum(len(m["content"]) for m in historial) < len(largo) * 5,
          sum(len(m["content"]) for m in historial))

ahorro = 1 - sum(len(m["content"]) for m in historial) / sum(len(c) for _, c in mensajes)
print(f"    historial enviado: {sum(len(m['content']) for m in historial):,} car. "
      f"de {sum(len(c) for _, c in mensajes):,} ({ahorro:.0%} menos)")

print("\n=== 6. Los callejones sin salida devuelven la salida ===")
# Este es el ahorro más grande medido: una consulta que no encuentra nada obliga
# al modelo a probar otro identificador, y cada intento es una vuelta entera. En
# la traza real, «índice de citas» llevó a una métrica sin valores y el modelo
# encadenó quince vueltas buscando la buena. Ahora el propio fallo trae la lista.
sin_coincidencias = h.buscar_metricas(1, "Citations")
comprobar("una búsqueda sin coincidencias sugiere las métricas con datos",
          "con valores cargados son" in sin_coincidencias, sin_coincidencias[:120])
comprobar("y las sugiere con su identificador", "`" in sin_coincidencias)

solo_vacias = h.buscar_metricas(1, "cita")
comprobar("si lo que coincide no tiene valores, también lo dice",
          "no tiene valores cargados" in solo_vacias or "con valores cargados son" in solo_vacias,
          solo_vacias[:120])

normal = h.buscar_metricas(1)
comprobar("la búsqueda normal sigue devolviendo la tabla",
          normal.startswith("id_metrica | metrica"), normal[:60])
comprobar("con la columna de años renombrada a lo que de verdad significa",
          "anios_con_datos" in normal)
cabecera, primera = normal.splitlines()[0], normal.splitlines()[1]
comprobar("las métricas con datos van primero",
          primera.split(" | ")[cabecera.split(" | ").index("anios_con_datos")].strip() != "",
          primera[:80])

tendencia = h.consultar_tendencia(1, 5, "2")
# La salida puede ser la lista de métricas con datos o directamente la serie del
# pilar que agrupa a la pedida (sección 7). Lo que no puede es ser un «no hay
# nada» a secas: eso obliga al modelo a probar otra vez, y otra vuelta del ciclo
# cuesta más que cualquiera de estas dos respuestas.
comprobar("una tendencia vacía nunca es un callejón sin salida",
          "con valores cargados son" in tendencia or "el pilar que la agrupa" in tendencia,
          tendencia[:120])
valores = h.consultar_valores(1, 1800, "2")
comprobar("un año sin valores dice el año y sugiere alternativas",
          "1800" in valores and "valores cargados" in valores, valores[:120])

print("\n=== 7. El nivel agregado, cuando el indicador fino no tiene valores ===")
# THE Latam publica «Citation impact» en su metodología, pero los valores están
# cargados en el pilar «Research Quality», que lo agrupa. Sugerir alternativas no
# bastaba: el modelo seguía probando sinónimos —cuatro búsquedas seguidas en la
# traza—, así que ahora se le nombra el pilar y se le devuelve su serie.
busqueda = h.buscar_metricas(1, "Citation")
comprobar("la búsqueda nombra el pilar que sí tiene los datos",
          "Research Quality" in busqueda and "1694" in busqueda, busqueda[:120])
comprobar("y explica por qué el indicador pedido está vacío",
          "no tiene valores cargados" in busqueda)

serie = h.consultar_tendencia(1, 9, "2")
comprobar("pedir la serie del indicador vacío devuelve la del pilar",
          "Research Quality" in serie and "2019" in serie, serie[:120])
comprobar("con el aviso de que la cifra es la del pilar",
          "di que la cifra es la del pilar" in serie)
comprobar("y con la serie de verdad, no solo el aviso",
          len([l for l in serie.splitlines() if " | " in l]) > 3, serie[:80])

huerfana = h.consultar_tendencia(2, 999999, "2")
comprobar("una métrica inexistente no inventa un pilar",
          "No hay datos" in huerfana, huerfana[:100])

print("\n=== 8. Una comparación completa en una sola llamada ===")
# El patrón dominante de las preguntas reales —«quién está mejor», «cómo
# evolucionó»— exigía encadenar buscar_metricas, consultar_valores y
# consultar_tendencia: tres vueltas como mínimo, doce en la traza medida.
comparacion = h.comparar_universidades(1, "2,55", "2019,2024")
lineas = comparacion.splitlines()
comprobar("la leyenda nombra las universidades comparadas",
          "u2 = " in lineas[0] and "u55 = " in lineas[0], lineas[0][:80])
comprobar("hay una columna por universidad y año",
          all(c in lineas[1] for c in ("u2·2019", "u2·2024", "u55·2019", "u55·2024")), lineas[1])
comprobar("las métricas van por peso descendente",
          float(lineas[2].split(" | ")[1]) >= float(lineas[-2].split(" | ")[1]), lineas[2][:60])
comprobar("incluye el score ponderado, que es lo que responde «quién está mejor»",
          "SCORE PONDERADO" in comparacion)
comprobar("y solo suma las métricas que ponderan", "solo métricas que ponderan" in comparacion)
comprobar("cabe en pocos cientos de caracteres", len(comparacion) < 1200, len(comparacion))

por_defecto = h.comparar_universidades(1, "2")
comprobar("sin años pedidos se toma solo el más reciente",
          por_defecto.splitlines()[1].count("·") == 1, por_defecto.splitlines()[1])
comprobar("sin identificadores se explica cómo obtenerlos",
          "identificador" in h.comparar_universidades(1, ""))
comprobar("una universidad sin datos no revienta la tabla",
          "No hay valores" in h.comparar_universidades(1, "999"))

print("\n" + "=" * 60)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
