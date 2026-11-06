# -*- coding: utf-8 -*-
"""La respuesta en vivo del asistente (`/chat/stream`).

Tres niveles, de abajo arriba:
  1. Motor Gemini en streaming, con un doble del cliente que entrega la
     respuesta en trozos: eventos, contabilidad, firmas y reintentos.
  2. Motor Claude en streaming, con el SDK real —su `tool_runner` incluido—
     contra una API simulada que contesta en SSE, como la de verdad.
  3. El endpoint de punta a punta, con sesión, base y plan reales: validaciones
     antes del flujo, eventos en orden, `fin` idéntico a `/chat`, el plan
     aplicado en el hilo del turno y el turno guardado aunque el cliente se vaya.

No sale ninguna petición a un proveedor ni se gasta saldo."""
import io
import json
import os
import sys
import time
import uuid

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Antes de importar los motores: se leen al cargarlos. Sin esperas entre
# reintentos, para que la batería no tarde lo que tardan ellas.
os.environ["GEMINI_ESPERAS_503"] = "0,0,0"
os.environ.setdefault("ANTHROPIC_API_KEY", "clave-de-prueba")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
from dotenv import load_dotenv

load_dotenv(os.path.join(RAIZ, ".env"))
os.environ["GEMINI_API_KEY"] = os.environ.get("GEMINI_API_KEY") or "clave-de-prueba"

import httpx
from anthropic import Anthropic
from fastapi.testclient import TestClient
from google.genai import errors as genai_errors
from google.genai import types
from sqlalchemy import text

from app import assistant, assistant_gemini as g, auth, herramientas
from app.db import SessionLocal
from app.main import app

fallos = []


def comprobar(nombre, condicion, detalle=""):
    print(f"  [{'OK ' if condicion else 'FALLA'}] {nombre}" + ("" if condicion else f" -> {detalle}"))
    if not condicion:
        fallos.append(nombre)


def textos(eventos):
    """El texto que vería el usuario al final: los trozos desde el último reinicio."""
    visto = ""
    for e in eventos:
        if e["tipo"] == "reinicio":
            visto = ""
        elif e["tipo"] == "texto":
            visto += e["delta"]
    return visto


# --- 1. Motor Gemini ----------------------------------------------------------

def trozo(*partes, entrada=None, salida=None, motivo=None):
    return types.GenerateContentResponse(
        candidates=[types.Candidate(content=types.Content(role="model", parts=list(partes)),
                                    finish_reason=motivo)],
        usage_metadata=(types.GenerateContentResponseUsageMetadata(
            prompt_token_count=entrada, candidates_token_count=salida) if entrada is not None else None))


def error_503():
    return genai_errors.ServerError(503, {"error": {"code": 503, "message": "high demand",
                                                    "status": "UNAVAILABLE"}})


class GeminiEnTrozos:
    """Cada elemento del guion es una llamada: una lista de trozos, en la que un
    error se lanza al llegar a él (a mitad del flujo, si hay trozos antes)."""

    def __init__(self, guion):
        self.guion = list(guion)
        self.peticiones = []
        self.vedados = []
        self.models = self

    def generate_content_stream(self, *, model, contents, config):
        self.peticiones.append({"model": model, "contents": list(contents)})
        self.vedados.append(herramientas._vedados.get())
        llamada = self.guion.pop(0)

        def flujo():
            for t in llamada:
                if isinstance(t, Exception):
                    raise t
                yield t
        return flujo()

    def generate_content(self, *, model, contents, config):
        raise AssertionError("con `emitir` no debía usarse la llamada sin streaming")


def gemini_con(guion):
    doble = GeminiEnTrozos(guion)
    g.cliente = lambda: doble
    return doble


print("=== 1. Gemini: herramienta, texto en trozos y cierre ===")
doble = gemini_con([
    [trozo(types.Part.from_text(text="Voy a revisar la base."), entrada=10, salida=1),
     trozo(types.Part(function_call=types.FunctionCall(name="listar_rankings", args={}),
                      thought_signature=b"firma-de-prueba"), entrada=100, salida=10)],
    [trozo(types.Part.from_text(text="Hay "), entrada=300, salida=5),
     trozo(types.Part.from_text(text="ocho rankings "), entrada=300, salida=12),
     trozo(types.Part.from_text(text="cargados."), entrada=300, salida=20,
           motivo=types.FinishReason.STOP)],
])
eventos = []
r = g.responder([{"role": "user", "content": "¿Qué rankings hay?"}], eventos.append)
tipos = [e["tipo"] for e in eventos]
comprobar("responde bien", r["ok"] and r["texto"] == "Hay ocho rankings cargados.", r)
comprobar("cada llamada empieza con un reinicio", tipos[0] == "reinicio" and tipos.count("reinicio") == 2,
          tipos)
