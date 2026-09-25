# -*- coding: utf-8 -*-
"""Quién puede ver qué: institución obligatoria, módulos cerrados con sesión,
rankings reservados a los planes de pago, descargas contadas y asistente
limitado a la institución. Sobre HTTP real contra la base local, con el
proveedor sustituido: no hay gasto."""
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

from app import acceso, auth, main, motores
from app.herramientas import resultado

fallos = []
usuarios = []

INSTITUCION = "Pontificia Universidad Catolica de Valparaiso"


def comprobar(nombre, cond, detalle=""):
    print(f"  [{'OK ' if cond else 'FALLA'}] {nombre}" + (f" -> {detalle}" if detalle and not cond else ""))
    if not cond:
        fallos.append(nombre)


motores.responder = lambda motor, mensajes: resultado(
    f"[{motor}]", "modelo-de-prueba", motor, 100, 10, ok=True)
cliente = TestClient(main.app)


def crear_usuario(plan="free", dominio="pucv.cl", institucion=INSTITUCION):
    """Usuario directamente en la base: aquí se prueban los permisos, no el alta."""
    correo = f"acceso-{uuid.uuid4().hex[:8]}@{dominio}"
    db = main.SessionLocal()
    uid = db.execute(text("""
        INSERT INTO usuario (nombre_usuario, correo_usuario, clave_usuario,
                             institucion_usuario, plan_usuario)
        VALUES ('Prueba acceso', :c, 'x', :i, :p) RETURNING id_usuario
    """), {"c": correo, "i": institucion, "p": plan}).scalar()
    db.commit()
    db.close()
    usuarios.append(uid)
    token, _ = auth.crear_token(uid, correo)
    return uid, {"Authorization": f"Bearer {token}"}


# Los rankings reservados se resuelven una vez, desde la misma fuente que usa el
# servidor: si mañana se carga otro THE o QS, la prueba lo cubre sin tocarla.
db = main.SessionLocal()
RESTRINGIDOS = acceso.rankings_restringidos(db)
LIBRE = db.execute(text("""
    SELECT id_ranking FROM ranking WHERE id_ranking <> ALL(:ids) ORDER BY id_ranking LIMIT 1
"""), {"ids": [r["id_ranking"] for r in RESTRINGIDOS]}).scalar()
db.close()
RESERVADO = RESTRINGIDOS[0]["id_ranking"]

print("=== 1. Rankings reservados: el catálogo ===")
comprobar("se reservan THE y QS", len(RESTRINGIDOS) >= 3, [r["nombre_ranking"] for r in RESTRINGIDOS])
comprobar("todos son de esas dos familias",
          all(r["nombre_ranking"].startswith(("THE", "QS")) for r in RESTRINGIDOS),
          [r["nombre_ranking"] for r in RESTRINGIDOS])
comprobar("queda al menos un ranking libre para el plan gratuito", LIBRE is not None, LIBRE)

print("\n=== 2. Ningún módulo sin sesión ===")
SIN_SESION = ["/rankings", "/universidades", "/tipos-metrica", f"/anios?ranking_id={LIBRE}",
              f"/metricas?ranking_id={LIBRE}", "/metricas-por-tipo?tipo=Reputacion",
              f"/simulacion?ranking_id={LIBRE}&anio=2024", "/cientificos-campos"]
cerrados = {ruta: cliente.get(ruta).status_code for ruta in SIN_SESION}
comprobar("todos responden 401 sin credencial",
          all(c == 401 for c in cerrados.values()),
          {r: c for r, c in cerrados.items() if c != 401})

publicos = {ruta: cliente.get(ruta).status_code for ruta in ["/planes", "/instituciones", "/auth/config", "/motores"]}
comprobar("lo que la portada necesita sigue siendo público",
          all(c == 200 for c in publicos.values()), publicos)

print("\n=== 3. Catálogo de instituciones y registro ===")
instituciones = cliente.get("/instituciones").json()
db = main.SessionLocal()
total_universidades = db.execute(text("SELECT count(*) FROM universidad")).scalar()
db.close()
comprobar("están todas las universidades del sistema",
          len(instituciones) == total_universidades, f"{len(instituciones)} de {total_universidades}")
