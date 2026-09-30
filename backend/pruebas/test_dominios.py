# -*- coding: utf-8 -*-
"""La institución que acredita el correo: catálogo de dominios (migración 013),
asignación al entrar con Google, bloqueo del cambio y el asistente exigiendo
Google. Sobre HTTP real contra la base local; la verificación del ID token de
Google se sustituye por un doble, así que no hace falta una cuenta real."""
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
os.environ["GEMINI_API_KEY"] = "clave-de-prueba"

from fastapi.testclient import TestClient
from sqlalchemy import text

from app import auth, main, motores
from app.herramientas import resultado

fallos = []
correos = []

PUCV = "Pontificia Universidad Catolica de Valparaiso"
UCHILE = "Universidad de Chile"


def comprobar(nombre, cond, detalle=""):
    print(f"  [{'OK ' if cond else 'FALLA'}] {nombre}" + (f" -> {detalle}" if detalle and not cond else ""))
    if not cond:
        fallos.append(nombre)


motores.responder = lambda motor, mensajes: resultado(
    f"[{motor}]", "modelo-de-prueba", motor, 100, 10, ok=True)

# El ID token de Google llega como "google:<correo>": el doble devuelve lo que
# devolvería Google tras verificar la firma, con el correo ya verificado.
auth.verificar_token_google = lambda credencial: {
    "sub": f"prueba-{credencial.split(':', 1)[1]}",
    "correo": credencial.split(":", 1)[1].lower(),
    "nombre": "Prueba dominios",
    "avatar": None,
}
cliente = TestClient(main.app)


def correo(dominio):
    c = f"dominios-{uuid.uuid4().hex[:8]}@{dominio}"
    correos.append(c.lower())
    return c


def con_google(direccion):
    r = cliente.post("/auth/google", json={"credential": f"google:{direccion}"})
    assert r.status_code == 200, r.text
    datos = r.json()
    return datos, {"Authorization": f"Bearer {datos['token']}"}


def institucion_por_correo(direccion):
    db = main.SessionLocal()
    try:
        return db.execute(text("SELECT institucion_por_correo(:c)"), {"c": direccion}).scalar()
    finally:
        db.close()


def chat(cabeceras):
    return cliente.post("/chat", json={"mensaje": "Hola", "motor": "gemini"}, headers=cabeceras)


print("=== 1. El catálogo de dominios ===")
db = main.SessionLocal()
dominios = {f.dominio: f for f in db.execute(text("""
    SELECT d.dominio, d.uso, u.nombre_universidad
      FROM dominio_institucion d JOIN universidad u USING (id_universidad)""")).fetchall()}
total_universidades = db.execute(text("SELECT count(*) FROM universidad")).scalar()
db.close()
con_dominio = {f.nombre_universidad for f in dominios.values()}
comprobar("hay al menos 60 dominios", len(dominios) >= 60, len(dominios))
comprobar("cubren 50 universidades", len(con_dominio) == 50, len(con_dominio))
comprobar("de un catálogo de 58", total_universidades == 58, total_universidades)
comprobar("pucv.cl es de la PUCV", dominios.get("pucv.cl") and dominios["pucv.cl"].nombre_universidad == PUCV)
comprobar("los usos son institucional o estudiantes",
          {f.uso for f in dominios.values()} <= {"institucional", "estudiantes"})
revendidos = {"uarcis.cl", "upacifico.cl", "unicit.cl", "ucinf.cl", "udelmar.cl", "ulare.cl", "ulosleones.cl"}
comprobar("no figura ningún dominio de universidad cerrada que ya no es suyo",
          not (revendidos & dominios.keys()), revendidos & dominios.keys())
anidados = [(d, p) for d in dominios for p in dominios
            if d != p and d.endswith("." + p)
            and dominios[d].nombre_universidad != dominios[p].nombre_universidad]
comprobar("ningún subdominio apunta a otra universidad que su dominio", not anidados, anidados)

print("\n=== 2. Qué correo identifica qué institución ===")
casos = {
    "ana@pucv.cl": PUCV,
    "Ana@Mail.PUCV.cl": PUCV,
    "ana@alumnos.uc.cl": "Pontificia Universidad Catolica de Chile",
    "ana@miuandes.cl": "Universidad de los Andes",
    "ana@inacapmail.cl": "Universidad Tecnologica de Chile",
    "ana@fakepucv.cl": None,
    "ana@pucv.cl.ejemplo.com": None,
    "ana@gmail.com": None,
    "sin-arroba": None,
}
for direccion, esperado in casos.items():
    obtenido = institucion_por_correo(direccion)
    comprobar(f"{direccion} -> {esperado or 'ninguna'}", obtenido == esperado, obtenido)

