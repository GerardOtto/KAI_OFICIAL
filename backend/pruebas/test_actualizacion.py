"""Posición oficial, estado de las ediciones y THE World (migraciones 023 y 024).

  * El puesto publicado se traduce bien a rango («=6», «501–600», «151+»).
  * El cargador lleva a `posicion_oficial` el puesto de cada universidad en cada
    edición tal como está en las instantáneas, y a `estado_ranking` lo que dice
    estado.json. Se prueba dentro de transacciones que se deshacen.
  * La API lo entrega: `/rankings` la última edición cargada y la publicada,
    `/ranking-resumen` el puesto oficial. Para eso se escriben dos filas y se
    borran al final.
  * THE World existe, reparte 100 % entre sus pilares y queda reservado al plan de
    pago, como todo «THE …».

Sin la migración 023 la batería se omite.
"""
import json
import os
import sys
import uuid

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(RAIZ)
sys.path.insert(0, RAIZ)
sys.path.insert(0, os.path.join(REPO, "tools", "rankings"))

from dotenv import load_dotenv

load_dotenv(os.path.join(RAIZ, ".env"))
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import acceso, auth, main
from app.db import engine
import cargar
import comun

fallos = []
usuarios = []


def comprobar(nombre, cond, detalle=""):
    print(f"  [{'OK ' if cond else 'FALLA'}] {nombre}" + (f" -> {detalle}" if detalle and not cond else ""))
    if not cond:
        fallos.append(nombre)


def crear_usuario(plan):
    correo = f"actualizacion-{uuid.uuid4().hex[:8]}@pucv.cl"
    db = main.SessionLocal()
    uid = db.execute(text("""
        INSERT INTO usuario (nombre_usuario, correo_usuario, clave_usuario, institucion_usuario, plan_usuario)
        VALUES ('Prueba actualización', :c, 'x', 'Pontificia Universidad Catolica de Valparaiso', :p)
        RETURNING id_usuario"""), {"c": correo, "p": plan}).scalar()
    db.commit()
    db.close()
    usuarios.append(uid)
    return {"Authorization": f"Bearer {auth.crear_token(uid, correo)[0]}"}


print("=== 1. El puesto publicado como rango ===")
for texto, esperado in (("22", (22, 22)), ("=6", (6, 6)), ("501-600", (501, 600)), ("1601–1800", (1601, 1800)),
                        ("151+", (151, None)), ("Reporter", (None, None)), ("", (None, None))):
    comprobar(f"«{texto}» → {esperado}", comun.rango_posicion(texto) == esperado, comun.rango_posicion(texto))

with engine.connect() as conexion:
    if not cargar._hay_tabla(conexion, "posicion_oficial"):
        print("  (sin la migración 023: aplica backend/migraciones/023_posicion_y_actualizacion.sql)")
        print("\n" + "=" * 74 + f"\nFALLOS: {len(fallos)}" + ("  (omitida)" if not fallos else ""))
        sys.exit(1 if fallos else 0)
    base = cargar.Base(conexion)
    conexion.rollback()

    print("\n=== 2. La posición oficial sale de las instantáneas ===")
    transaccion = conexion.begin()
    try:
        ediciones, distintas = 0, []
        for clave in comun.RANKINGS:
            if comun.RANKINGS[clave] not in base.rankings:
                continue
            for edicion in comun.ediciones_guardadas(clave):
                filas, _ = comun.leer_instantanea(clave, edicion)
                cargar.sincronizar_posiciones(base, clave, edicion, filas, escribir=True)
                id_ranking = base.rankings[comun.RANKINGS[clave]].id_ranking
                guardadas = {(r.disciplina, r.id_universidad): (r.posicion, r.desde, r.hasta)
                             for r in conexion.execute(text("""
                                 SELECT disciplina, id_universidad, posicion, desde, hasta FROM posicion_oficial
                                 WHERE id_ranking = :r AND anio = :a"""), {"r": id_ranking, "a": edicion})}
                esperadas = {(f.disciplina, base.universidades[f.universidad]): (f.posicion, *comun.rango_posicion(f.posicion))
                             for f in filas if f.posicion and f.universidad in base.universidades}
                ediciones += 1
                if guardadas != esperadas:
                    distintas.append(f"{comun.RANKINGS[clave]} {edicion}")
        comprobar(f"en las {ediciones} ediciones, el puesto guardado es el de la fuente", not distintas, distintas[:3])
        sin_rango = conexion.execute(text("SELECT count(*) FROM posicion_oficial WHERE desde IS NULL")).scalar()
        comprobar("todo puesto publicado tiene su rango numérico", sin_rango == 0, sin_rango)
        segunda = sum(cargar.sincronizar_posiciones(base, c, e, comun.leer_instantanea(c, e)[0], escribir=True)
                      for c in comun.RANKINGS if comun.RANKINGS[c] in base.rankings
                      for e in comun.ediciones_guardadas(c))
        comprobar("una segunda pasada no cambia nada", segunda == 0, segunda)
    finally:
        transaccion.rollback()

    print("\n=== 3. El estado de cada ranking sale de estado.json ===")
    estado = json.loads((comun.INSTANTANEAS / "estado.json").read_text(encoding="utf-8"))
    comprobar("estado.json trae los rankings que la revisión vigila",
              {"THE Latam", "THE World", "QS Latam", "QS Global", "Shanghai ARWU", "Shanghai GRAS",
               "Scimago Latam"} <= set(estado), sorted(estado))
    comprobar("cada entrada dice si salió de la fuente o del calendario",
              all(e.get("como") in ("fuente", "calendario") and isinstance(e.get("ultima_publicada"), int)
                  for e in estado.values()), estado)
    transaccion = conexion.begin()
    try:
        cargar.sincronizar_estado(base, escribir=True)
        guardado = {r.nombre_ranking: (r.ultima_publicada, r.como) for r in conexion.execute(text("""
            SELECT r.nombre_ranking, e.ultima_publicada, e.como FROM estado_ranking e
            JOIN ranking r USING (id_ranking)"""))}
        comprobar("estado_ranking queda igual que estado.json",
                  all(guardado.get(n) == (e["ultima_publicada"], e["como"]) for n, e in estado.items() if n in base.rankings),
                  guardado)
        comprobar("y una segunda pasada no cambia nada", cargar.sincronizar_estado(base, escribir=True) == [])
    finally:
        transaccion.rollback()

    print("\n=== 4. THE World ===")
    the_world = base.rankings.get("THE World")
    comprobar("existe (migración 024)", the_world is not None)
    if the_world:
        pilares = conexion.execute(text("""
            SELECT sum(peso_metrica) FILTER (WHERE pondera), count(*) FILTER (WHERE tipo_metrica = 'Puntaje')
            FROM metrica WHERE id_ranking = :r"""), {"r": the_world.id_ranking}).first()
        comprobar("sus pilares reparten 100 % y tiene puntaje total", pilares[0] == 100 and pilares[1] == 1, pilares)
        comprobar("queda reservado al plan de pago", the_world.id_ranking in acceso.ids_restringidos(main.SessionLocal()))
    conexion.rollback()