comprobar("cada una trae nombre e identificador",
          all("nombre_universidad" in i and "id_universidad" in i for i in instituciones))

correo_alta = f"alta-{uuid.uuid4().hex[:8]}@pucv.cl"
sin_institucion = cliente.post("/auth/registro", json={
    "nombre": "Sin institución", "correo": correo_alta, "clave": "Prueba12345!"})
comprobar("el registro sin institución se rechaza", sin_institucion.status_code == 422,
          sin_institucion.status_code)

inventada = cliente.post("/auth/registro", json={
    "nombre": "Inventada", "correo": correo_alta, "clave": "Prueba12345!",
    "institucion": "Universidad de Ninguna Parte"})
comprobar("una institución fuera del catálogo se rechaza", inventada.status_code == 400,
          f"{inventada.status_code} {inventada.text[:120]}")
comprobar("y se explica que hay que elegir de la lista",
          "catálogo" in inventada.json().get("detail", ""), inventada.text[:120])

alta = cliente.post("/auth/registro", json={
    "nombre": "Con institución", "correo": correo_alta, "clave": "Prueba12345!",
    "institucion": INSTITUCION.lower()})
comprobar("con una del catálogo el alta funciona", alta.status_code == 200,
          f"{alta.status_code} {alta.text[:120]}")
if alta.status_code == 200:
    usuarios.append(alta.json()["usuario"]["id"])
    comprobar("la institución se guarda con el nombre canónico, no como se escribió",
              alta.json()["usuario"]["institucion"] == INSTITUCION,
              alta.json()["usuario"]["institucion"])
    comprobar("la sesión ya trae las capacidades del plan",
              "capacidades" in alta.json() and alta.json()["capacidades"]["gratuito"] is True)

print("\n=== 4. Completar la institución después (camino de Google) ===")
_, sin_inst = crear_usuario(institucion=None)
yo = cliente.get("/auth/yo", headers=sin_inst).json()
comprobar("la cuenta sin institución queda marcada",
          yo["capacidades"]["institucion_pendiente"] is True, yo["capacidades"])
mal = cliente.patch("/auth/institucion", json={"institucion": "Qwerty"}, headers=sin_inst)
comprobar("no se admite cualquier texto", mal.status_code == 400, mal.status_code)
bien = cliente.patch("/auth/institucion", json={"institucion": INSTITUCION}, headers=sin_inst)
comprobar("se puede fijar después del alta", bien.status_code == 200, bien.text[:120])
comprobar("y deja de estar pendiente",
          bien.json()["capacidades"]["institucion_pendiente"] is False, bien.json()["capacidades"])

print("\n=== 5. THE y QS: el plan gratuito los ve pero no los abre ===")
_, gratis = crear_usuario("free")
_, pago = crear_usuario("institucional")
_, admin = crear_usuario("admin")

catalogo = {r["id_ranking"]: r for r in cliente.get("/rankings", headers=gratis).json()}
comprobar("el catálogo gratuito incluye los reservados", RESERVADO in catalogo)
comprobar("y los devuelve marcados", catalogo[RESERVADO]["restringido"] is True, catalogo[RESERVADO])
comprobar("los demás no lo están", catalogo[LIBRE]["restringido"] is False, catalogo[LIBRE])
catalogo_pago = {r["id_ranking"]: r for r in cliente.get("/rankings", headers=pago).json()}
comprobar("para un plan de pago no hay ninguno marcado",
          not any(r["restringido"] for r in catalogo_pago.values()))

RUTAS_CON_RANKING = [
    f"/trends?ranking_id={{r}}&metrica_id=1",
    f"/metricas?ranking_id={{r}}",
    f"/anios?ranking_id={{r}}",
    f"/simulacion?ranking_id={{r}}&anio=2024",
    f"/ranking-resumen?ranking_id={{r}}&anio=2024",
    f"/metricas-con-datos?ranking_id={{r}}",
]
bloqueadas = {p: cliente.get(p.format(r=RESERVADO), headers=gratis).status_code
              for p in RUTAS_CON_RANKING}
