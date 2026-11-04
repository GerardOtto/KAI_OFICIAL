"""Análisis: grupos de comparación guardados y el lugar en cada ranking.

  * `/grupos`: guardar, reemplazar por nombre, borrar, validar, y que cada cuenta
    vea solo los suyos. El asistente no puede leer la tabla.
  * `/posiciones-por-ranking`: el puesto entre las chilenas coincide con el orden
    del Resumen, deja fuera los rankings por disciplina y respeta el plan.

La simulación inversa, el desglose del cambio y la banda de la proyección se
calculan en el navegador: los vigila la sonda `analisis` del frontend.

Sin la migración 022, la parte de grupos se omite (los endpoints responden lista
vacía y 503, y eso sí se comprueba).
"""
import os
import sys
import uuid

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from dotenv import load_dotenv

load_dotenv(os.path.join(RAIZ, ".env"))
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import acceso, auth, herramientas, main

fallos = []
usuarios = []


def comprobar(nombre, cond, detalle=""):
    print(f"  [{'OK ' if cond else 'FALLA'}] {nombre}" + (f" -> {detalle}" if detalle and not cond else ""))
    if not cond:
        fallos.append(nombre)


def crear_usuario(plan):
    correo = f"analisis-{uuid.uuid4().hex[:8]}@pucv.cl"
    db = main.SessionLocal()
    uid = db.execute(text("""
        INSERT INTO usuario (nombre_usuario, correo_usuario, clave_usuario, institucion_usuario, plan_usuario)
        VALUES ('Prueba análisis', :c, 'x', 'Pontificia Universidad Catolica de Valparaiso', :p)
        RETURNING id_usuario"""), {"c": correo, "p": plan}).scalar()
    db.commit()
    db.close()
    usuarios.append(uid)
    return {"Authorization": f"Bearer {auth.crear_token(uid, correo)[0]}"}


cliente = TestClient(main.app)
db = main.SessionLocal()
hay_grupos = db.execute(text("SELECT to_regclass('public.grupo_comparacion') IS NOT NULL")).scalar()
ids = {r[1]: r[0] for r in db.execute(text("SELECT id_ranking, nombre_ranking FROM ranking"))}
pucv = db.execute(text("SELECT id_universidad FROM universidad WHERE nombre_universidad = "
                       "'Pontificia Universidad Catolica de Valparaiso'")).scalar()
algunas = [r[0] for r in db.execute(text("SELECT id_universidad FROM universidad ORDER BY id_universidad LIMIT 5"))]
db.close()

pago = crear_usuario("investigador")
otra = crear_usuario("investigador")
gratis = crear_usuario(acceso.PLAN_GRATUITO)

try:
    print("=== 1. Grupos de comparación ===")
    if not hay_grupos:
        comprobar("sin la 022, la lista viene vacía", cliente.get("/grupos", headers=pago).json() == [])
        comprobar("y guardar responde 503",
                  cliente.post("/grupos", json={"nombre": "x", "universidades": algunas}, headers=pago).status_code == 503)
        print("  (sin la migración 022: aplica backend/migraciones/022_grupos_de_comparacion.sql)")
    else:
        comprobar("sin sesión no se ven", cliente.get("/grupos").status_code == 401)
        r = cliente.post("/grupos", json={"nombre": "  Regionales  ", "universidades": algunas[:3]}, headers=pago)
        comprobar("se guarda un grupo", r.status_code == 200 and r.json()["nombre"] == "Regionales", r.text)
        grupo = r.json()
        r = cliente.post("/grupos", json={"nombre": "regionales", "universidades": algunas[:4] + [algunas[0]]}, headers=pago)
        lista = cliente.get("/grupos", headers=pago).json()
        comprobar("el mismo nombre, en otras mayúsculas, lo reemplaza",
                  len(lista) == 1 and lista[0]["universidades"] == algunas[:4], lista)
        comprobar("y sin instituciones repetidas", r.json()["universidades"] == algunas[:4], r.json())
        comprobar("otra cuenta no ve los grupos ajenos", cliente.get("/grupos", headers=otra).json() == [])
        comprobar("ni puede borrarlos",
                  cliente.delete(f"/grupos/{lista[0]['id_grupo']}", headers=otra).status_code == 404)
        comprobar("un nombre vacío se rechaza",
                  cliente.post("/grupos", json={"nombre": "   ", "universidades": algunas}, headers=pago).status_code == 400)
        comprobar("un grupo sin instituciones se rechaza",
                  cliente.post("/grupos", json={"nombre": "Vacío", "universidades": []}, headers=pago).status_code == 400)
        comprobar("una institución inexistente se rechaza",
                  cliente.post("/grupos", json={"nombre": "Raro", "universidades": [999999]}, headers=pago).status_code == 400)
        comprobar("la cuenta que lo creó lo borra",
                  cliente.delete(f"/grupos/{lista[0]['id_grupo']}", headers=pago).status_code == 204
                  and cliente.get("/grupos", headers=pago).json() == [])
        del grupo

    salida = herramientas.consulta_sql("SELECT nombre, universidades FROM grupo_comparacion LIMIT 5")
    comprobar("el asistente no puede leer los grupos", salida.startswith("ERROR"), salida[:120])

    print("\n=== 2. El lugar en cada ranking ===")
    posiciones = cliente.get(f"/posiciones-por-ranking?universidad_id={pucv}", headers=pago).json()
    rankings = {p["nombre_ranking"] for p in posiciones}
    comprobar("trae THE, QS y el Ranking KAI", {"THE Latam", "QS Latam", "Ranking KAI"} <= rankings, sorted(rankings))
    comprobar("deja fuera los rankings por disciplina",
              not rankings & {"Shanghai GRAS", "QS por Disciplina"}, sorted(rankings))
    # El puesto es el del Resumen de esa edición.
    distintas = []
    for p in posiciones:
        resumen = cliente.get("/ranking-resumen", params={"ranking_id": p["id_ranking"], "anio": p["anio"]},
                              headers=pago).json()
        orden = [f["id_universidad"] for f in resumen]
        if pucv not in orden or orden.index(pucv) + 1 != p["posicion"] or len(orden) != p["de"]:
            distintas.append((p["nombre_ranking"], p["anio"], p["posicion"], p["de"],
                              orden.index(pucv) + 1 if pucv in orden else None, len(orden)))
    comprobar(f"en las {len(posiciones)} ediciones, el puesto es el del Resumen", not distintas, distintas[:3])
    libres = {p["nombre_ranking"] for p in
              cliente.get(f"/posiciones-por-ranking?universidad_id={pucv}", headers=gratis).json()}
    restringidos = {nombre for nombre, i in ids.items() if i in acceso.ids_restringidos(main.SessionLocal())}
    comprobar("el plan gratuito no ve los rankings reservados", not libres & restringidos,
              sorted(libres & restringidos))
finally:
    db = main.SessionLocal()
    db.execute(text("DELETE FROM usuario WHERE id_usuario = ANY(:ids)"), {"ids": usuarios})
    db.commit()
    db.close()

print("\n" + "=" * 74)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