comprobar("avisa de la herramienta con su etiqueta",
          {"tipo": "estado", "texto": herramientas.ETIQUETAS["listar_rankings"]} in eventos, eventos)
comprobar("avisa al volver a analizar", {"tipo": "estado", "texto": herramientas.ANALIZANDO} in eventos,
          eventos)
comprobar("el texto llega en tres trozos",
          [e["delta"] for e in eventos if e["tipo"] == "texto"][-3:] == ["Hay ", "ocho rankings ", "cargados."],
          eventos)
comprobar("lo que queda a la vista es la respuesta, sin el «voy a revisar»",
          textos(eventos) == r["texto"], textos(eventos))
comprobar("los tokens son los del último trozo de cada llamada (100+300 / 10+20)",
          (r["tokens_entrada"], r["tokens_salida"]) == (400, 30), (r["tokens_entrada"], r["tokens_salida"]))
partes_modelo = doble.peticiones[1]["contents"][1].parts
comprobar("la firma de razonamiento vuelve intacta en la vuelta siguiente",
          any(p.thought_signature == b"firma-de-prueba" for p in partes_modelo),
          [p.thought_signature for p in partes_modelo])
resultado_1 = doble.peticiones[1]["contents"][2].parts[0].function_response.response["resultado"]
comprobar("la herramienta se ejecutó de verdad", "THE" in resultado_1, resultado_1[:80])

print("\n=== 2. Gemini: un 503 a mitad del flujo se reintenta y se borra lo mostrado ===")
gemini_con([
    [trozo(types.Part.from_text(text="Respuesta a med"), entrada=50, salida=3), error_503()],
    [trozo(types.Part.from_text(text="Respuesta completa."), entrada=50, salida=4,
           motivo=types.FinishReason.STOP)],
])
eventos = []
r = g.responder([{"role": "user", "content": "x"}], eventos.append)
comprobar("el turno sale bien", r["ok"] and r["texto"] == "Respuesta completa.", r)
comprobar("a la vista queda solo el intento bueno", textos(eventos) == "Respuesta completa.", eventos)

print("\n=== 3. Gemini: sin `emitir` no cambia nada ===")
gemini_con([])
g.cliente().generate_content = lambda **_: trozo(types.Part.from_text(text="Igual que antes."),
                                                 entrada=1, salida=1, motivo=types.FinishReason.STOP)
r = g.responder([{"role": "user", "content": "x"}])
comprobar("usa la llamada de siempre", r["ok"] and r["texto"] == "Igual que antes.", r)


# --- 2. Motor Claude ----------------------------------------------------------

