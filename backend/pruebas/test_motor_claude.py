# -*- coding: utf-8 -*-
"""Motor Claude: ciclo de herramientas, tope de llamadas y turnos pausados.

Se usa el SDK de Anthropic real —su `tool_runner` incluido— contra una API
simulada: un transporte de httpx que contesta con mensajes armados a mano y
guarda lo que recibe. Las herramientas son las de verdad y consultan la base
local. No sale ninguna petición ni se gasta saldo."""
import io
import json
import os
import sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Antes de importar el motor: el tope se lee al cargarlo.
os.environ["CLAUDE_MAX_CICLOS"] = "3"
os.environ.setdefault("ANTHROPIC_API_KEY", "clave-de-prueba")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)
from dotenv import load_dotenv
load_dotenv(os.path.join(RAIZ, ".env"))

import httpx
from anthropic import Anthropic

from app import assistant

fallos = []


def comprobar(nombre, cond, detalle=""):
    print(f"  [{'OK ' if cond else 'FALLA'}] {nombre}" + (f" -> {detalle}" if detalle and not cond else ""))
    if not cond:
        fallos.append(nombre)


def mensaje(contenido, motivo, entrada=100, salida=10, busquedas=0):
    uso = {"input_tokens": entrada, "output_tokens": salida}
    if busquedas:
        uso["server_tool_use"] = {"web_search_requests": busquedas}
    return {"id": "msg_prueba", "type": "message", "role": "assistant", "model": assistant.MODEL,
            "content": contenido, "stop_reason": motivo, "stop_sequence": None, "usage": uso}


def texto(t):
    return {"type": "text", "text": t}


def herramienta(id_, nombre="listar_rankings", argumentos=None):
    return {"type": "tool_use", "id": id_, "name": nombre, "input": argumentos or {}}


BUSQUEDA = [
    {"type": "server_tool_use", "id": "srvtoolu_1", "name": "web_search",
     "input": {"query": "metodología THE Latam 2026"}},
    {"type": "web_search_tool_result", "tool_use_id": "srvtoolu_1",
     "content": [{"type": "web_search_result", "url": "https://www.timeshighereducation.com/x",
                  "title": "Metodología", "encrypted_content": "cifrado", "page_age": None}]},
]


def conversar(guion, pregunta="¿Qué rankings hay?"):
    """Ejecuta un turno contra la API simulada. Devuelve (resultado, peticiones)."""
    respuestas = iter(guion)
    peticiones = []

    def api(peticion: httpx.Request) -> httpx.Response:
        peticiones.append(json.loads(peticion.content))
        try:
            return httpx.Response(200, json=next(respuestas))
        except StopIteration:
            return httpx.Response(500, json={"type": "error", "error": {
                "type": "api_error", "message": "la prueba no esperaba otra llamada"}})

    assistant._cliente = Anthropic(api_key="clave-de-prueba", max_retries=0,
                                   http_client=httpx.Client(transport=httpx.MockTransport(api)))
    return assistant.responder([{"role": "user", "content": pregunta}]), peticiones


VACIA = {"messages": [{"role": "assistant", "content": []}]}


def peticion(lista, i):
    """La petición i, o una vacía si no llegó a hacerse: así una llamada que
    falte se informa como falla en vez de detener la batería."""
    return lista[i] if len(lista) > i else VACIA


def resultados_de_herramienta(peticion):
    """Bloques tool_result del último mensaje de usuario de una petición."""
    ultimo = peticion["messages"][-1]
    return [b for b in ultimo["content"] if isinstance(b, dict) and b.get("type") == "tool_result"] \
        if ultimo["role"] == "user" and isinstance(ultimo["content"], list) else []


print(f"Tope de llamadas en esta prueba: {assistant.MAX_CICLOS}")

print("\n=== 1. Turno corriente: una herramienta y la respuesta ===")
r, pet = conversar([
    mensaje([herramienta("toolu_1")], "tool_use", 100, 10),
    mensaje([texto("Hay ocho rankings cargados.")], "end_turn", 300, 20),
])
comprobar("responde bien", r["ok"] and r["texto"] == "Hay ocho rankings cargados.", r)
comprobar("dos llamadas a la API", len(pet) == 2, len(pet))
comprobar("los tokens son la suma de las dos", (r["tokens_entrada"], r["tokens_salida"]) == (400, 30),
          (r["tokens_entrada"], r["tokens_salida"]))
