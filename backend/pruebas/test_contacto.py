# -*- coding: utf-8 -*-
"""El formulario «Contratar ahora»: cada solicitud se guarda y se envía por
correo al equipo, sin perderse si el correo falla. Sobre HTTP real contra la
base local, con el servidor de correo sustituido por un doble: no sale nada."""
import io
import os
import sys
import uuid

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

from dotenv import load_dotenv
load_dotenv(os.path.join(RAIZ, ".env"))

from fastapi.testclient import TestClient
from sqlalchemy import text

from app import contacto, herramientas, main

fallos = []
MARCA = f"contacto-{uuid.uuid4().hex[:8]}"


def comprobar(nombre, cond, detalle=""):
    print(f"  [{'OK ' if cond else 'FALLA'}] {nombre}" + (f" -> {detalle}" if detalle and not cond else ""))
    if not cond:
        fallos.append(nombre)


class CorreoFalso:
    """Hace de servidor SMTP: guarda lo que se le envía, o falla si se pide."""
    enviados = []
    falla = False

    def __init__(self, host, puerto, timeout=None):
        self.host, self.puerto = host, puerto

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def starttls(self):
        pass

    def login(self, usuario, clave):
        if CorreoFalso.falla:
            raise OSError("servidor de correo caído")

    def send_message(self, msg):
        CorreoFalso.enviados.append(msg)


contacto.smtplib.SMTP = CorreoFalso
cliente = TestClient(main.app)
ip = iter(range(1, 250))


def enviar(**campos):
    cuerpo = {"nombre": "Ana Pérez", "correo": f"{MARCA}@ejemplo.cl", "institucion": "Universidad de Prueba",
              "plan": "institucional", **campos}
    # Una IP distinta por envío, para que el tope por hora no mezcle las pruebas.
    return cliente.post("/contacto", json=cuerpo, headers={"X-Forwarded-For": f"10.9.8.{next(ip)}"})


def ultima():
    db = main.SessionLocal()
    try:
        return db.execute(text("""SELECT * FROM solicitud_contacto WHERE correo LIKE :m
                                  ORDER BY id_solicitud DESC LIMIT 1"""), {"m": f"{MARCA}%"}).mappings().first()
    finally:
        db.close()


def configurar(**valores):
    for k in ("SMTP_USUARIO", "SMTP_CLAVE", "CONTACTO_DESTINO"):
        os.environ.pop(k, None)
    os.environ.update(valores)


print("=== 1. Con el correo configurado ===")
configurar(SMTP_USUARIO="kai@ejemplo.cl", SMTP_CLAVE="clave-de-prueba", CONTACTO_DESTINO="equipo@ejemplo.cl")
r = enviar(cargo="Directora de Análisis", telefono="+56 9 1234 5678", mensaje="Queremos una demostración.")
comprobar("el formulario responde bien", r.status_code == 200 and r.json() == {"ok": True}, r.text[:120])
fila = ultima()
comprobar("la solicitud queda guardada", fila is not None)
comprobar("y marcada como enviada", fila and fila["enviado"] is True, fila and fila["error_envio"])
msg = CorreoFalso.enviados[-1] if CorreoFalso.enviados else None
comprobar("se envió un correo", msg is not None)
if msg:
    cuerpo = msg.get_content()
    comprobar("al destino configurado", msg["To"] == "equipo@ejemplo.cl", msg["To"])
    comprobar("responder le escribe a quien lo pidió", msg["Reply-To"] == f"{MARCA}@ejemplo.cl", msg["Reply-To"])
    comprobar("el asunto nombra el plan y la institución",
              "Institucional" in msg["Subject"] and "Universidad de Prueba" in msg["Subject"], msg["Subject"])
    comprobar("el cuerpo trae todos los datos",
              all(t in cuerpo for t in ("Ana Pérez", "Directora de Análisis", "+56 9 1234 5678",
                                        "Queremos una demostración.")), cuerpo[:200])

print("\n=== 2. Sin correo configurado, o con el correo caído: no se pierde nada ===")
configurar()
enviar()
fila = ultima()
comprobar("sin configuración, la solicitud se guarda igual", fila is not None and fila["enviado"] is False)
comprobar("con el motivo anotado", fila and "sin configurar" in (fila["error_envio"] or ""), fila and fila["error_envio"])

configurar(SMTP_USUARIO="kai@ejemplo.cl", SMTP_CLAVE="x", CONTACTO_DESTINO="equipo@ejemplo.cl")
CorreoFalso.falla = True
r = enviar()
CorreoFalso.falla = False
fila = ultima()
comprobar("si el correo falla, quien envía no ve un error", r.status_code == 200)
comprobar("y la solicitud queda guardada con el fallo", fila["enviado"] is False and "caído" in fila["error_envio"],
          fila["error_envio"])

print("\n=== 3. Validación ===")
comprobar("un correo inválido se rechaza", enviar(correo="no-es-correo").status_code == 400)
comprobar("sin nombre se rechaza", enviar(nombre="   ").status_code == 400)
comprobar("sin institución se rechaza", enviar(institucion="").status_code == 400)
enviar(plan="admin")
comprobar("un plan que no se ofrece no se guarda como elegido", ultima()["codigo_plan"] is None)

antes = len(CorreoFalso.enviados)
enviar(nombre="Ana\r\nBcc: intruso@ejemplo.cl")
fila = ultima()
comprobar("un salto de línea no se cuela en las cabeceras",
          "\n" not in fila["nombre"] and "\r" not in fila["nombre"], repr(fila["nombre"]))
comprobar("y el correo sale igual, sin destinatario añadido",
          len(CorreoFalso.enviados) == antes + 1 and CorreoFalso.enviados[-1]["Bcc"] is None)

print("\n=== 4. Defensas del formulario público ===")
n = len(CorreoFalso.enviados)
r = enviar(sitio_web="http://spam.ejemplo")
comprobar("un robot que rellena la trampa recibe «ok»", r.status_code == 200)
comprobar("pero no se envía nada", len(CorreoFalso.enviados) == n)

codigos = [cliente.post("/contacto", headers={"X-Forwarded-For": "10.7.7.7"},
                        json={"nombre": "Repetido", "correo": f"{MARCA}-r@ejemplo.cl",
                              "institucion": "U"}).status_code for _ in range(contacto.MAX_POR_HORA + 1)]
comprobar(f"desde una misma IP, la solicitud {contacto.MAX_POR_HORA + 1} de la hora se frena",
          codigos[:-1] == [200] * contacto.MAX_POR_HORA and codigos[-1] == 429, codigos)

sql = herramientas.consulta_sql("SELECT nombre, correo FROM solicitud_contacto LIMIT 1")
comprobar("el asistente no puede leer las solicitudes", sql.startswith("ERROR"), sql[:120])

# --- Limpieza ---------------------------------------------------------------
db = main.SessionLocal()
db.execute(text("DELETE FROM solicitud_contacto WHERE correo LIKE :m"), {"m": f"{MARCA}%"})
db.commit()
quedan = db.execute(text("SELECT count(*) FROM solicitud_contacto WHERE correo LIKE :m"),
                    {"m": f"{MARCA}%"}).scalar()
db.close()
print(f"\nSolicitudes de prueba eliminadas (quedan {quedan})")
if quedan:
    fallos.append("limpieza incompleta")

print("=" * 62)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
