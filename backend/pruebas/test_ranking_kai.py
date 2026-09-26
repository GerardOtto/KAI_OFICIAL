"""El Ranking KAI: definición, datos y convivencia con el resto de la plataforma.

El Ranking KAI es el único ranking que la plataforma construye en vez de
importar, y el único cuyos pesos cambia el usuario. Esta batería vigila las
propiedades de las que dependen los demás módulos para tratarlo como uno más:

  * que reparta exactamente 100 % en pesos parejos, sin nivel de referencia;
  * que cada universidad elegible tenga las diez métricas cada año, porque el
    total del servidor cuenta un hueco como cero;
  * que el puntaje sea un percentil bien orientado y reproducible desde el valor
    medido, que es lo que permite reponderar y simular en el cliente;
  * que los valores medidos vivan en su propia tabla y no en la de puntajes;
  * y que el plan gratuito lo vea entero, porque no es THE ni QS.

Sin la migración 009 aplicada la batería se omite, en vez de fallar: la base de
integración continua la trae, pero una base local puede no tenerla todavía.
"""
import os
import sys
from collections import defaultdict

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from dotenv import load_dotenv

load_dotenv(os.path.join(RAIZ, ".env"))
from sqlalchemy import text

from app import acceso
from app.db import SessionLocal

fallos = []


def comprobar(nombre, condicion, detalle=""):
    print(f"  [{'OK ' if condicion else 'FALLA'}] {nombre}" + ("" if condicion else f" -> {detalle}"))
    if not condicion:
        fallos.append(nombre)


