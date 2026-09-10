# -*- coding: utf-8 -*-
"""Reglas de convivencia de los dos motores, sobre HTTP real contra la base
local. Solo se sustituye la llamada al proveedor, así que no hay gasto: todo lo
demás (autenticación, persistencia, aislamiento de contexto) es el código real."""
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
# La raiz del backend se resuelve desde la ubicacion de este archivo, no desde
# una ruta de una maquina concreta: es lo que permite ejecutar la bateria en
# otro equipo y en integracion continua.
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

from dotenv import load_dotenv
load_dotenv(os.path.join(RAIZ, ".env"))
os.environ["GEMINI_API_KEY"] = "clave-de-prueba"  # deja el motor Gemini "disponible"

from fastapi.testclient import TestClient
from sqlalchemy import text

from app import auth, main, motores
from app.herramientas import resultado

fallos = []
creadas = []


def comprobar(nombre, condicion, detalle=""):
    print(f"  [{'OK ' if condicion else 'FALLA'}] {nombre}" + (f" -> {detalle}" if detalle and not condicion else ""))
    if not condicion:
        fallos.append(nombre)


# --- Doble del proveedor: registra qué motor recibió qué historial -----------
recibido = []


def responder_falso(motor, mensajes):
    recibido.append({"motor": motor, "mensajes": list(mensajes)})
    modelo = {"claude": "claude-opus-5", "gemini": __import__("app.assistant_gemini", fromlist=["MODEL"]).MODEL}[motor]
    return resultado(f"[respuesta simulada de {motor}]", modelo, motor, 100, 20, ok=True)


motores.responder = responder_falso

cliente = TestClient(main.app)

# --- Usuario de prueba ------------------------------------------------------
# Se crea uno propio en vez de tomar el primero que hubiera en la base: depender
# de datos preexistentes ata la bateria al equipo de quien la escribio y la hace
# fallar en una base recien cargada, que es justo la situacion de la integracion
# continua. Se elimina al terminar.
import uuid

CORREO = f"prueba-convivencia-{uuid.uuid4().hex[:8]}@ejemplo.test"

db = main.SessionLocal()
ID_USUARIO = db.execute(text("""
    INSERT INTO usuario (nombre_usuario, correo_usuario, clave_usuario, plan_usuario)
    VALUES ('Prueba Convivencia', :c, :k,
            (SELECT codigo_plan FROM plan
              WHERE tokens_claude_mes IS NULL OR tokens_claude_mes > 0
              ORDER BY orden DESC LIMIT 1))
    RETURNING id_usuario
"""), {"c": CORREO, "k": auth.hashear_clave("Prueba12345!")}).scalar()
db.commit()
db.close()

token, _ = auth.crear_token(ID_USUARIO, CORREO)
CAB = {"Authorization": f"Bearer {token}"}
print(f"Usuario de prueba: id {ID_USUARIO}\n")


def limpiar_usuario():
    db = main.SessionLocal()
    try:
        db.execute(text("DELETE FROM mensaje WHERE id_conversacion IN "
                        "(SELECT id_conversacion FROM conversacion WHERE id_usuario = :u)"),
                   {"u": ID_USUARIO})
        db.execute(text("DELETE FROM conversacion WHERE id_usuario = :u"), {"u": ID_USUARIO})
        db.execute(text("DELETE FROM notificacion WHERE id_usuario = :u"), {"u": ID_USUARIO})
        db.execute(text("DELETE FROM usuario WHERE id_usuario = :u"), {"u": ID_USUARIO})
        db.commit()
    finally:
        db.close()


import atexit

atexit.register(limpiar_usuario)


def chat(mensaje, id_conv=None, motor=None):
    cuerpo = {"mensaje": mensaje, "id_conversacion": id_conv}
    if motor is not None:
        cuerpo["motor"] = motor
    return cliente.post("/chat", json=cuerpo, headers=CAB)


print("=== 1. Catálogo de motores ===")
r = cliente.get("/motores")
datos = r.json()
ids = [m["id"] for m in datos["motores"]]
comprobar("responde 200", r.status_code == 200, r.status_code)
comprobar("lista los dos motores", ids == ["claude", "gemini"], ids)
comprobar("por defecto es claude", datos["por_defecto"] == "claude", datos["por_defecto"])
comprobar("informa de disponibilidad", all("disponible" in m for m in datos["motores"]))
comprobar("es público (sin token)", cliente.get("/motores").status_code == 200)

print("\n=== 2. El motor queda fijado al crear la conversación ===")
r = chat("Hola Gemini", motor="gemini")
comprobar("crea la conversación", r.status_code == 200, r.text[:200])
conv_gemini = r.json()["id_conversacion"]
creadas.append(conv_gemini)
comprobar("responde el motor pedido", r.json()["motor"] == "gemini", r.json().get("motor"))
comprobar("informa del modelo", r.json()["modelo"].startswith("gemini-"), r.json().get("modelo"))
comprobar("el despacho llegó a gemini", recibido[-1]["motor"] == "gemini", recibido[-1]["motor"])

