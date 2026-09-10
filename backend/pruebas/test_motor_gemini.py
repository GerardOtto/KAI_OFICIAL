# -*- coding: utf-8 -*-
"""Ejercita el motor Gemini sin llamar a la API: sustituye el cliente por un
doble que devuelve objetos reales del SDK. Verifica el ciclo de herramientas,
la contabilidad de tokens, el tope de ciclos y la traducción de errores."""
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# La raíz del backend se resuelve desde la ubicación de este archivo, no desde una
# ruta de una máquina concreta: es lo que permite ejecutar la batería en otro
# equipo y en integración continua.
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from dotenv import load_dotenv

load_dotenv(os.path.join(RAIZ, ".env"))
from google.genai import errors as genai_errors
from google.genai import types

from app import assistant_gemini as g
from app.herramientas import POR_NOMBRE

os.environ["GEMINI_API_KEY"] = "clave-de-prueba"   # solo para pasar configurado()

fallos = []


def comprobar(nombre, condicion, detalle=""):
    print(f"  [{'OK ' if condicion else 'FALLA'}] {nombre}" + (f" -> {detalle}" if detalle and not condicion else ""))
    if not condicion:
        fallos.append(nombre)


def uso(entrada, salida):
    return types.GenerateContentResponseUsageMetadata(
        prompt_token_count=entrada, candidates_token_count=salida)


def respuesta_con_llamada(nombre, args, entrada=100, salida=10):
    return types.GenerateContentResponse(
        candidates=[types.Candidate(
            content=types.Content(role="model", parts=[types.Part.from_function_call(name=nombre, args=args)]),
            finish_reason=types.FinishReason.STOP)],
        usage_metadata=uso(entrada, salida))


def respuesta_texto(texto, entrada=200, salida=50, motivo=types.FinishReason.STOP):
    return types.GenerateContentResponse(
        candidates=[types.Candidate(
            content=types.Content(role="model", parts=[types.Part.from_text(text=texto)]),
            finish_reason=motivo)],
        usage_metadata=uso(entrada, salida))


class ClienteDoble:
    """Devuelve respuestas prefijadas y guarda lo que se le envió."""

    def __init__(self, guion):
        self.guion = list(guion)
        self.peticiones = []
        self.models = self

    def generate_content(self, *, model, contents, config):
        self.peticiones.append({"model": model, "contents": contents, "config": config})
        siguiente = self.guion.pop(0)
        if isinstance(siguiente, Exception):
            raise siguiente
        return siguiente


def con_cliente(guion):
    doble = ClienteDoble(guion)
    g.cliente = lambda: doble
    return doble


original = g.cliente

print("\n=== 1. Ciclo de herramientas y contabilidad de tokens ===")
doble = con_cliente([
    respuesta_con_llamada("listar_rankings", {}, entrada=100, salida=10),
    respuesta_con_llamada("buscar_metricas", {"ranking_id": 1}, entrada=300, salida=20),
    respuesta_texto("THE Latam tiene 13 métricas.", entrada=500, salida=40),
])
r = g.responder([{"role": "user", "content": "¿Cuántas métricas tiene THE Latam?"}])
comprobar("responde ok", r["ok"], r["texto"])
comprobar("texto correcto", r["texto"] == "THE Latam tiene 13 métricas.", r["texto"])
comprobar("suma tokens de entrada de las 3 llamadas (900)", r["tokens_entrada"] == 900, r["tokens_entrada"])
comprobar("suma tokens de salida de las 3 llamadas (70)", r["tokens_salida"] == 70, r["tokens_salida"])
comprobar("motor y modelo en la respuesta",
          r["motor"] == "gemini" and r["modelo"] == g.MODEL, f"{r['motor']}/{r['modelo']}")
comprobar("hizo exactamente 3 llamadas", len(doble.peticiones) == 3, len(doble.peticiones))

# El historial que se envía en la última llamada debe contener, en orden:
# pregunta, llamada 1, resultado 1, llamada 2, resultado 2.
ultimo = doble.peticiones[-1]["contents"]
comprobar("historial acumulado de 5 turnos", len(ultimo) == 5, len(ultimo))
comprobar("los resultados de herramienta van como function_response",
          all(p.function_response is not None for p in ultimo[2].parts))
resultado_1 = ultimo[2].parts[0].function_response.response["resultado"]
comprobar("la herramienta consultó la base de datos de verdad",
          "THE" in resultado_1 or ":" in resultado_1, resultado_1[:80])

print("\n=== 2. Los roles se traducen al vocabulario de Gemini ===")
doble = con_cliente([respuesta_texto("Hola.")])
g.responder([
    {"role": "user", "content": "hola"},
    {"role": "assistant", "content": "buenas"},
    {"role": "user", "content": "otra vez"},
])
roles = [c.role for c in doble.peticiones[0]["contents"]]
comprobar("assistant -> model", roles == ["user", "model", "user"], roles)

print("\n=== 3. Instrucción de sistema y herramientas en la configuración ===")
cfg = doble.peticiones[0]["config"]
comprobar("lleva la instrucción de sistema compartida", "KAI" in (cfg.system_instruction or ""))
comprobar("declara todas las herramientas de consulta",
          len(cfg.tools[0].function_declarations) == len(POR_NOMBRE),
          f"{len(cfg.tools[0].function_declarations)} declaradas frente a {len(POR_NOMBRE)} definidas")
comprobar("desactiva la ejecución automática del SDK",
          cfg.automatic_function_calling.disable is True)