comprobar("todas las consultas a un ranking reservado responden 403",
          all(c == 403 for c in bloqueadas.values()),
          {p: c for p, c in bloqueadas.items() if c != 403})
libres = {p: cliente.get(p.format(r=LIBRE), headers=gratis).status_code for p in RUTAS_CON_RANKING}
comprobar("las de un ranking incluido pasan",
          all(c == 200 for c in libres.values()), {p: c for p, c in libres.items() if c != 200})

de_pago = {p: cliente.get(p.format(r=RESERVADO), headers=pago).status_code for p in RUTAS_CON_RANKING}
comprobar("un plan de pago sí abre los reservados",
          all(c == 200 for c in de_pago.values()), {p: c for p, c in de_pago.items() if c != 200})
comprobar("y el administrador también",
          cliente.get(RUTAS_CON_RANKING[1].format(r=RESERVADO), headers=admin).status_code == 200)

motivo = cliente.get(RUTAS_CON_RANKING[1].format(r=RESERVADO), headers=gratis).json()["detail"]
comprobar("el rechazo nombra el ranking y ofrece salida",
          RESTRINGIDOS[0]["nombre_ranking"] in motivo and "plan" in motivo, motivo[:140])

print("\n=== 6. El glosario tapa la celda, no la esconde ===")
glosario = cliente.get("/metricas-por-tipo?tipo=Reputacion", headers=gratis).json()
reservadas = [m for m in glosario if m["id_ranking"] == RESERVADO]
comprobar("las métricas del ranking reservado siguen apareciendo", len(reservadas) > 0)
comprobar("con su nombre de ranking visible",
          all(m["nombre_ranking"] for m in reservadas))
comprobar("pero sin peso ni descripción",
          all(m["peso_metrica"] is None and m["descripcion_metrica"] is None for m in reservadas),
          reservadas[:1])
comprobar("y marcadas como restringidas", all(m["restringido"] for m in reservadas))
libres_glosario = [m for m in glosario if m["id_ranking"] != RESERVADO]
comprobar("las demás conservan su peso",
          any(m["peso_metrica"] is not None for m in libres_glosario))
glosario_pago = cliente.get("/metricas-por-tipo?tipo=Reputacion", headers=pago).json()
comprobar("un plan de pago ve todos los pesos",
          all(not m["restringido"] for m in glosario_pago))

print("\n=== 7. Predicciones ===")
cap_gratis = cliente.get("/auth/yo", headers=gratis).json()["capacidades"]
cap_pago = cliente.get("/auth/yo", headers=pago).json()["capacidades"]
cap_admin = cliente.get("/auth/yo", headers=admin).json()["capacidades"]
comprobar("el plan gratuito no las incluye", cap_gratis["predicciones"] is False)
comprobar("los de pago sí", cap_pago["predicciones"] is True)
comprobar("el administrador también", cap_admin["predicciones"] is True)
comprobar("y el administrador no queda como gratuito", cap_admin["gratuito"] is False)

print("\n=== 8. Un informe de cada formato por módulo ===")
primera = cliente.post("/descargas", json={"modulo": "tendencias", "formato": "pdf"}, headers=gratis)
comprobar("la primera descarga se concede", primera.status_code == 200, primera.text[:120])
segunda = cliente.post("/descargas", json={"modulo": "tendencias", "formato": "pdf"}, headers=gratis)
comprobar("la segunda del mismo módulo y formato se rechaza", segunda.status_code == 403,
          segunda.status_code)
comprobar("y se explica que los planes de pago no tienen ese tope",
          "planes de pago" in segunda.json()["detail"], segunda.json()["detail"])
otro_formato = cliente.post("/descargas", json={"modulo": "tendencias", "formato": "xlsx"}, headers=gratis)
comprobar("el otro formato del mismo módulo sigue disponible", otro_formato.status_code == 200)
otro_modulo = cliente.post("/descargas", json={"modulo": "simulacion", "formato": "pdf"}, headers=gratis)
comprobar("y el mismo formato en otro módulo también", otro_modulo.status_code == 200)