r = chat("Hola Claude", motor="claude")
conv_claude = r.json()["id_conversacion"]
creadas.append(conv_claude)
comprobar("segunda conversación con el otro motor", r.json()["motor"] == "claude", r.json().get("motor"))
comprobar("son conversaciones distintas", conv_claude != conv_gemini)

print("\n=== 3. Dentro de una conversación el motor no cambia ===")
r = chat("Sigue", conv_gemini, motor="claude")
comprobar("rechaza el cambio con 409", r.status_code == 409, r.status_code)
comprobar("explica qué hacer", "deriva" in r.json()["detail"].lower(), r.json()["detail"])
comprobar("el intento no gastó nada", recibido[-1]["motor"] == "claude" and len(recibido) == 2, len(recibido))

r = chat("Sigue", conv_gemini, motor="gemini")
comprobar("el mismo motor sí continúa", r.status_code == 200, r.text[:200])
r = chat("Sigue sin decir motor", conv_gemini)
comprobar("sin indicar motor usa el guardado", r.status_code == 200 and r.json()["motor"] == "gemini",
          r.json().get("motor"))

print("\n=== 4. Los contextos no se mezclan ===")
comprobar("gemini solo ve su propia conversación",
          all(m["motor"] == "gemini" for m in recibido[-2:]))
historial_gemini = recibido[-1]["mensajes"]
textos = [m["content"] for m in historial_gemini]
comprobar("el historial es el de su conversación",
          "Hola Gemini" in textos and "Hola Claude" not in textos, textos)
comprobar("no se filtró el turno de la otra conversación",
          not any("Claude" in t for t in textos if t != "Hola Claude"), textos)

r = chat("Segunda de claude", conv_claude)
textos_claude = [m["content"] for m in recibido[-1]["mensajes"]]
comprobar("claude tampoco ve la conversación de gemini",
          "Hola Claude" in textos_claude and "Hola Gemini" not in textos_claude, textos_claude)

print("\n=== 5. Motores inexistentes o sin configurar ===")
r = chat("x", motor="chatgpt")
comprobar("motor inexistente -> 400", r.status_code == 400, r.status_code)
comprobar("lo dice claramente", "no existe" in r.json()["detail"], r.json()["detail"])

clave = os.environ.pop("GEMINI_API_KEY")
r = chat("x", motor="gemini")
comprobar("motor sin clave -> 503", r.status_code == 503, r.status_code)
comprobar("apunta a la documentación", "asistente-motores" in r.json()["detail"], r.json()["detail"])
r = cliente.get("/motores").json()
comprobar("el catálogo lo marca no disponible",
          [m for m in r["motores"] if m["id"] == "gemini"][0]["disponible"] is False)
os.environ["GEMINI_API_KEY"] = clave

r = chat("Sigue en la de gemini", conv_gemini)
comprobar("una conversación ya creada no se rompe por eso", r.status_code == 200, r.status_code)

print("\n=== 6. El motor viaja con la conversación ===")
lista = cliente.get("/conversaciones", headers=CAB).json()
por_id = {c["id_conversacion"]: c for c in lista}
comprobar("el listado incluye el motor",
          por_id[conv_gemini]["motor"] == "gemini" and por_id[conv_claude]["motor"] == "claude")
detalle = cliente.get(f"/conversaciones/{conv_gemini}", headers=CAB).json()
comprobar("el detalle incluye el motor", detalle["motor"] == "gemini", detalle.get("motor"))

print("\n=== 7. La base impide un motor inválido ===")
db = main.SessionLocal()
try:
    db.execute(text("UPDATE conversacion SET motor = 'chatgpt' WHERE id_conversacion = :c"),
               {"c": conv_gemini})
    db.commit()
    comprobar("la restricción CHECK rechaza motores desconocidos", False, "aceptó 'chatgpt'")
except Exception as e:
    db.rollback()
    comprobar("la restricción CHECK rechaza motores desconocidos",
              "conversacion_motor_chk" in str(e), type(e).__name__)
finally:
    db.close()

# --- Limpieza ---------------------------------------------------------------
for c in creadas:
    cliente.delete(f"/conversaciones/{c}", headers=CAB)
db = main.SessionLocal()
quedan = db.execute(text("SELECT count(*) FROM conversacion WHERE id_conversacion = ANY(:ids)"),
                    {"ids": creadas}).scalar()
db.close()
print(f"\nConversaciones de prueba eliminadas: {len(creadas)} (quedan {quedan})")

print("=" * 60)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
