"""Recorre /chat de punta a punta: registro real, JWT real, base real y el ciclo
real de herramientas. Lo único simulado es la llamada al proveedor, para no
gastar créditos ni depender de la cuota diaria.

Se simula al nivel más bajo posible del motor Gemini (su cliente), de modo que
todo lo demás —cuotas, persistencia del historial, motor por conversación— se
ejecuta de verdad.
"""
import os
import sys
import types as pytypes
import uuid

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


# --- Proveedor simulado: ejecuta de verdad las herramientas que pida ---------

class Uso:
    prompt_token_count = 1500
    candidates_token_count = 200
    thoughts_token_count = 0
    tool_use_prompt_token_count = 0


class Llamada:
    def __init__(self, name, args):
        self.name, self.args = name, args


class Respuesta:
    def __init__(self, texto="", llamadas=(), busquedas=()):
        self.text = texto
        self.function_calls = list(llamadas)
        self.usage_metadata = Uso()
        self.candidates = [pytypes.SimpleNamespace(
            finish_reason="STOP",
            content=pytypes.SimpleNamespace(role="model", parts=[]),
            grounding_metadata=(pytypes.SimpleNamespace(web_search_queries=list(busquedas))
                                if busquedas else None))]


class ClienteFalso:
    def __init__(self):
        self.turnos = 0
        self.recibido = []
        self.models = pytypes.SimpleNamespace(generate_content=self._generar)

    def _generar(self, model, contents, config):
        self.turnos += 1
        self.recibido.append(contents)
        if self.turnos == 1:
            # Primer turno: pide datos a la base y "busca" en internet.
            return Respuesta(llamadas=[Llamada("buscar_universidades", {"texto": "Católica"})],
                             busquedas=["ranking QS 2026"])
        # Segundo turno: contesta usando lo que devolvió la herramienta.
        salida = str(contents[-1])
        marca = "PUCV-ENCONTRADA" if "Catolica de Valparaiso" in salida else "SIN-DATOS"
        return Respuesta(texto=f"Resultado: {marca}")


falso = ClienteFalso()
g.cliente = lambda: falso
g.configurado = lambda: True

cliente = TestClient(app)
correo = f"prueba-agentes-{uuid.uuid4().hex[:8]}@ejemplo.test"
CLAVE = "Prueba12345!"
id_usuario = None

try:
    print("=== 1. Registro y sesión reales ===")
    r = cliente.post("/auth/registro", json={"nombre": "Prueba Agentes",
                                             "correo": correo, "clave": CLAVE})
    comprobar("registro", r.status_code in (200, 201), f"{r.status_code} {r.text[:200]}")
    r = cliente.post("/auth/login", json={"correo": correo, "clave": CLAVE})
    comprobar("login", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    token = r.json()["token"]
    cabeceras = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    fila = db.execute(text("SELECT id_usuario FROM usuario WHERE correo_usuario = :c"),
                      {"c": correo}).fetchone()
    id_usuario = fila.id_usuario if fila else None
    # Sin plan, un usuario nuevo solo puede usar Gemini; se le da el plan gratuito
    # para que el turno llegue al motor y se pueda probar el ciclo completo.
    db.execute(text("UPDATE usuario SET plan_usuario = (SELECT codigo_plan FROM plan "
                    "WHERE publico ORDER BY orden LIMIT 1) WHERE id_usuario = :u"),
               {"u": id_usuario})
    db.commit()
    db.close()

    print("\n=== 2. El catálogo de motores describe lo que hacen ===")
    r = cliente.get("/motores", headers=cabeceras)
    comprobar("/motores responde", r.status_code == 200, r.text[:200])
    catalogo = {m["id"]: m for m in r.json()["motores"]}
    comprobar("ambos motores anuncian la búsqueda en internet",
              all("internet" in m["descripcion"] for m in catalogo.values()),
              str([m["descripcion"] for m in catalogo.values()]))

    print("\n=== 3. Un turno completo contra el motor Gemini ===")
    r = cliente.post("/chat", headers=cabeceras,
                     json={"mensaje": "¿Qué sabes de la Universidad Católica de Valparaíso?",
                           "motor": "gemini"})
    comprobar("/chat responde 200", r.status_code == 200, f"{r.status_code} {r.text[:300]}")
    cuerpo = r.json()
    comprobar("el turno fue correcto", cuerpo.get("ok") is True, str(cuerpo)[:250])
    comprobar("la herramienta se ejecutó contra la base real",
              "PUCV-ENCONTRADA" in cuerpo.get("content", ""), cuerpo.get("content", "")[:200])
    comprobar("se contabilizaron los tokens de los dos turnos",
              cuerpo["uso"]["tokens_entrada"] == 3000 and cuerpo["uso"]["tokens_salida"] == 400,
              str(cuerpo["uso"]))
    comprobar("la respuesta informa de la búsqueda web", cuerpo["uso"]["busquedas"] == 1,
              str(cuerpo["uso"]))
    id_conversacion = cuerpo["id_conversacion"]
    comprobar("la conversación quedó creada", isinstance(id_conversacion, int), str(id_conversacion))

    print("\n=== 4. La conversación queda ligada a su motor ===")
    r = cliente.post("/chat", headers=cabeceras,
                     json={"mensaje": "otra cosa", "id_conversacion": id_conversacion,
                           "motor": "claude"})
    comprobar("rechaza cambiar de motor con 409", r.status_code == 409, f"{r.status_code} {r.text[:200]}")

    print("\n=== 5. El historial persiste y se reenvía ===")
    r = cliente.get(f"/conversaciones/{id_conversacion}", headers=cabeceras)
    comprobar("se recupera la conversación", r.status_code == 200, r.text[:200])
    mensajes = r.json().get("mensajes", r.json() if isinstance(r.json(), list) else [])
    comprobar("guardó los dos mensajes del turno", len(mensajes) == 2, str(len(mensajes)))

    print("\n=== 6. El asistente no puede alcanzar los datos de usuarios ===")
    from app import herramientas as h
    for sql in (f"SELECT correo_usuario FROM usuario WHERE id_usuario = {id_usuario}",
                f"SELECT contenido FROM mensaje WHERE id_conversacion = {id_conversacion}"):
        salida = h.consulta_sql(sql)
        comprobar(f"rechaza: {sql[:45]}...", salida.startswith("ERROR"), salida[:120])

finally:
    print("\n=== 7. Limpieza ===")
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
