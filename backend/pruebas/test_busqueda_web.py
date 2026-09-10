"""Ejercita el ciclo del motor Gemini con el proveedor simulado.

Lo que se comprueba es el código propio —cómo se declaran las herramientas, cómo
se atienden las llamadas, cómo se cuentan tokens y búsquedas y qué pasa si el
proveedor rechaza la combinación con la búsqueda web—, no la API de Google, que
además está sin cuota diaria. Las herramientas sí se ejecutan de verdad contra la
base de datos.
"""
import os
import sys
import types as pytypes

import os
import sys

# La raíz del backend se resuelve desde la ubicación de este archivo, no desde una
# ruta de una máquina concreta: es lo que permite ejecutar la batería en otro
# equipo y en integración continua.
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
        self.peticiones.append({"model": model, "contents": list(contents), "config": config})
        siguiente = self.guion.pop(0)
        if isinstance(siguiente, Exception):
            raise siguiente
        return siguiente


def con_cliente(guion):
    falso = ClienteFalso(guion)
    g.cliente = lambda: falso
    return falso


cliente_real = g.cliente
MENSAJE = [{"role": "user", "content": "¿Qué rankings tienes?"}]

print("=== 1. Turno normal: el modelo llama a una herramienta y responde ===")
falso = con_cliente([
    Respuesta(llamadas=[Llamada("listar_rankings", {})], entrada=1200, salida=40),
    Respuesta(texto="Hay 7 rankings cargados.", entrada=1800, salida=120),
])
r = g.responder(MENSAJE)
comprobar("responde correctamente", r["ok"] and "7 rankings" in r["texto"], str(r)[:200])
comprobar("suma los tokens de las dos llamadas", r["tokens_entrada"] == 3000 and r["tokens_salida"] == 160,
          f"{r['tokens_entrada']}/{r['tokens_salida']}")
comprobar("hizo dos llamadas a la API", len(falso.peticiones) == 2, str(len(falso.peticiones)))

primera = falso.peticiones[0]["config"]
herramientas = primera.tools[0]
comprobar("declara la búsqueda de Google", herramientas.google_search is not None)
comprobar("declara el contexto de URL", herramientas.url_context is not None)
comprobar("declara las 10 herramientas propias en el mismo objeto Tool",
          len(herramientas.function_declarations) == 10, str(len(herramientas.function_declarations)))
comprobar("activa la circulación del contexto de servidor",
          primera.tool_config is not None and primera.tool_config.include_server_side_tool_invocations is True)
comprobar("el prompt de sistema incluye el panorama de datos",
          "Shanghai GRAS" in primera.system_instruction and "internet" in primera.system_instruction.lower())
comprobar("el resultado real de la herramienta llegó al modelo",
          any("THE Latam" in str(p) for c in falso.peticiones[1]["contents"] for p in getattr(c, "parts", [])),
          "no se encontró la salida de listar_rankings en el segundo turno")

print("\n=== 2. Se cuentan las búsquedas web del servidor ===")
con_cliente([Respuesta(texto="Según QS...", busquedas=["QS 2026 ranking", "QS metodologia"])])
r = g.responder(MENSAJE)
comprobar("cuenta las dos búsquedas", r["busquedas"] == 2, str(r["busquedas"]))

print("\n=== 3. Las herramientas de servidor no se intentan ejecutar aquí ===")
# Si el servidor devolviera su propia invocación mezclada, no debe tratarse como
# una herramienta propia inexistente.
con_cliente([Respuesta(texto="Listo.", llamadas=[Llamada("google_search", {"q": "x"})])])
r = g.responder(MENSAJE)
comprobar("ignora la llamada de servidor y devuelve el texto",
          r["ok"] and r["texto"] == "Listo.", str(r)[:200])

print("\n=== 4. Repliegue si el proveedor rechaza la combinación ===")
g._combinacion_admitida = None


def error400(mensaje):
    e = genai_errors.ClientError.__new__(genai_errors.ClientError)
    e.code, e.message = 400, mensaje
    return e


falso = con_cliente([
    error400("Tool use with function_declarations is not supported with google_search for this model."),
    Respuesta(texto="Respondo solo con la base de datos.", entrada=900, salida=60),
])
r = g.responder(MENSAJE)
comprobar("se repliega y responde igualmente", r["ok"] and "base de datos" in r["texto"], str(r)[:200])
comprobar("la segunda petición ya va sin búsqueda web",
          falso.peticiones[1]["config"].tools[0].google_search is None)
comprobar("recuerda el rechazo para no repetirlo", g._combinacion_admitida is False)

falso = con_cliente([Respuesta(texto="Segunda consulta.")])
g.responder(MENSAJE)
comprobar("el turno siguiente ya no intenta la combinación",
          falso.peticiones[0]["config"].tools[0].google_search is None)
g._combinacion_admitida = None  # se restaura para el resto de las pruebas

print("\n=== 5. Un 400 corriente no desactiva la búsqueda ===")
falso = con_cliente([error400("Invalid value at 'contents': too long.")])
r = g.responder(MENSAJE)
comprobar("devuelve el error al usuario", not r["ok"], str(r)[:160])
comprobar("no marca la combinación como no admitida", g._combinacion_admitida is not False,
          str(g._combinacion_admitida))

print("\n=== 6. Tope de ciclos: el modelo que no para ===")
g._combinacion_admitida = None
con_cliente([Respuesta(llamadas=[Llamada("listar_rankings", {})]) for _ in range(g.MAX_CICLOS + 2)])
r = g.responder(MENSAJE)
comprobar("corta y avisa", not r["ok"] and str(g.MAX_CICLOS) in r["texto"], str(r)[:200])

print("\n=== 7. Una herramienta que falla no tumba el turno ===")
g._combinacion_admitida = None
con_cliente([
    Respuesta(llamadas=[Llamada("detalle_ranking", {"ranking_id": "no es un numero"})]),
    Respuesta(texto="Ese ranking no existe."),
])
r = g.responder(MENSAJE)
comprobar("el error de la herramienta vuelve al modelo y el turno termina bien",
          r["ok"] and "no existe" in r["texto"], str(r)[:200])

g.cliente = cliente_real
print("\n" + "=" * 60)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
