"""Ejercita el ciclo del motor Gemini con el proveedor simulado.

Lo que se comprueba es el código propio —cómo se declaran las herramientas, cómo
se atienden las llamadas, cómo se cuentan tokens y búsquedas, cómo se recorre la
cadena de modelos y qué pasa cuando la cuota de búsqueda se agota—, no la API de
Google. Las herramientas de datos sí se ejecutan de verdad contra la base.

El acceso a internet es una herramienta que el modelo pide, no una capacidad
declarada en todas las peticiones: buena parte de esta batería vigila justamente
esa frontera.
"""
import os
import sys
import time
import types as pytypes

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from dotenv import load_dotenv

load_dotenv(os.path.join(RAIZ, ".env"))
from google.genai import errors as genai_errors

from app import assistant_gemini as g

fallos = []


def comprobar(nombre, condicion, detalle=""):
    print(f"  [{'OK ' if condicion else 'FALLA'}] {nombre}" + ("" if condicion else f" -> {detalle}"))
    if not condicion:
        fallos.append(nombre)


class Uso:
    def __init__(self, entrada, salida, pensamiento=0):
        self.prompt_token_count = entrada
        self.candidates_token_count = salida
        self.thoughts_token_count = pensamiento
        self.tool_use_prompt_token_count = 0


class Llamada:
    def __init__(self, name, args):
        self.name, self.args = name, args


class Candidato:
    def __init__(self, finish="STOP", busquedas=()):
        self.finish_reason = finish
        self.content = pytypes.SimpleNamespace(role="model", parts=[])
        self.grounding_metadata = (pytypes.SimpleNamespace(web_search_queries=list(busquedas))
                                   if busquedas else None)


class Respuesta:
    def __init__(self, texto="", llamadas=(), entrada=100, salida=50, busquedas=()):
        self.text = texto
        self.function_calls = list(llamadas)
        self.usage_metadata = Uso(entrada, salida)
        self.candidates = [Candidato(busquedas=busquedas)]


class ClienteFalso:
    """Devuelve una respuesta preparada por llamada y guarda lo que recibió."""

    def __init__(self, guion):
        self.guion = list(guion)
        self.peticiones = []
        self.models = pytypes.SimpleNamespace(generate_content=self._generar)

    def _generar(self, model, contents, config):
        self.peticiones.append({"model": model, "contents": contents, "config": config})
        siguiente = self.guion.pop(0)
        if isinstance(siguiente, Exception):
            raise siguiente
        return siguiente


def con_cliente(guion):
    falso = ClienteFalso(guion)
    g.cliente = lambda: falso
    return falso


def error(codigo, mensaje):
    clase = genai_errors.ServerError if codigo >= 500 else genai_errors.ClientError
    e = clase.__new__(clase)
    e.code, e.message = codigo, mensaje
    return e


def sin_suspension():
    g._web_suspendida_hasta = 0.0


cliente_real = g.cliente
MENSAJE = [{"role": "user", "content": "¿Qué rankings tienes?"}]

print("=== 1. Turno normal: el modelo llama a una herramienta de datos y responde ===")
sin_suspension()
falso = con_cliente([
    Respuesta(llamadas=[Llamada("listar_rankings", {})], entrada=1200, salida=40),
    Respuesta(texto="Hay 7 rankings cargados.", entrada=1800, salida=120),
])
r = g.responder(MENSAJE)
comprobar("responde correctamente", r["ok"] and "7 rankings" in r["texto"], str(r)[:200])
comprobar("suma los tokens de las dos llamadas", r["tokens_entrada"] == 3000 and r["tokens_salida"] == 160,
          f"{r['tokens_entrada']}/{r['tokens_salida']}")
comprobar("hizo dos llamadas a la API", len(falso.peticiones) == 2, str(len(falso.peticiones)))
comprobar("informa del modelo que respondió", r["modelo"] == falso.peticiones[0]["model"],
          f"{r['modelo']} / {falso.peticiones[0]['model']}")

primera = falso.peticiones[0]["config"]
herramientas = primera.tools[0]
comprobar("la petición corriente NO declara la búsqueda de Google",
          herramientas.google_search is None and herramientas.url_context is None)