res = resultados_de_herramienta(peticion(pet, 1))
comprobar("la segunda petición lleva el resultado de la herramienta, de la base real",
          len(res) == 1 and res[0]["tool_use_id"] == "toolu_1" and "THE Latam" in json.dumps(res[0]),
          res[:1])
comprobar("cada petición declara el tope al SDK, no a la API",
          all("max_iterations" not in p for p in pet), [list(p) for p in pet][:1])

print("\n=== 2. El tope de llamadas corta un modelo que no termina ===")
insistente = [mensaje([herramienta(f"toolu_{i}")], "tool_use", 100, 10) for i in range(10)]
r, pet = conversar(insistente)
comprobar(f"se detiene en {assistant.MAX_CICLOS} llamadas", len(pet) == assistant.MAX_CICLOS, len(pet))
comprobar("y lo dice, como turno fallido",
          not r["ok"] and f"más de {assistant.MAX_CICLOS} consultas" in r["texto"], r)
comprobar("los tokens gastados se informan igual",
          r["tokens_entrada"] == 100 * assistant.MAX_CICLOS, r["tokens_entrada"])

print("\n=== 3. Turno pausado: se reanuda en vez de entregarse a medias ===")
r, pet = conversar([
    mensaje([texto("Busco la metodología oficial."), *BUSQUEDA], "pause_turn", 200, 15, busquedas=1),
    mensaje([texto("Según el sitio de THE, Teaching pesa 29,5 %.")], "end_turn", 400, 30),
], pregunta="¿Cuánto pesa Teaching en THE?")
comprobar("dos llamadas: la pausada y la que la completa", len(pet) == 2, len(pet))
ultimo = peticion(pet, 1)["messages"][-1]
comprobar("la segunda reenvía el turno pausado tal cual, como mensaje del asistente",
          ultimo["role"] == "assistant"
          and [b["type"] for b in ultimo["content"]] == ["text", "server_tool_use", "web_search_tool_result"],
          ultimo)
comprobar("la respuesta junta lo dicho antes y después de la pausa",
          r["ok"] and r["texto"].startswith("Busco la metodología oficial.")
          and r["texto"].endswith("Teaching pesa 29,5 %."), r["texto"])
comprobar("cuenta la búsqueda y los tokens de ambas llamadas",
          (r["busquedas"], r["tokens_entrada"], r["tokens_salida"]) == (1, 600, 45),
          (r["busquedas"], r["tokens_entrada"], r["tokens_salida"]))

print("\n=== 4. Pausa, herramienta y respuesta: el historial sigue al runner ===")
r, pet = conversar([
    mensaje([*BUSQUEDA], "pause_turn", 200, 15, busquedas=1),
    mensaje([herramienta("toolu_9")], "tool_use", 300, 10),
    mensaje([texto("Listo.")], "end_turn", 400, 5),
])
comprobar("tres llamadas", len(pet) == 3, len(pet))
res = resultados_de_herramienta(peticion(pet, 2))
comprobar("la tercera lleva el resultado de la herramienta pedida tras la pausa",
          len(res) == 1 and res[0]["tool_use_id"] == "toolu_9", res[:1])
comprobar("y conserva antes el turno pausado",
          any(m["role"] == "assistant" and any(isinstance(b, dict) and b.get("type") == "server_tool_use"
                                               for b in m["content"])
              for m in peticion(pet, 2)["messages"]))
comprobar("responde bien", r["ok"] and r["texto"] == "Listo.", r)

print("\n=== 5. Las pausas cuentan contra el mismo tope ===")
r, pet = conversar([mensaje([*BUSQUEDA], "pause_turn", 100, 5, busquedas=1) for _ in range(10)])
comprobar(f"un turno que no deja de pausarse para en {assistant.MAX_CICLOS}",
          len(pet) == assistant.MAX_CICLOS and not r["ok"], (len(pet), r["ok"]))

print("\n=== 6. Un rechazo no ejecuta herramientas ===")
r, pet = conversar([mensaje([herramienta("toolu_r")], "refusal", 100, 5)])
comprobar("una sola llamada", len(pet) == 1, len(pet))
comprobar("se informa como rechazo", not r["ok"] and "declinó" in r["texto"], r)

print("=" * 62)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