comprobar("el módulo inventado se rechaza sin contarlo",
          cliente.post("/descargas", json={"modulo": "inventado", "formato": "pdf"},
                       headers=gratis).status_code == 400)
comprobar("y un formato inventado también",
          cliente.post("/descargas", json={"modulo": "tendencias", "formato": "docx"},
                       headers=gratis).status_code == 400)

usadas = cliente.get("/descargas", headers=gratis).json()
comprobar("el recuento refleja lo descargado",
          usadas["usadas"]["tendencias"]["pdf"] == 1 and usadas["usadas"]["simulacion"]["pdf"] == 1,
          usadas["usadas"])
comprobar("y declara el tope del plan", usadas["limite"] == acceso.DESCARGAS_GRATUITAS, usadas["limite"])

for i in range(3):
    r = cliente.post("/descargas", json={"modulo": "tendencias", "formato": "pdf"}, headers=pago)
comprobar("un plan de pago descarga sin tope", r.status_code == 200, r.status_code)
comprobar("y su recuento no declara límite",
          cliente.get("/descargas", headers=pago).json()["limite"] is None)
comprobar("el administrador tampoco tiene tope",
          cliente.post("/descargas", json={"modulo": "asistente", "formato": "pdf"},
                       headers=admin).status_code == 200)

print("\n=== 9. El asistente, solo para la institución ===")
_, ajeno = crear_usuario("institucional", dominio="gmail.com")
r = cliente.post("/chat", json={"mensaje": "Hola", "motor": "gemini"}, headers=ajeno)
comprobar("una cuenta de otro dominio no puede consultar", r.status_code == 403, r.status_code)
comprobar("y se le dice por qué", "PUCV" in r.json()["detail"], r.json()["detail"][:140])
comprobar("aunque su plan sí incluya el motor",
          cliente.get("/auth/yo", headers=ajeno).json()["cuota"]["motores"]["gemini"]["incluido"] is True)

motores_ajeno = cliente.get("/motores", headers=ajeno).json()
comprobar("el catálogo de motores lo refleja antes de intentarlo",
          motores_ajeno["permitido"] is False
          and all(not m["disponible_ahora"] for m in motores_ajeno["motores"]),
          motores_ajeno.get("motivo"))

_, propio = crear_usuario("institucional")
comprobar("una cuenta de la institución sí consulta",
          cliente.post("/chat", json={"mensaje": "Hola", "motor": "gemini"},
                       headers=propio).status_code == 200)

_, admin_ajeno = crear_usuario("admin", dominio="gmail.com")
comprobar("el administrador no depende del dominio",
          cliente.post("/chat", json={"mensaje": "Hola", "motor": "gemini"},
                       headers=admin_ajeno).status_code == 200)

cap_ajeno = cliente.get("/auth/yo", headers=ajeno).json()["capacidades"]
comprobar("las capacidades avisan del bloqueo del asistente",
          cap_ajeno["asistente"]["permitido"] is False and cap_ajeno["asistente"]["motivo"],
          cap_ajeno["asistente"])

# --- Limpieza ---------------------------------------------------------------
db = main.SessionLocal()
db.execute(text("DELETE FROM usuario WHERE id_usuario = ANY(:ids)"), {"ids": usuarios})
db.commit()
quedan = db.execute(text("SELECT count(*) FROM usuario WHERE id_usuario = ANY(:ids)"),
                    {"ids": usuarios}).scalar()
sueltas = db.execute(text("""
    SELECT count(*) FROM descarga d LEFT JOIN usuario u ON u.id_usuario = d.id_usuario
     WHERE u.id_usuario IS NULL""")).scalar()
db.close()
print(f"\nUsuarios de prueba eliminados: {len(usuarios)} (quedan {quedan}, descargas huérfanas {sueltas})")
if quedan or sueltas:
    fallos.append("limpieza incompleta")

print("=" * 62)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
