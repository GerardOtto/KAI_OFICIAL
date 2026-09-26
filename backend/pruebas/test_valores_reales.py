"""Modo numérico: los valores medidos detrás de los puntajes.

`/valores-reales` sirve dos orígenes —valores medidos aparte (THE, QS, Ranking
KAI) y valores que la fuente publica crudos (Scimago)— y declara qué parte del
ranking cubre. Esta batería vigila lo que haría engañosa la vista si fallara:

  * que la cobertura cuente componentes y no pilares, y que sus pesos cuadren;
  * que la calidad de cada valor sea una de las tres que la interfaz explica;
  * que no aparezcan universidades que el ranking no clasificó ese año;
  * que no aparezcan ediciones que el ranking no publicó;
  * que en Scimago los valores sean exactamente los de la tabla de observaciones;
  * que THE y QS sigan reservados al plan de pago también en valores medidos;
  * y que el catálogo marque bien qué rankings tienen valores.

Sin la migración 008 o sin datos cargados, la batería se omite.
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

from app import acceso, auth, main

fallos = []
usuarios = []


def comprobar(nombre, cond, detalle=""):
    print(f"  [{'OK ' if cond else 'FALLA'}] {nombre}" + (f" -> {detalle}" if detalle and not cond else ""))
    if not cond:
        fallos.append(nombre)


def crear_usuario(plan):
    correo = f"valores-{uuid.uuid4().hex[:8]}@pucv.cl"
    db = main.SessionLocal()
    uid = db.execute(text("""
        INSERT INTO usuario (nombre_usuario, correo_usuario, clave_usuario,
                             institucion_usuario, plan_usuario)
        VALUES ('Prueba valores', :c, 'x', 'Pontificia Universidad Catolica de Valparaiso', :p)
        RETURNING id_usuario"""), {"c": correo, "p": plan}).scalar()
    db.commit()
    db.close()
    usuarios.append(uid)
    token, _ = auth.crear_token(uid, correo)
    return {"Authorization": f"Bearer {token}"}


cliente = TestClient(main.app)
db = main.SessionLocal()
try:
    hay_tabla = db.execute(text("SELECT to_regclass('public.valor_real_universidad') IS NOT NULL")).scalar()
    cargados = hay_tabla and db.execute(text("SELECT count(*) FROM valor_real_universidad")).scalar()
    if not cargados:
        print("  (sin valores medidos cargados: aplica 008-010 y los cargadores)")
        print("\n" + "=" * 74 + "\nFALLOS: 0  (omitida)")
        sys.exit(0)
    ids = {r[1]: r[0] for r in db.execute(text("SELECT id_ranking, nombre_ranking FROM ranking"))}
finally:
    db.close()

gratis = crear_usuario(acceso.PLAN_GRATUITO)
pago = crear_usuario("investigador")

try:
    print("=== 1. El catálogo dice qué rankings tienen valores medidos ===")
    catalogo = {r["nombre_ranking"]: r for r in cliente.get("/rankings", headers=gratis).json()}
    for nombre in ("THE Latam", "QS Latam", "QS Global", "Scimago Latam", "Ranking KAI"):
        if nombre in catalogo:
            comprobar(f"{nombre} figura con valores medidos", catalogo[nombre]["tiene_valores_reales"] is True)
    for nombre in ("Shanghai GRAS", "Shanghai ARWU", "QS por Disciplina"):
        if nombre in catalogo:
            comprobar(f"{nombre} figura sin valores medidos", catalogo[nombre]["tiene_valores_reales"] is False)

    print("\n=== 2. Acceso por plan ===")
    r = cliente.get(f"/valores-reales?ranking_id={ids['THE Latam']}", headers=gratis)
    comprobar("THE Latam en valores medidos sigue reservado al plan de pago", r.status_code == 403, r.status_code)
    r = cliente.get(f"/valores-reales?ranking_id={ids['THE Latam']}", headers=pago)
    comprobar("un plan de pago lo consulta", r.status_code == 200, r.status_code)
    r = cliente.get(f"/valores-reales?ranking_id={ids['Ranking KAI']}", headers=gratis)
    comprobar("el Ranking KAI se abre en el plan gratuito", r.status_code == 200, r.status_code)
    comprobar("un ranking inexistente responde 404",
              cliente.get("/valores-reales?ranking_id=999999", headers=pago).status_code == 404)

    print("\n=== 3. THE Latam: cobertura y calidades ===")
    the = cliente.get(f"/valores-reales?ranking_id={ids['THE Latam']}", headers=pago).json()
    c = the["cobertura"]
    comprobar("la cobertura cuenta las 17 componentes, no los 5 pilares", c["componentes"] == 17, c["componentes"])
    comprobar("las componentes reparten 100 puntos", abs(c["peso_total"] - 100) < 0.01, c["peso_total"])
    comprobar("el peso con valor no supera el total", 0 < c["peso_con_valor"] <= c["peso_total"], c)
    suma = sum(m["peso_metrica"] for m in the["metricas"] if m["es_componente"] and m["tiene_valores"])
    comprobar("el peso con valor es la suma de las componentes que lo tienen", abs(suma - c["peso_con_valor"]) < 0.01,
              f"{suma} frente a {c['peso_con_valor']}")
    comprobar("toda calidad es una de las tres que la interfaz explica",
              set(c["calidades"]) <= {"directa", "aproximada", "parcial"}, c["calidades"])
    comprobar("el origen es «medido»", the["origen"] == "medido")
    reputacion = [m for m in the["metricas"] if "reputation" in m["nombre_metrica"]]
    comprobar("la reputación figura sin valor", reputacion and not any(m["tiene_valores"] for m in reputacion))

    db = main.SessionLocal()
    publicadas = {a for (a,) in db.execute(text("""
        SELECT DISTINCT mu.anio_metrica FROM metrica_universidad mu
        JOIN metrica m ON m.id_metrica = mu.id_metrica WHERE m.id_ranking = :r"""),
        {"r": ids["THE Latam"]})}
    clasificadas = {u for (u,) in db.execute(text("""
        SELECT DISTINCT mu.id_universidad FROM metrica_universidad mu
        JOIN metrica m ON m.id_metrica = mu.id_metrica
        WHERE m.id_ranking = :r AND mu.anio_metrica = :a"""), {"r": ids["THE Latam"], "a": the["anio"]})}
    db.close()
    comprobar("solo ediciones que THE publicó", set(the["anios"]) <= publicadas,
              sorted(set(the["anios"]) - publicadas))
    comprobar("THE Latam 2025, que no se publicó, no aparece", 2025 not in the["anios"], the["anios"])
    comprobar("solo universidades que THE clasificó ese año",
              {v["id_universidad"] for v in the["valores"]} <= clasificadas,
              len({v["id_universidad"] for v in the["valores"]} - clasificadas))
    comprobar("todo valor lleva unidad, fórmula y fuentes",
              all(v["unidad"] and v["formula"] and v["fuentes"] for v in the["valores"]))

    anterior = cliente.get(f"/valores-reales?ranking_id={ids['THE Latam']}&anio=2024", headers=pago).json()
    comprobar("en 2024 la cobertura es mayor que en 2026: Scimago aún publicaba indicadores",
              anterior["cobertura"]["peso_con_valor"] > c["peso_con_valor"],
              f"{anterior['cobertura']['peso_con_valor']} frente a {c['peso_con_valor']}")
    vacio = cliente.get(f"/valores-reales?ranking_id={ids['THE Latam']}&anio=2016", headers=pago).json()
    comprobar("un año sin valores devuelve la lista vacía y los años que sí tienen",
              vacio["valores"] == [] and vacio["anios"], len(vacio["anios"]))

    print("\n=== 4. Scimago en dos modos ===")
    sci = cliente.get(f"/valores-reales?ranking_id={ids['Scimago Latam']}", headers=gratis).json()
    comprobar("el origen es «fuente»: SCImago publica esas cifras", sci["origen"] == "fuente")
    db = main.SessionLocal()
    crudos = db.execute(text("SELECT count(*) FROM ranking WHERE valores_son_crudos")).scalar()
    puntajes = {(r[0], r[1], r[2]): float(r[3]) for r in db.execute(text("""
        SELECT mu.id_metrica, mu.id_universidad, mu.anio_metrica, mu.valor_metrica
        FROM metrica_universidad mu JOIN metrica m ON m.id_metrica = mu.id_metrica
        WHERE m.id_ranking = :r"""), {"r": ids["Scimago Latam"]})}
    medidos = {(r[0], r[1], r[2]): float(r[3]) for r in db.execute(text("""
        SELECT v.id_metrica, v.id_universidad, v.anio_edicion, v.valor
        FROM valor_real_universidad v JOIN metrica m ON m.id_metrica = v.id_metrica
        WHERE m.id_ranking = :r"""), {"r": ids["Scimago Latam"]})}
    db.close()
    comprobar("ningún ranking guarda ya cifras crudas como puntajes", crudos == 0, crudos)
    comprobar("cada puntaje de Scimago tiene su cifra medida con la misma clave",
              set(puntajes) == set(medidos), f"{len(set(puntajes) ^ set(medidos))} sin pareja")
    comprobar("todos los puntajes de Scimago quedan entre 0 y 100",
              all(0 <= v <= 100 for v in puntajes.values()))
    # El puntaje es el percentil de la cifra medida entre las universidades del año.
    grupos = {}
    for (m, u, a), x in medidos.items():
        grupos.setdefault((m, a), []).append((u, x))
    malos = 0
    for (m, a), pares in grupos.items():
        n = len(pares)
        for u, x in pares:
            esperado = 100.0 if n == 1 else 100.0 * sum(1 for _, y in pares if y < x) / (n - 1)
            if abs(puntajes[(m, u, a)] - esperado) > 0.01:
                malos += 1
    comprobar("cada puntaje de Scimago es el percentil de su cifra medida", malos == 0, malos)
    comprobar("la vista numérica de Scimago entrega las cifras, no los percentiles",
              len(sci["valores"]) > 0 and all(
                  abs(float(v["valor"]) - medidos[(v["id_metrica"], v["id_universidad"], sci["anio"])]) < 1e-9
                  for v in sci["valores"]))
    con_unidad = sum(1 for v in sci["valores"] if v["unidad"] and v["unidad"] != "según SCImago")
    comprobar("casi todas sus cifras llevan unidad", con_unidad >= 0.9 * len(sci["valores"]),
              f"{con_unidad} de {len(sci['valores'])}")
    total = cliente.get(f"/ranking-resumen?ranking_id={ids['Scimago Latam']}&anio={sci['anio']}",
                        headers=gratis).json()
    comprobar("el total de la pantalla de puntajes vuelve a la escala 0-100",
              bool(total) and all(0 <= float(f["score_total"]) <= 100 for f in total),
              max((float(f["score_total"]) for f in total), default=None))

    print("\n=== 5. Ranking KAI ===")
    kai = cliente.get(f"/valores-reales?ranking_id={ids['Ranking KAI']}", headers=gratis).json()
    comprobar("cubre sus diez componentes y los 100 puntos",
              kai["cobertura"]["componentes_con_valor"] == 10 and abs(kai["cobertura"]["peso_con_valor"] - 100) < 0.01,
              kai["cobertura"])
    comprobar("todos sus valores son medidos", set(kai["cobertura"]["calidades"]) == {"directa"},
              kai["cobertura"]["calidades"])

    print("\n=== 6. El modo global en cada endpoint ===")
    kai_id, sci_id, the_id = ids["Ranking KAI"], ids["Scimago Latam"], ids["THE Latam"]
    catalogo = {r["nombre_ranking"]: r for r in cliente.get("/rankings", headers=gratis).json()}
    comprobar("el catálogo dice cómo normaliza cada ranking",
              catalogo["Ranking KAI"]["normalizacion"] == "percentil"
              and catalogo["Scimago Latam"]["normalizacion"] == "percentil"
              and catalogo["THE Latam"]["normalizacion"] == "propia",
              {k: v.get("normalizacion") for k, v in catalogo.items()})
    comprobar("un modo desconocido se rechaza",
              cliente.get(f"/anios?ranking_id={kai_id}&modo=otro", headers=gratis).status_code == 422)

    anios_p = cliente.get(f"/anios?ranking_id={the_id}", headers=pago).json()
    anios_n = cliente.get(f"/anios?ranking_id={the_id}&modo=numerico", headers=pago).json()
    comprobar("los años con cifras son un subconjunto de los años con puntaje",
              set(anios_n) <= set(anios_p) and anios_n, f"{anios_n} frente a {anios_p}")

    met_n = cliente.get(f"/metricas-con-datos?ranking_id={the_id}&modo=numerico", headers=pago).json()
    comprobar("en THE, las métricas con cifras son indicadores y traen unidad",
              met_n and all(m["unidad"] for m in met_n)
              and not any(m["nombre_metrica"] in ("Teaching", "Research Quality") for m in met_n),
              [m["nombre_metrica"] for m in met_n][:5])
    met_p = cliente.get(f"/metricas-con-datos?ranking_id={the_id}", headers=pago).json()
    comprobar("en puntajes, siguen siendo los pilares", any(m["nombre_metrica"] == "Teaching" for m in met_p))

    id_ssr = next(m["id_metrica"] for m in cliente.get(f"/valores-reales?ranking_id={kai_id}", headers=gratis).json()["metricas"]
                  if m["nombre_metrica"] == "Estudiantes por académico")
    serie_n = cliente.get(f"/trends?ranking_id={kai_id}&metrica_id={id_ssr}&universidades=2&modo=numerico",
                          headers=gratis).json()["data"]
    serie_p = cliente.get(f"/trends?ranking_id={kai_id}&metrica_id={id_ssr}&universidades=2",
                          headers=gratis).json()["data"]
    db = main.SessionLocal()
    reales = {a: float(v) for a, v in db.execute(text("""
        SELECT anio_edicion, valor FROM valor_real_universidad
        WHERE id_metrica = :m AND id_universidad = 2"""), {"m": id_ssr})}
    db.close()
    comprobar("la serie numérica de Tendencias son las cifras medidas",
              serie_n and all(abs(float(f["valor"]) - reales[f["anio"]]) < 1e-9 for f in serie_n)
              and all(f["unidad"] for f in serie_n), serie_n[:2])
    comprobar("la serie de puntajes sigue en 0-100 y difiere de la numérica",
              serie_p and all(0 <= float(f["valor"]) <= 100 for f in serie_p)
              and [float(f["valor"]) for f in serie_p] != [float(f["valor"]) for f in serie_n])

    ultimo = max(reales)
    comp = cliente.get(f"/tendencias-comparacion?ranking_id={kai_id}&anio={ultimo}&metricas={id_ssr}&modo=numerico",
                       headers=gratis).json()
    comprobar("la comparación anual numérica trae la cifra, su unidad y un techo en esa escala",
              comp and all(f["unidad"] for f in comp) and float(comp[0]["techo"]) >= max(float(f["valor"]) for f in comp),
              comp[:1])

    sim_n = cliente.get(f"/simulacion?ranking_id={kai_id}&anio={ultimo}&modo=numerico", headers=gratis).json()
    comprobar("la simulación numérica trae todas las universidades con cifra, sentido y unidad",
              len({f["id_universidad"] for f in sim_n}) > 30 and all(f["sentido"] in ("mayor", "menor") for f in sim_n)
              and all(f["unidad"] for f in sim_n), len(sim_n))
    sim_the = cliente.get(f"/simulacion?ranking_id={the_id}&anio={anios_n[0]}&modo=numerico", headers=pago).json()
    comprobar("en THE numérico la simulación incluye los indicadores de referencia",
              sim_the and any(not f["pondera"] for f in sim_the))

    glos = cliente.get(f"/valores-metrica-universidad?tipo=Alumnado&universidad_id=2&anio={ultimo}&modo=numerico",
                       headers=gratis).json()
    comprobar("el glosario numérico trae la cifra con su unidad",
              glos and all(f["unidad"] for f in glos), glos[:1])

    print("\n=== 7. Un ranking sin valores medidos ===")
    gras = cliente.get(f"/valores-reales?ranking_id={ids['Shanghai GRAS']}", headers=gratis).json()
    comprobar("Shanghai GRAS responde sin años ni valores", gras["anios"] == [] and gras["valores"] == [], gras["anios"])
finally:
    db = main.SessionLocal()
    db.execute(text("DELETE FROM usuario WHERE id_usuario = ANY(:ids)"), {"ids": usuarios})
    db.commit()
    quedan = db.execute(text("SELECT count(*) FROM usuario WHERE id_usuario = ANY(:ids)"), {"ids": usuarios}).scalar()
    db.close()
    comprobar("los usuarios de prueba se eliminaron", quedan == 0, quedan)

print("\n" + "=" * 74)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