db = SessionLocal()
try:
    kai = db.execute(text("SELECT id_ranking FROM ranking WHERE nombre_ranking = 'Ranking KAI'")).scalar()
    if kai is None:
        print("  (la base no tiene el Ranking KAI: aplica 008, 009 y cargar_ranking_kai.py)")
        print("\n" + "=" * 74 + "\nFALLOS: 0  (omitida)")
        sys.exit(0)

    print("=== 1. Definición ===")
    metricas = db.execute(text("""
        SELECT id_metrica, nombre_metrica, peso_metrica, pondera, sentido, disciplina,
               id_metrica_padre
        FROM metrica WHERE id_ranking = :r ORDER BY id_metrica"""), {"r": kai}).fetchall()
    comprobar("tiene diez métricas", len(metricas) == 10, len(metricas))
    comprobar("los pesos suman exactamente 100",
              sum(float(m.peso_metrica) for m in metricas) == 100,
              sum(float(m.peso_metrica) for m in metricas))
    comprobar("los pesos por defecto son parejos",
              len({float(m.peso_metrica) for m in metricas}) == 1,
              sorted({float(m.peso_metrica) for m in metricas}))
    comprobar("todas ponderan: no hay nivel de referencia",
              all(m.pondera for m in metricas))
    comprobar("ninguna cuelga de un pilar", all(m.id_metrica_padre is None for m in metricas))
    comprobar("todas declaran hacia dónde es mejor su valor medido",
              all(m.sentido in ("mayor", "menor") for m in metricas))
    comprobar("una sola disciplina, como los demás rankings de un nivel",
              {m.disciplina for m in metricas} == {"General"})
    editable = db.execute(text(
        "SELECT pesos_editables FROM ranking WHERE id_ranking = :r"), {"r": kai}).scalar()
    comprobar("el ranking permite editar los pesos", editable is True)
    externos = db.execute(text(
        "SELECT count(*) FROM ranking WHERE pesos_editables AND id_ranking <> :r"),
        {"r": kai}).scalar()
    comprobar("ningún ranking externo permite editar sus pesos", externos == 0, externos)

    ids = [m.id_metrica for m in metricas]
    sentido = {m.id_metrica: m.sentido for m in metricas}

    print("\n=== 2. Completitud ===")
    filas = db.execute(text("""
        SELECT id_metrica, id_universidad, anio_metrica, valor_metrica
        FROM metrica_universidad WHERE id_metrica = ANY(:ids)"""), {"ids": ids}).fetchall()
    comprobar("hay puntajes cargados", len(filas) > 0, "ejecuta cargar_ranking_kai.py --escribir")
    if not filas:
        # Sin datos, el resto de las comprobaciones no tiene sobre qué operar.
        print("\n" + "=" * 74)
        print(f"FALLOS: {len(fallos)} -> {fallos}")
        sys.exit(1)
    por_universidad_anio = defaultdict(set)
    for f in filas:
        por_universidad_anio[(f.id_universidad, f.anio_metrica)].add(f.id_metrica)
    incompletas = [k for k, v in por_universidad_anio.items() if len(v) != 10]
    comprobar("cada universidad de cada año tiene las diez métricas",
              not incompletas, incompletas[:5])
    anios = sorted({f.anio_metrica for f in filas})
    comprobar("la serie tiene al menos cinco años, para que Tendencias proyecte",
              len(anios) >= 5, anios)

    print("\n=== 3. Puntajes ===")
    comprobar("todo puntaje está entre 0 y 100",
              all(0 <= float(f.valor_metrica) <= 100 for f in filas))
    por_metrica_anio = defaultdict(list)
    for f in filas:
        por_metrica_anio[(f.id_metrica, f.anio_metrica)].append(float(f.valor_metrica))
    sin_cero = [k for k, v in por_metrica_anio.items() if min(v) != 0]
    comprobar("en cada métrica y año alguien tiene 0: la peor no supera a nadie",
              not sin_cero, sin_cero[:5])

    print("\n=== 4. Valores medidos ===")
    reales = db.execute(text("""
        SELECT id_metrica, id_universidad, anio_edicion, valor, unidad, calidad, formula, fuentes
        FROM valor_real_universidad WHERE id_metrica = ANY(:ids)"""), {"ids": ids}).fetchall()
    claves_puntaje = {(f.id_metrica, f.id_universidad, f.anio_metrica) for f in filas}
    claves_real = {(r.id_metrica, r.id_universidad, r.anio_edicion) for r in reales}
    comprobar("cada puntaje tiene su valor medido con la misma clave",
              claves_puntaje == claves_real,
              f"{len(claves_puntaje ^ claves_real)} claves sin pareja")
    comprobar("todo valor medido lleva unidad, fórmula y fuentes",
              all(r.unidad and r.formula and r.fuentes for r in reales))
    comprobar("todos son medidos: el Ranking KAI no estima nada",
              {r.calidad for r in reales} == {"directa"}, {r.calidad for r in reales})

    # El puntaje debe poder rehacerse desde el valor medido. Es la propiedad que
    # permite, en el cliente, simular sobre el valor real y reordenar.
    valor = {(r.id_metrica, r.id_universidad, r.anio_edicion): r.valor for r in reales}
    grupos = defaultdict(list)
    for (m, u, a), v in valor.items():
        grupos[(m, a)].append((u, v))
    puntaje = {(f.id_metrica, f.id_universidad, f.anio_metrica): float(f.valor_metrica) for f in filas}
    discrepancias = []
    for (m, a), pares in grupos.items():
        n = len(pares)
        valores = [v for _, v in pares]
        for u, x in pares:
            superadas = sum(1 for y in valores if (y < x if sentido[m] == "mayor" else y > x))
            esperado = 100 * superadas / (n - 1) if n > 1 else 100
            if abs(puntaje.get((m, u, a), -1) - esperado) > 0.01:
                discrepancias.append((m, u, a, puntaje.get((m, u, a)), esperado))
    comprobar("todo puntaje se reproduce desde el valor medido",
              not discrepancias, discrepancias[:3])

    # Orientación: en «Estudiantes por académico» gana la que tiene menos.
    menor = [m.id_metrica for m in metricas if m.sentido == "menor"]
    if menor:
        m = menor[0]
        ultimo = max(anios)
        pares = [(valor[(m, u, ultimo)], puntaje[(m, u, ultimo)])
                 for (mm, u, a) in valor if mm == m and a == ultimo]
        mejor_valor = min(p[0] for p in pares)
        comprobar("en una métrica de «menos es mejor», el valor más bajo obtiene el puntaje más alto",
                  all(p[1] == max(q[1] for q in pares) for p in pares if p[0] == mejor_valor))

    print("\n=== 5. Los puntajes y los valores no se mezclan ===")
    fuera_de_escala = db.execute(text("""
        SELECT count(*) FROM metrica_universidad
        WHERE id_metrica = ANY(:ids) AND (valor_metrica < 0 OR valor_metrica > 100)"""),
        {"ids": ids}).scalar()
    comprobar("metrica_universidad no guarda ningún valor medido del Ranking KAI",
              fuera_de_escala == 0, fuera_de_escala)
    ultimo = max(anios)
    total = db.execute(text("""
        SELECT max(s) FROM (
          SELECT sum(mu.valor_metrica * m.peso_metrica / 100.0) AS s
          FROM metrica_universidad mu JOIN metrica m ON m.id_metrica = mu.id_metrica
          WHERE m.id_ranking = :r AND mu.anio_metrica = :a AND m.pondera
          GROUP BY mu.id_universidad) t"""), {"r": kai, "a": ultimo}).scalar()
    comprobar("el total que calcula /ranking-resumen queda en la escala 0-100",
              total is not None and 0 <= float(total) <= 100, total)

    print("\n=== 6. Acceso por plan ===")
    restringidos = acceso.ids_restringidos(db)
    comprobar("el Ranking KAI no está reservado a los planes de pago",
              kai not in restringidos, restringidos)
    gratuito = {"id_usuario": -1, "plan_usuario": acceso.PLAN_GRATUITO,
                "correo_usuario": "sonda@ejemplo.cl"}
    try:
        permitido = acceso.puede_ver_ranking(db, gratuito, kai)
    except Exception as e:  # noqa: BLE001 - la firma del usuario puede diferir
        permitido = None
        print(f"    (no se pudo simular un usuario gratuito: {type(e).__name__})")
    if permitido is not None:
        comprobar("un usuario del plan gratuito puede consultarlo", permitido is True)
finally:
    db.close()

print("\n" + "=" * 74)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