comprobar("declara las 11 herramientas de datos más la de internet",
          len(herramientas.function_declarations) == 12, str(len(herramientas.function_declarations)))
comprobar("una de ellas es buscar_en_internet",
          any(d.name == g.BUSQUEDA for d in herramientas.function_declarations))
comprobar("no se envía configuración de herramientas de servidor", primera.tool_config is None)
comprobar("el prompt de sistema incluye el panorama de datos",
          "Shanghai GRAS" in primera.system_instruction and "internet" in primera.system_instruction.lower())
comprobar("el resultado real de la herramienta llegó al modelo",
          any("THE Latam" in str(p) for c in falso.peticiones[1]["contents"] for p in getattr(c, "parts", [])),
          "no se encontró la salida de listar_rankings en el segundo turno")
comprobar("una consulta a la base no gasta búsquedas", r["busquedas"] == 0, str(r["busquedas"]))

print("\n=== 2. La búsqueda en internet es una llamada aparte ===")
sin_suspension()
falso = con_cliente([
    Respuesta(llamadas=[Llamada(g.BUSQUEDA, {"consulta": "QS 2026 metodologia"})], entrada=1000, salida=30),
    Respuesta(texto="QS publicó la edición 2026 en junio.", entrada=500, salida=80,
              busquedas=["QS 2026 metodologia", "QS ranking 2026"]),
    Respuesta(texto="Según el sitio de QS, la edición 2026 salió en junio.", entrada=2000, salida=100),
])
r = g.responder(MENSAJE)
comprobar("el turno termina bien", r["ok"] and "junio" in r["texto"], str(r)[:200])
comprobar("fueron tres llamadas: modelo, búsqueda y redacción", len(falso.peticiones) == 3,
          str(len(falso.peticiones)))

busqueda = falso.peticiones[1]["config"]
comprobar("la llamada de búsqueda sí declara las integradas de Google",
          busqueda.tools[0].google_search is not None and busqueda.tools[0].url_context is not None)
comprobar("y no lleva las funciones de datos",
          not busqueda.tools[0].function_declarations)
comprobar("lleva su propia instrucción, no la del asistente",
          "menos de 250 palabras" in busqueda.system_instruction)
comprobar("busca lo que pidió el modelo", falso.peticiones[1]["contents"] == "QS 2026 metodologia",
          str(falso.peticiones[1]["contents"]))
comprobar("el resultado de la búsqueda vuelve al modelo como resultado de herramienta",
          any("edición 2026 en junio" in str(p) for c in falso.peticiones[2]["contents"]
              for p in getattr(c, "parts", [])))
comprobar("cuenta las búsquedas que informó el servidor", r["busquedas"] == 2, str(r["busquedas"]))
comprobar("cobra también los tokens de la búsqueda",
          r["tokens_entrada"] == 3500 and r["tokens_salida"] == 210,
          f"{r['tokens_entrada']}/{r['tokens_salida']}")

print("\n=== 3. Sin cuota de búsqueda, el turno sigue adelante ===")
sin_suspension()
falso = con_cliente([
    Respuesta(llamadas=[Llamada(g.BUSQUEDA, {"consulta": "algo"})]),
    error(429, "You exceeded your current quota"),
    Respuesta(texto="No pude consultar internet; con la base tengo esto."),
])
r = g.responder(MENSAJE)
comprobar("el turno no se pierde por falta de cuota de búsqueda",
          r["ok"] and "con la base" in r["texto"], str(r)[:200])
comprobar("al modelo se le dice que internet no está disponible",
          any("cuota agotada" in str(p) for c in falso.peticiones[2]["contents"]
              for p in getattr(c, "parts", [])))
comprobar("la búsqueda queda suspendida un rato", g._web_suspendida_hasta > time.time())
comprobar("una búsqueda fallida no se cuenta como búsqueda", r["busquedas"] == 0, str(r["busquedas"]))

# Mientras dura la suspensión ni siquiera se intenta: sería una llamada perdida.
falso = con_cliente([
    Respuesta(llamadas=[Llamada(g.BUSQUEDA, {"consulta": "otra cosa"})]),
    Respuesta(texto="Respondo con la base."),
])
r = g.responder(MENSAJE)
comprobar("suspendida, no se gasta una llamada en preguntar",
          len(falso.peticiones) == 2 and r["ok"], str(len(falso.peticiones)))
