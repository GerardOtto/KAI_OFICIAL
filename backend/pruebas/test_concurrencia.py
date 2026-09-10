"""Comportamiento bajo peticiones simultáneas, que el informe consignaba sin verificar.

Interesa sobre todo una propiedad que la ejecución secuencial no puede revelar: si
el tope diario de consultas se comprueba y se consume sin exclusión mutua, varias
peticiones simultáneas pueden leer el mismo recuento y superarlo entre todas.
"""
import os
import sys
import types as pytypes
import uuid
from concurrent.futures import ThreadPoolExecutor

import os
import sys

# La raíz del backend se resuelve desde la ubicación de este archivo, no desde una
# ruta de una máquina concreta: es lo que permite ejecutar la batería en otro
# equipo y en integración continua.
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from dotenv import load_dotenv

load_dotenv(os.path.join(RAIZ, ".env"))
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import assistant_gemini as g
from app.db import SessionLocal
from app.main import app

fallos = []


def comprobar(nombre, condicion, detalle=""):
    print(f"  [{'OK ' if condicion else 'FALLA'}] {nombre}" + ("" if condicion else f" -> {detalle}"))
    if not condicion:
        fallos.append(nombre)


# --- Proveedor simulado, sin estado compartido entre hilos ------------------

class Uso:
    prompt_token_count = 1000
    candidates_token_count = 100
    thoughts_token_count = 0
    tool_use_prompt_token_count = 0


class Respuesta:
    def __init__(self, texto):
        self.text = texto
        self.function_calls = []
        self.usage_metadata = Uso()
        self.candidates = [pytypes.SimpleNamespace(
            finish_reason="STOP",
            content=pytypes.SimpleNamespace(role="model", parts=[]),
            grounding_metadata=None)]


class ClienteFalso:
    def __init__(self):
        self.models = pytypes.SimpleNamespace(
            generate_content=lambda model, contents, config: Respuesta("Respuesta de prueba."))


g.cliente = lambda: ClienteFalso()
g.configurado = lambda: True

cliente = TestClient(app)
correo = f"prueba-concurrencia-{uuid.uuid4().hex[:8]}@ejemplo.test"
CLAVE = "Prueba12345!"
TOPE_DIARIO = 5
SIMULTANEAS = 12
id_usuario = None
codigo_plan = f"prueba-{uuid.uuid4().hex[:6]}"

try:
    r = cliente.post("/auth/registro", json={"nombre": "Prueba Concurrencia",
                                             "correo": correo, "clave": CLAVE})
    assert r.status_code in (200, 201), r.text
    token = r.json()["token"]
    cabeceras = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    id_usuario = db.execute(text("SELECT id_usuario FROM usuario WHERE correo_usuario = :c"),
                            {"c": correo}).scalar()
    # Plan propio con un tope diario pequeño, para provocar la carrera.
    db.execute(text("""
        INSERT INTO plan (codigo_plan, nombre_plan, mensajes_por_dia, descripcion,
                          precio_mensual_usd, tokens_claude_mes, tokens_gemini_mes, publico, orden)
        VALUES (:c, 'Prueba concurrencia', :tope, 'plan temporal de prueba', 0, 0, 10000000, false, 99)
    """), {"c": codigo_plan, "tope": TOPE_DIARIO})
    db.execute(text("UPDATE usuario SET plan_usuario = :c WHERE id_usuario = :u"),
               {"c": codigo_plan, "u": id_usuario})
    db.commit()
    db.close()

    print(f"=== 1. {SIMULTANEAS} peticiones simultáneas con un tope diario de {TOPE_DIARIO} ===")

    def enviar(n):
        r = cliente.post("/chat", headers=cabeceras,
                         json={"mensaje": f"consulta simultánea {n}", "motor": "gemini"})
        return r.status_code

    with ThreadPoolExecutor(max_workers=SIMULTANEAS) as pool:
        codigos = list(pool.map(enviar, range(SIMULTANEAS)))

    aceptadas = codigos.count(200)
    rechazadas = codigos.count(429)
    errores = [c for c in codigos if c not in (200, 429)]
    print(f"    aceptadas: {aceptadas} | rechazadas con 429: {rechazadas} | otros: {errores}")

    comprobar("ninguna petición produce un error del servidor", not errores, str(errores))
    comprobar("todas las peticiones reciben respuesta", len(codigos) == SIMULTANEAS, str(len(codigos)))
    comprobar(f"no se superó el tope diario de {TOPE_DIARIO}", aceptadas <= TOPE_DIARIO,
              f"se aceptaron {aceptadas}, {aceptadas - TOPE_DIARIO} de más")

    print("\n=== 2. La base refleja exactamente lo aceptado ===")
    db = SessionLocal()
    turnos = db.execute(text("""
        SELECT count(*) FROM mensaje m
        JOIN conversacion c ON c.id_conversacion = m.id_conversacion
        WHERE c.id_usuario = :u AND m.rol = 'assistant'
    """), {"u": id_usuario}).scalar()
    conversaciones = db.execute(text("SELECT count(*) FROM conversacion WHERE id_usuario = :u"),
                                {"u": id_usuario}).scalar()
    huerfanas = db.execute(text("""
        SELECT count(*) FROM conversacion c
        WHERE c.id_usuario = :u
          AND NOT EXISTS (SELECT 1 FROM mensaje m WHERE m.id_conversacion = c.id_conversacion)
    """), {"u": id_usuario}).scalar()
    db.close()
    print(f"    respuestas guardadas: {turnos} | conversaciones: {conversaciones} | vacías: {huerfanas}")
    comprobar("hay una respuesta guardada por cada petición aceptada", turnos == aceptadas,
              f"{turnos} respuestas frente a {aceptadas} aceptadas")
    comprobar("no quedan conversaciones vacías", huerfanas == 0, str(huerfanas))

    print("\n=== 3. Cada petición abrió su propia conversación aislada ===")
    comprobar("una conversación por petición aceptada", conversaciones == aceptadas,
              f"{conversaciones} conversaciones frente a {aceptadas} aceptadas")

finally:
    print("\n=== 4. Limpieza ===")
    db = SessionLocal()
    try:
        if id_usuario:
            db.execute(text("DELETE FROM mensaje WHERE id_conversacion IN "
                            "(SELECT id_conversacion FROM conversacion WHERE id_usuario = :u)"),
                       {"u": id_usuario})
            db.execute(text("DELETE FROM conversacion WHERE id_usuario = :u"), {"u": id_usuario})
            db.execute(text("DELETE FROM notificacion WHERE id_usuario = :u"), {"u": id_usuario})
            db.execute(text("DELETE FROM usuario WHERE id_usuario = :u"), {"u": id_usuario})
        db.execute(text("DELETE FROM plan WHERE codigo_plan = :c"), {"c": codigo_plan})
        db.commit()
        queda = db.execute(text("SELECT count(*) FROM usuario WHERE correo_usuario = :c"),
                           {"c": correo}).scalar()
        queda_plan = db.execute(text("SELECT count(*) FROM plan WHERE codigo_plan = :c"),
                                {"c": codigo_plan}).scalar()
        comprobar("se eliminaron el usuario y el plan de prueba", queda == 0 and queda_plan == 0,
                  f"usuario={queda} plan={queda_plan}")
    finally:
        db.close()

print("\n" + "=" * 62)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