print("\n=== 4. Un fallo de herramienta vuelve al modelo, no rompe el turno ===")
doble = con_cliente([
    # ranking_id no numérico: la conversión de tipos falla en la propia base.
    # (`universidad_ids` ya no sirve para provocarlo: al ampliar el conjunto de
    # herramientas se pasó a extraer los números del texto e ignorar el resto,
    # de modo que "PUCV" no revienta, simplemente no filtra por universidad.)
    respuesta_con_llamada("detalle_ranking", {"ranking_id": "el de Shanghai"}),
    respuesta_texto("Corrijo: necesito el id numérico."),
])
r = g.responder([{"role": "user", "content": "tendencia"}])
comprobar("el turno termina bien pese al fallo de la herramienta", r["ok"], r["texto"])
enviado = doble.peticiones[-1]["contents"][2].parts[0].function_response.response["resultado"]
comprobar("el error se le devuelve al modelo", enviado.startswith("ERROR"), enviado[:60])

print("\n=== 5. Herramienta inexistente ===")
doble = con_cliente([
    respuesta_con_llamada("herramienta_inventada", {}),
    respuesta_texto("Vale."),
])
r = g.responder([{"role": "user", "content": "x"}])
enviado = doble.peticiones[-1]["contents"][2].parts[0].function_response.response["resultado"]
comprobar("se informa de que no existe", "no existe" in enviado, enviado)

print("\n=== 6. Tope de ciclos ===")
con_cliente([respuesta_con_llamada("listar_rankings", {}) for _ in range(g.MAX_CICLOS + 2)])
r = g.responder([{"role": "user", "content": "bucle"}])
comprobar("corta el bucle infinito", not r["ok"] and "más de" in r["texto"], r["texto"])
comprobar("cobra igual lo consumido en el bucle", r["tokens_entrada"] > 0, r["tokens_entrada"])

print("\n=== 7. Motivos de corte ===")
for motivo, esperado in [
    (types.FinishReason.SAFETY, "filtros de seguridad"),
    (types.FinishReason.PROHIBITED_CONTENT, "políticas de uso"),
    (types.FinishReason.MALFORMED_FUNCTION_CALL, "Claude"),
]:
    con_cliente([types.GenerateContentResponse(
        candidates=[types.Candidate(content=types.Content(role="model", parts=[]), finish_reason=motivo)],
        usage_metadata=uso(10, 0))])
    r = g.responder([{"role": "user", "content": "x"}])
    comprobar(f"{motivo.name} -> mensaje propio", not r["ok"] and esperado in r["texto"], r["texto"])

con_cliente([respuesta_texto("Respuesta a medio", motivo=types.FinishReason.MAX_TOKENS)])
r = g.responder([{"role": "user", "content": "x"}])
comprobar("MAX_TOKENS con texto: se entrega avisando",
          r["ok"] and "cortada por longitud" in r["texto"], r["texto"])

print("\n=== 8. Traducción de errores de la API ===")


def error_api(codigo, mensaje, estado="ERROR"):
    return genai_errors.ClientError(
        codigo, {"error": {"code": codigo, "message": mensaje, "status": estado}})


casos = [
    (403, "API key not valid", "clave de la API de Gemini no es válida"),
    (404, "models/x is not found", "no existe o no está disponible"),
    (429, "Resource has been exhausted: quota", "cuota de la API de Gemini"),
    (429, "too many requests", "demasiadas solicitudes"),
    (400, "billing account required", "facturación activa"),
    (400, "invalid argument", "parámetros inválidos"),
]
for codigo, mensaje, esperado in casos:
    # El guion repite el mismo error: un 429 con la búsqueda web declarada hace
    # que el motor reintente el turno sin ella, y un 503 que reintente sin más,
    # de modo que un guion de un solo elemento se agotaría a mitad. Repetirlo es
    # además lo que ocurre de verdad: un fallo del proveedor no se cura porque el
    # cliente vuelva a preguntar.
    con_cliente([error_api(codigo, mensaje) for _ in range(6)])
    r = g.responder([{"role": "user", "content": "x"}])
    comprobar(f"{codigo} '{mensaje[:22]}'", not r["ok"] and esperado in r["texto"], r["texto"])

con_cliente([genai_errors.ServerError(503, {"error": {"code": 503, "message": "overloaded"}})
             for _ in range(6)])
r = g.responder([{"role": "user", "content": "x"}])
comprobar("503 -> servicio caído", not r["ok"] and "caído o sobrecargado" in r["texto"], r["texto"])

# El 503 se reintenta antes de rendirse, porque en el nivel gratuito es
# frecuente y transitorio: si el segundo intento va bien, el turno sale adelante.
doble = con_cliente([genai_errors.ServerError(503, {"error": {"code": 503, "message": "overloaded"}}),
                     respuesta_texto("A la segunda funcionó.")])
r = g.responder([{"role": "user", "content": "x"}])
comprobar("un 503 pasajero se reintenta en vez de rendirse",
          r["ok"] and "segunda" in r["texto"], r["texto"])
comprobar("el reintento es una llamada más, no un turno nuevo",
          len(doble.peticiones) == 2, len(doble.peticiones))

con_cliente([RuntimeError("algo raro")])
r = g.responder([{"role": "user", "content": "x"}])
comprobar("excepción inesperada no se propaga", not r["ok"] and "RuntimeError" in r["texto"], r["texto"])

print("\n=== 9. Sin clave configurada ===")
g.cliente = original
del os.environ["GEMINI_API_KEY"]
guardado = os.environ.pop("GOOGLE_API_KEY", None)
r = g.responder([{"role": "user", "content": "x"}])
comprobar("avisa de que falta la clave", not r["ok"] and "GEMINI_API_KEY" in r["texto"], r["texto"])
comprobar("no está disponible", not g.configurado())
if guardado:
    os.environ["GOOGLE_API_KEY"] = guardado

print("\n" + "=" * 60)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