sin_suspension()

print("\n=== 4. Un fallo de la búsqueda tampoco tumba el turno ===")
sin_suspension()
falso = con_cliente([
    Respuesta(llamadas=[Llamada(g.BUSQUEDA, {"consulta": "algo"})]),
    error(400, "Invalid argument"),
    Respuesta(texto="Sigo con lo que hay en la base."),
])
r = g.responder(MENSAJE)
comprobar("el error de la búsqueda vuelve al modelo y el turno termina",
          r["ok"] and "base" in r["texto"], str(r)[:200])
comprobar("un 400 de la búsqueda no suspende la cuota", g._web_suspendida_hasta <= time.time())

print("\n=== 5. Cadena de modelos ===")
sin_suspension()
comprobar("hay más de un modelo configurado", len(g.MODELOS) >= 2, str(g.MODELOS))
intentos = len(g.ESPERAS_TRAS_503) + 1
falso = con_cliente([
    *[error(503, "high demand") for _ in range(intentos)],
    Respuesta(llamadas=[Llamada("listar_rankings", {})]),
    Respuesta(texto="Con el modelo de respaldo."),
])
r = g.responder(MENSAJE)
comprobar("si el primer modelo se agota, se pasa al siguiente",
          r["ok"] and "respaldo" in r["texto"], str(r)[:200])
modelos_usados = [p["model"] for p in falso.peticiones]
comprobar("el primero se intentó las veces previstas",
          modelos_usados[:intentos] == [g.MODELOS[0]] * intentos, str(modelos_usados))
comprobar("el segundo modelo es el siguiente de la cadena",
          modelos_usados[intentos] == g.MODELOS[1], str(modelos_usados))
# Cambiar de modelo a mitad de turno invalidaría las firmas de razonamiento del
# historial, así que una vez que uno responde, el turno se queda con él.
comprobar("el resto del turno se queda con el modelo que respondió",
          modelos_usados[intentos:] == [g.MODELOS[1]] * (len(modelos_usados) - intentos),
          str(modelos_usados))
comprobar("el resultado informa del modelo que de verdad respondió",
          r["modelo"] == g.MODELOS[1], f"{r['modelo']} / {g.MODELOS[1]}")

falso = con_cliente([error(503, "high demand") for _ in range(intentos * len(g.MODELOS) + 2)])
r = g.responder(MENSAJE)
comprobar("si fallan todos los modelos se avisa al usuario",
          not r["ok"] and "sobrecargado" in r["texto"], str(r)[:200])
comprobar("y se dice que se probó con todos", "modelos configurados" in r["texto"], r["texto"][:200])

print("\n=== 6. Tope de ciclos: el modelo que no para ===")
sin_suspension()
con_cliente([Respuesta(llamadas=[Llamada("listar_rankings", {})]) for _ in range(g.MAX_CICLOS + 2)])
r = g.responder(MENSAJE)
comprobar("corta y avisa", not r["ok"] and str(g.MAX_CICLOS) in r["texto"], str(r)[:200])

print("\n=== 7. Una herramienta que falla no tumba el turno ===")
sin_suspension()
con_cliente([
    Respuesta(llamadas=[Llamada("detalle_ranking", {"ranking_id": "no es un numero"})]),
    Respuesta(texto="Ese ranking no existe."),
])
r = g.responder(MENSAJE)
comprobar("el error de la herramienta vuelve al modelo y el turno termina bien",
          r["ok"] and "no existe" in r["texto"], str(r)[:200])

print("\n=== 8. Una herramienta desconocida se le explica al modelo ===")
sin_suspension()
falso = con_cliente([
    Respuesta(llamadas=[Llamada("herramienta_inventada", {})]),
    Respuesta(texto="Uso otra."),
])
r = g.responder(MENSAJE)
comprobar("el modelo recibe el error en vez de quedarse sin respuesta",
          any("no existe" in str(p) for c in falso.peticiones[1]["contents"]
              for p in getattr(c, "parts", [])))

g.cliente = cliente_real
print("\n" + "=" * 60)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