cliente = TestClient(main.app)
pago = crear_usuario("investigador")
db = main.SessionLocal()
agregadas = []
try:
    print("\n=== 5. Lo entrega la API ===")
    scimago = db.execute(text("SELECT id_ranking FROM ranking WHERE nombre_ranking = 'Scimago Latam'")).scalar()
    previo = db.execute(text("SELECT ultima_publicada, como, nota FROM estado_ranking WHERE id_ranking = :r"),
                        {"r": scimago}).first()
    db.execute(text("""
        INSERT INTO estado_ranking (id_ranking, ultima_publicada, como, nota) VALUES (:r, 2099, 'calendario', 'Prueba')
        ON CONFLICT (id_ranking) DO UPDATE SET ultima_publicada = 2099, como = 'calendario', nota = 'Prueba'"""),
        {"r": scimago})
    db.commit()
    catalogo = {r["nombre_ranking"]: r for r in cliente.get("/rankings", headers=pago).json()}
    sc = catalogo["Scimago Latam"]
    comprobar("/rankings dice la última edición cargada", isinstance(sc["ultima_cargada"], int) and sc["ultima_cargada"] >= 2025,
              sc.get("ultima_cargada"))
    comprobar("y la última publicada, con cómo se supo y su nota",
              sc["ultima_publicada"] == 2099 and sc["ultima_publicada_como"] == "calendario"
              and sc["ultima_publicada_nota"] == "Prueba", sc)
    if previo is None:
        db.execute(text("DELETE FROM estado_ranking WHERE id_ranking = :r"), {"r": scimago})
    else:
        db.execute(text("UPDATE estado_ranking SET ultima_publicada = :u, como = :c, nota = :n WHERE id_ranking = :r"),
                   {"u": previo[0], "c": previo[1], "n": previo[2], "r": scimago})
    db.commit()

    qs = db.execute(text("SELECT id_ranking FROM ranking WHERE nombre_ranking = 'QS Latam'")).scalar()
    anio = db.execute(text("""SELECT max(mu.anio_metrica) FROM metrica_universidad mu JOIN metrica m USING (id_metrica)
                              WHERE m.id_ranking = :r"""), {"r": qs}).scalar()
    pucv = db.execute(text("SELECT id_universidad FROM universidad WHERE nombre_universidad = "
                           "'Pontificia Universidad Catolica de Valparaiso'")).scalar()
    ya = db.execute(text("""SELECT posicion FROM posicion_oficial WHERE id_ranking = :r AND anio = :a
                            AND id_universidad = :u AND disciplina = 'General'"""), {"r": qs, "a": anio, "u": pucv}).scalar()
    if ya is None:
        db.execute(text("""INSERT INTO posicion_oficial (id_ranking, disciplina, id_universidad, anio, posicion, desde, hasta)
                           VALUES (:r, 'General', :u, :a, '=99', 99, 99)"""), {"r": qs, "u": pucv, "a": anio})
        db.commit()
        agregadas.append((qs, pucv, anio))
    esperado = ya or "=99"
    resumen = cliente.get(f"/ranking-resumen?ranking_id={qs}&anio={anio}", headers=pago).json()
    fila = next((f for f in resumen if f["id_universidad"] == pucv), None)
    comprobar("/ranking-resumen trae el puesto oficial", fila is not None and fila["posicion_oficial"] == esperado, fila)
    comprobar("las demás también lo traen, o vacío", all("posicion_oficial" in f for f in resumen))
finally:
    for r, u, a in agregadas:
        db.execute(text("DELETE FROM posicion_oficial WHERE id_ranking = :r AND id_universidad = :u AND anio = :a"),
                   {"r": r, "u": u, "a": a})
    db.execute(text("DELETE FROM usuario WHERE id_usuario = ANY(:ids)"), {"ids": usuarios})
    db.commit()
    db.close()

print("\n" + "=" * 74)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