print("\n=== 3. Google con correo institucional: se asigna sola ===")
d, cab = con_google(correo("pucv.cl"))
comprobar("la institución queda fijada", d["usuario"]["institucion"] == PUCV, d["usuario"]["institucion"])
comprobar("no queda pendiente", d["capacidades"]["institucion_pendiente"] is False)
comprobar("y queda acreditada", d["capacidades"]["institucion_acreditada"] is True)
cambio = cliente.patch("/auth/institucion", json={"institucion": UCHILE}, headers=cab)
comprobar("no se puede cambiar a otra", cambio.status_code == 409, cambio.status_code)
comprobar("y se explica por qué", "correo" in cambio.json().get("detail", ""), cambio.text[:140])
comprobar("la institución sigue siendo la del correo",
          cliente.get("/auth/yo", headers=cab).json()["usuario"]["institucion"] == PUCV)
comprobar("el asistente la atiende", chat(cab).status_code == 200)

d, _ = con_google(correo("mail.pucv.cl"))
comprobar("un subdominio también la asigna", d["usuario"]["institucion"] == PUCV, d["usuario"]["institucion"])

print("\n=== 4. Google con un correo que no la identifica: se pregunta ===")
d, cab = con_google(correo("gmail.com"))
comprobar("queda pendiente", d["capacidades"]["institucion_pendiente"] is True)
comprobar("y no acreditada", d["capacidades"]["institucion_acreditada"] is False)
fijada = cliente.patch("/auth/institucion", json={"institucion": UCHILE}, headers=cab)
comprobar("el selector la fija", fijada.status_code == 200 and
          fijada.json()["usuario"]["institucion"] == UCHILE, fijada.text[:140])
comprobar("y se puede corregir", cliente.patch("/auth/institucion", json={"institucion": PUCV},
                                               headers=cab).status_code == 200)
comprobar("el asistente no la atiende (no es de la PUCV)", chat(cab).status_code == 403)

d, _ = con_google(correo("fakepucv.cl"))
comprobar("un dominio parecido no se confunde con el real",
          d["capacidades"]["institucion_pendiente"] is True, d["usuario"]["institucion"])

print("\n=== 5. Contraseña: el correo no se verifica, así que no acredita ===")
direccion = correo("pucv.cl")
alta = cliente.post("/auth/registro", json={"nombre": "Prueba dominios", "correo": direccion,
                                            "clave": "Prueba12345!", "institucion": UCHILE})
comprobar("el registro con contraseña respeta lo elegido en el selector",
          alta.status_code == 200 and alta.json()["usuario"]["institucion"] == UCHILE, alta.text[:140])
cab = {"Authorization": f"Bearer {alta.json()['token']}"}
comprobar("no queda acreditada", alta.json()["capacidades"]["institucion_acreditada"] is False)
r = chat(cab)
comprobar("el asistente la rechaza aunque el correo sea @pucv.cl", r.status_code == 403, r.status_code)
comprobar("y le indica entrar con Google", "Google" in r.json().get("detail", ""), r.text[:140])

d, cab = con_google(direccion)
comprobar("al entrar con Google es la misma cuenta", d["usuario"]["id"] == alta.json()["usuario"]["id"])
comprobar("que toma la institución de su dominio", d["usuario"]["institucion"] == PUCV,
          d["usuario"]["institucion"])
comprobar("y deja de tener contraseña", d["usuario"]["con_clave"] is False)
comprobar("desde entonces el asistente la atiende", chat(cab).status_code == 200)

# --- Limpieza ---------------------------------------------------------------
db = main.SessionLocal()
db.execute(text("DELETE FROM usuario WHERE lower(correo_usuario) = ANY(:c)"), {"c": correos})
db.commit()
quedan = db.execute(text("SELECT count(*) FROM usuario WHERE lower(correo_usuario) = ANY(:c)"),
                    {"c": correos}).scalar()
db.close()
print(f"\nUsuarios de prueba eliminados: {len(correos)} (quedan {quedan})")
if quedan:
    fallos.append("limpieza incompleta")

print("=" * 62)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