def sse_de(msg, trozos_de_texto=3):
    """Un mensaje de la API de Anthropic, entregado como lo entrega en streaming."""
    eventos = [("message_start", {"type": "message_start", "message": {
        **msg, "content": [], "stop_reason": None,
        "usage": {"input_tokens": msg["usage"]["input_tokens"], "output_tokens": 0}}})]
    for i, b in enumerate(msg["content"]):
        if b["type"] == "text":
            eventos.append(("content_block_start", {"type": "content_block_start", "index": i,
                                                    "content_block": {"type": "text", "text": ""}}))
            paso = max(1, len(b["text"]) // trozos_de_texto + 1)
            for k in range(0, len(b["text"]), paso):
                eventos.append(("content_block_delta", {"type": "content_block_delta", "index": i, "delta": {
                    "type": "text_delta", "text": b["text"][k:k + paso]}}))
        elif b["type"] in ("tool_use", "server_tool_use"):
            eventos.append(("content_block_start", {"type": "content_block_start", "index": i,
                                                    "content_block": {**b, "input": {}}}))
            eventos.append(("content_block_delta", {"type": "content_block_delta", "index": i, "delta": {
                "type": "input_json_delta", "partial_json": json.dumps(b["input"])}}))
        else:
            eventos.append(("content_block_start", {"type": "content_block_start", "index": i,
                                                    "content_block": b}))
        eventos.append(("content_block_stop", {"type": "content_block_stop", "index": i}))
    eventos.append(("message_delta", {"type": "message_delta",
                                      "delta": {"stop_reason": msg["stop_reason"], "stop_sequence": None},
                                      "usage": {"output_tokens": msg["usage"]["output_tokens"]}}))
    eventos.append(("message_stop", {"type": "message_stop"}))
    cuerpo = "".join(f"event: {n}\ndata: {json.dumps(d)}\n\n" for n, d in eventos)
    return httpx.Response(200, headers={"content-type": "text/event-stream"}, content=cuerpo.encode())


def mensaje(contenido, motivo, entrada=100, salida=10):
    return {"id": "msg_prueba", "type": "message", "role": "assistant", "model": assistant.MODEL,
            "content": contenido, "stop_reason": motivo, "stop_sequence": None,
            "usage": {"input_tokens": entrada, "output_tokens": salida}}


def claude_en_vivo(guion):
    respuestas = iter(guion)
    peticiones = []

    def api(peticion: httpx.Request) -> httpx.Response:
        cuerpo = json.loads(peticion.content)
        peticiones.append(cuerpo)
        if not cuerpo.get("stream"):
            return httpx.Response(400, json={"type": "error", "error": {
                "type": "invalid_request_error", "message": "se esperaba stream=true"}})
        try:
            return sse_de(next(respuestas))
        except StopIteration:
            return httpx.Response(500, json={"type": "error", "error": {
                "type": "api_error", "message": "la prueba no esperaba otra llamada"}})

    assistant._cliente = Anthropic(api_key="clave-de-prueba", max_retries=0,
                                   http_client=httpx.Client(transport=httpx.MockTransport(api)))
    eventos = []
    r = assistant.responder([{"role": "user", "content": "¿Qué rankings hay?"}], eventos.append)
    return r, eventos, peticiones


print("\n=== 4. Claude: herramienta, búsqueda web y texto en varios bloques ===")
r, eventos, pet = claude_en_vivo([
    mensaje([{"type": "text", "text": "Consulto la base."},
             {"type": "tool_use", "id": "toolu_1", "name": "listar_rankings", "input": {}}],
            "tool_use", 100, 10),
    mensaje([{"type": "server_tool_use", "id": "srvtoolu_1", "name": "web_search",
              "input": {"query": "THE Latam 2026"}},
             {"type": "web_search_tool_result", "tool_use_id": "srvtoolu_1",
              "content": [{"type": "web_search_result", "url": "https://www.timeshighereducation.com/x",
                           "title": "Metodología", "encrypted_content": "cifrado", "page_age": None}]},
             {"type": "text", "text": "Hay ocho rankings cargados."},
             {"type": "text", "text": "THE publicó su edición 2026."}],
            "end_turn", 300, 20),
])
comprobar("responde bien", r["ok"] and r["texto"] == "Hay ocho rankings cargados.\n\nTHE publicó su edición 2026.",
          r)
comprobar("todas las llamadas fueron en streaming", len(pet) == 2 and all(p.get("stream") for p in pet),
          [p.get("stream") for p in pet])
comprobar("avisa de la herramienta de datos",
          {"tipo": "estado", "texto": herramientas.ETIQUETAS["listar_rankings"]} in eventos, eventos)
comprobar("avisa de la búsqueda en internet",
          {"tipo": "estado", "texto": herramientas.ETIQUETAS["web_search"]} in eventos, eventos)
comprobar("el «consulto la base» se muestra y se retira al pedir la herramienta",
          [e["tipo"] for e in eventos].index("texto") < eventos.index({"tipo": "reinicio"}), eventos)
comprobar("lo que queda a la vista coincide con la respuesta, bloques incluidos",
          textos(eventos) == r["texto"], repr(textos(eventos)))
comprobar("los tokens son la suma de las dos llamadas",
          (r["tokens_entrada"], r["tokens_salida"]) == (400, 30), (r["tokens_entrada"], r["tokens_salida"]))
comprobar("la segunda llamada lleva el resultado de la base real",
          "THE Latam" in json.dumps(pet[-1]["messages"][-1]), str(pet[-1]["messages"][-1])[:200])


# --- 3. El endpoint -----------------------------------------------------------

def leer_eventos(respuesta):
    eventos = []
    for linea in respuesta.iter_lines():
        if linea.startswith("data: "):
            eventos.append(json.loads(linea[len("data: "):]))
    return eventos


def guion_de_turno(texto_final):
    return [
        [trozo(types.Part.from_function_call(name="buscar_universidades", args={"texto": "Católica"}),
               entrada=1000, salida=50)],
        [trozo(types.Part.from_text(text=texto_final[:10]), entrada=2000, salida=60),
         trozo(types.Part.from_text(text=texto_final[10:]), entrada=2000, salida=150,
               motivo=types.FinishReason.STOP)],
    ]


cliente = TestClient(app)
correo = f"prueba-en-vivo-{uuid.uuid4().hex[:8]}@pucv.cl"
CLAVE = "Prueba12345!"
id_usuario = None

try:
    print("\n=== 5. Sesión real con el plan gratuito ===")
    r = cliente.post("/auth/registro", json={"nombre": "Prueba En Vivo", "correo": correo, "clave": CLAVE,
                                             "institucion": "Pontificia Universidad Catolica de Valparaiso"})
    comprobar("registro", r.status_code in (200, 201), f"{r.status_code} {r.text[:200]}")
    db = SessionLocal()
    id_usuario = db.execute(text("SELECT id_usuario FROM usuario WHERE correo_usuario = :c"),
                            {"c": correo}).scalar()
    db.execute(text("UPDATE usuario SET plan_usuario = (SELECT codigo_plan FROM plan "
                    "WHERE publico ORDER BY orden LIMIT 1), google_sub = :g WHERE id_usuario = :u"),
               {"u": id_usuario, "g": f"prueba-{uuid.uuid4().hex}"})
    db.commit()
    db.close()
    cabeceras = {"Authorization": f"Bearer {auth.crear_token(id_usuario, correo)[0]}"}

    print("\n=== 6. Los rechazos llegan antes del flujo, con su código ===")
    r = cliente.post("/chat/stream", headers=cabeceras, json={"mensaje": "   ", "motor": "gemini"})
    comprobar("mensaje vacío -> 400", r.status_code == 400, f"{r.status_code} {r.text[:120]}")
    r = cliente.post("/chat/stream", json={"mensaje": "hola", "motor": "gemini"})
    comprobar("sin sesión -> 401", r.status_code == 401, f"{r.status_code} {r.text[:120]}")

    print("\n=== 7. Un turno completo en vivo ===")
    respuesta_esperada = "La PUCV aparece en los rankings cargados."
    doble = gemini_con(guion_de_turno(respuesta_esperada))
    with cliente.stream("POST", "/chat/stream", headers=cabeceras,
                        json={"mensaje": "¿Qué sabes de la Católica de Valparaíso?", "motor": "gemini"}) as r:
        comprobar("responde 200 como flujo SSE",
                  r.status_code == 200 and r.headers["content-type"].startswith("text/event-stream"),
                  f"{r.status_code} {r.headers.get('content-type')}")
        comprobar("sin compresión que lo acumule", "gzip" not in r.headers.get("content-encoding", ""),
                  r.headers.get("content-encoding"))
        eventos = leer_eventos(r)
    tipos = [e["tipo"] for e in eventos]
    comprobar("avisa de la búsqueda de universidades antes del texto",
              tipos.index("estado") < tipos.index("texto"), tipos)
    comprobar("el último evento es `fin`", tipos[-1] == "fin", tipos)
    fin = eventos[-1]
    comprobar("`fin` trae la respuesta completa y correcta",
              fin.get("ok") is True and fin.get("content") == respuesta_esperada, str(fin)[:250])
    comprobar("`fin` trae lo mismo que /chat: conversación, uso y cuota",
              isinstance(fin.get("id_conversacion"), int) and fin["uso"]["tokens_entrada"] == 3000
              and "cuota" in fin and fin["motor"] == "gemini", str(fin)[:250])
    comprobar("el texto en vivo coincide con el de `fin`", textos(eventos) == fin["content"],
              textos(eventos))
    comprobar("el plan se aplicó en el hilo del turno (THE y QS vedados)",
              len(doble.vedados) == 2 and all(v and v == doble.vedados[0] for v in doble.vedados),
              doble.vedados)
    id_conversacion = fin["id_conversacion"]
    r = cliente.get(f"/conversaciones/{id_conversacion}", headers=cabeceras)
    mensajes = r.json().get("mensajes", [])
    comprobar("el turno quedó guardado (pregunta y respuesta)",
              [m["rol"] for m in mensajes] == ["user", "assistant"]
              and mensajes[-1]["contenido"] == respuesta_esperada, str(mensajes)[:200])

    print("\n=== 8. Lo mismo vale para /chat: misma regla de plan ===")
    vedados_en_vivo = doble.vedados[0]
    capturado = []
    g.cliente().generate_content = lambda **_: (capturado.append(herramientas._vedados.get()) or trozo(
        types.Part.from_text(text="Hola."), entrada=1, salida=1, motivo=types.FinishReason.STOP))
    r = cliente.post("/chat", headers=cabeceras, json={"mensaje": "hola", "motor": "gemini"})
    comprobar("/chat sigue respondiendo entero", r.status_code == 200 and r.json()["content"] == "Hola.",
              r.text[:200])
    comprobar("y con los mismos rankings vedados", capturado == [vedados_en_vivo], (capturado, vedados_en_vivo))

    print("\n=== 9. Un fallo del proveedor llega como `fin` con ok falso y no deja rastro ===")
    gemini_con([[error_503()] for _ in range((len(g.ESPERAS_TRAS_503) + 1) * len(g.MODELOS))])
    with cliente.stream("POST", "/chat/stream", headers=cabeceras,
                        json={"mensaje": "esto va a fallar", "motor": "gemini"}) as r:
        eventos = leer_eventos(r)
    fin = eventos[-1] if eventos else {}
    comprobar("`fin` con ok falso y el motivo",
              fin.get("tipo") == "fin" and fin.get("ok") is False and "503" in fin.get("content", ""),
              str(fin)[:250])
    comprobar("la conversación nueva no queda creada", fin.get("id_conversacion") is None, str(fin)[:120])

    print("\n=== 10. Si el cliente se va a mitad, el turno se termina y se guarda ===")
    respuesta_esperada = "Respuesta que el cliente no esperó a leer."
    gemini_con(guion_de_turno(respuesta_esperada))
    db = SessionLocal()
    antes = db.execute(text("SELECT count(*) FROM conversacion WHERE id_usuario = :u"),
                       {"u": id_usuario}).scalar()
    db.close()
    with cliente.stream("POST", "/chat/stream", headers=cabeceras,
                        json={"mensaje": "me voy enseguida", "motor": "gemini"}) as r:
        for linea in r.iter_lines():
            if linea.startswith("data: "):
                break   # primer evento y fuera
    guardada = None
    for _ in range(50):
        db = SessionLocal()
        guardada = db.execute(text(
            "SELECT m.contenido FROM mensaje m JOIN conversacion c USING (id_conversacion) "
            "WHERE c.id_usuario = :u AND m.rol = 'assistant' AND m.contenido = :t"),
            {"u": id_usuario, "t": respuesta_esperada}).scalar()
        despues = db.execute(text("SELECT count(*) FROM conversacion WHERE id_usuario = :u"),
                             {"u": id_usuario}).scalar()
        db.close()
        if guardada:
            break
        time.sleep(0.1)
    comprobar("la respuesta se guardó igual", guardada == respuesta_esperada, guardada)
    comprobar("en una conversación nueva", despues == antes + 1, (antes, despues))

finally:
    print("\n=== 11. Limpieza ===")
    db = SessionLocal()
    try:
        if id_usuario:
            db.execute(text("DELETE FROM mensaje WHERE id_conversacion IN "
                            "(SELECT id_conversacion FROM conversacion WHERE id_usuario = :u)"),
                       {"u": id_usuario})
            db.execute(text("DELETE FROM conversacion WHERE id_usuario = :u"), {"u": id_usuario})
            db.execute(text("DELETE FROM notificacion WHERE id_usuario = :u"), {"u": id_usuario})
            db.execute(text("DELETE FROM usuario WHERE id_usuario = :u"), {"u": id_usuario})
            db.commit()
        queda = db.execute(text("SELECT count(*) FROM usuario WHERE correo_usuario = :c"),
                           {"c": correo}).scalar()
        comprobar("el usuario de prueba se borró", queda == 0, f"quedan {queda}")
    finally:
        db.close()

print("\n" + "=" * 60)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
