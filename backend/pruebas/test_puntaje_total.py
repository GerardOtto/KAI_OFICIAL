"""Puntaje total: cada universidad lo tiene, en cada ranking, y es el correcto.

La migración 020 guarda el puntaje total de cada ranking como una métrica más
(«Puntaje total», tipo «Puntaje») y corrige tres errores que impedían confiar en
él. Esta batería vigila:

  * que exista en todos los rankings y nunca entre en una suma de pesos;
  * la cobertura: en THE, Scimago, GRAS, ARWU y el Ranking KAI, toda universidad
    clasificada lo tiene; en QS solo donde QS lo publica, y nunca como un 0;
  * que los calculados coincidan con su método (GRAS suma, Scimago y KAI suma
    ponderada) y los publicados con la fuente (cifras tomadas a mano de las
    planillas y CSV de KAI/ y de la API de ShanghaiRanking);
  * que QS Global 2026 ya no tenga sus columnas corridas;
  * que los pesos de THE Latam reproduzcan su total publicado;
  * y que lo lean los endpoints de Tendencias, Simulación y Glosario.

Sin las migraciones 020 y 021 la batería se omite.
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

from app import auth, main

fallos = []
usuarios = []

PUCV = "Pontificia Universidad Catolica de Valparaiso"


def comprobar(nombre, cond, detalle=""):
    print(f"  [{'OK ' if cond else 'FALLA'}] {nombre}" + (f" -> {detalle}" if detalle and not cond else ""))
    if not cond:
        fallos.append(nombre)


def crear_usuario():
    correo = f"total-{uuid.uuid4().hex[:8]}@pucv.cl"
    db = main.SessionLocal()
    uid = db.execute(text("""
        INSERT INTO usuario (nombre_usuario, correo_usuario, clave_usuario,
                             institucion_usuario, plan_usuario)
        VALUES ('Prueba total', :c, 'x', :i, 'investigador')
        RETURNING id_usuario"""), {"c": correo, "i": PUCV}).scalar()
    db.commit()
    db.close()
    usuarios.append(uid)
    token, _ = auth.crear_token(uid, correo)
    return {"Authorization": f"Bearer {token}"}


def total(db, ranking, universidad, anio, disciplina="General"):
    v = db.execute(text("""
        SELECT mu.valor_metrica FROM metrica_universidad mu
        JOIN metrica m ON m.id_metrica = mu.id_metrica
        JOIN ranking r ON r.id_ranking = m.id_ranking
        JOIN universidad u ON u.id_universidad = mu.id_universidad
        WHERE r.nombre_ranking = :r AND m.tipo_metrica = 'Puntaje' AND m.disciplina = :d
          AND u.nombre_universidad = :u AND mu.anio_metrica = :a"""),
        {"r": ranking, "u": universidad, "a": anio, "d": disciplina}).scalar()
    return None if v is None else float(v)


def valor(db, ranking, metrica, universidad, anio):
    v = db.execute(text("""
        SELECT mu.valor_metrica FROM metrica_universidad mu
        JOIN metrica m ON m.id_metrica = mu.id_metrica
        JOIN ranking r ON r.id_ranking = m.id_ranking
        JOIN universidad u ON u.id_universidad = mu.id_universidad
        WHERE r.nombre_ranking = :r AND m.nombre_metrica = :m
          AND u.nombre_universidad = :u AND mu.anio_metrica = :a"""),
        {"r": ranking, "m": metrica, "u": universidad, "a": anio}).scalar()
    return None if v is None else float(v)


cliente = TestClient(main.app)
db = main.SessionLocal()
try:
    aplicada = db.execute(text("""
        SELECT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'ranking' AND column_name = 'puntajes_ponderados_desde')""")).scalar()
    if not aplicada:
        print("  (sin las migraciones 020 y 021: aplica backend/migraciones/020_puntaje_total.sql y 021_gras_por_edicion.sql)")
        print("\n" + "=" * 74 + "\nFALLOS: 0  (omitida)")
        sys.exit(0)
    ids = {r[1]: r[0] for r in db.execute(text("SELECT id_ranking, nombre_ranking FROM ranking"))}

    print("=== 1. Una métrica de puntaje total en cada ranking ===")
    por_ranking = dict(db.execute(text("""
        SELECT r.nombre_ranking, count(m.id_metrica) FROM ranking r
        LEFT JOIN metrica m ON m.id_ranking = r.id_ranking AND m.tipo_metrica = 'Puntaje'
        GROUP BY r.nombre_ranking""")).fetchall())
    comprobar("todos los rankings la tienen", all(n > 0 for n in por_ranking.values()), por_ranking)
    disciplinas_gras = db.execute(text("""
        SELECT count(DISTINCT disciplina) FROM metrica m JOIN ranking r USING (id_ranking)
        WHERE r.nombre_ranking = 'Shanghai GRAS' AND m.pondera""")).scalar()
    comprobar("Shanghai GRAS tiene una por disciplina",
              por_ranking.get("Shanghai GRAS") == disciplinas_gras, (por_ranking.get("Shanghai GRAS"), disciplinas_gras))
    ponderan = db.execute(text(
        "SELECT count(*) FROM metrica WHERE tipo_metrica = 'Puntaje' AND (pondera OR peso_metrica <> 0)")).scalar()
    comprobar("ninguna entra en el reparto de pesos", ponderan == 0, ponderan)
    overall = db.execute(text("SELECT count(*) FROM metrica WHERE nombre_metrica = 'Overall'")).scalar()
    comprobar("ya no queda ninguna «Overall» suelta", overall == 0, overall)
    sin_descripcion = db.execute(text(
        "SELECT count(*) FROM metrica WHERE tipo_metrica = 'Puntaje' AND descripcion_metrica IS NULL")).scalar()
    comprobar("todas dicen de dónde sale el número", sin_descripcion == 0, sin_descripcion)

    print("\n=== 2. Cobertura ===")
    for f in db.execute(text("""
        SELECT r.nombre_ranking,
               count(DISTINCT (mu.id_universidad, mu.anio_metrica, m.disciplina)) AS clasificadas,
               count(DISTINCT (mu.id_universidad, mu.anio_metrica, m.disciplina)) FILTER (
                   WHERE EXISTS (SELECT 1 FROM metrica t JOIN metrica_universidad tu ON tu.id_metrica = t.id_metrica
                                 WHERE t.id_ranking = m.id_ranking AND t.tipo_metrica = 'Puntaje'
                                   AND t.disciplina IS NOT DISTINCT FROM m.disciplina
                                   AND tu.id_universidad = mu.id_universidad
                                   AND tu.anio_metrica = mu.anio_metrica)) AS con_total
        FROM metrica_universidad mu
        JOIN metrica m ON m.id_metrica = mu.id_metrica AND m.pondera
        JOIN ranking r ON r.id_ranking = m.id_ranking
        WHERE NOT (r.nombre_ranking = 'Shanghai ARWU' AND mu.anio_metrica = 2003)
          -- GRAS anterior a 2024 recibe su total del cargador de rankings
          -- (tools/rankings), no de la migración: lo vigila la batería `rankings`.
          AND NOT (r.nombre_ranking = 'Shanghai GRAS' AND mu.anio_metrica < 2024)
          -- THE World 2016 no tiene total: THE no publicó el de las universidades
          -- en bandas y sus pesos no reproducen los exactos (tools/rankings).
          AND NOT (r.nombre_ranking = 'THE World' AND mu.anio_metrica = 2016)
        GROUP BY r.nombre_ranking ORDER BY r.nombre_ranking""")):
        completo = f.nombre_ranking in ("THE Latam", "THE World", "Scimago Latam", "Shanghai GRAS",
                                        "Shanghai ARWU", "Ranking KAI")
        if completo:
            comprobar(f"{f.nombre_ranking}: toda universidad clasificada tiene total",
                      f.con_total == f.clasificadas, f"{f.con_total} de {f.clasificadas}")
        else:
            # QS solo publica el total de las mejor clasificadas.
            comprobar(f"{f.nombre_ranking}: tiene totales, solo donde QS los publica",
                      0 < f.con_total < f.clasificadas, f"{f.con_total} de {f.clasificadas}")
    ceros = db.execute(text("""
        SELECT count(*) FROM metrica_universidad mu JOIN metrica m USING (id_metrica)
        JOIN ranking r USING (id_ranking)
        WHERE m.tipo_metrica = 'Puntaje' AND r.nombre_ranking LIKE 'QS%'
          AND (mu.valor_metrica IS NULL OR mu.valor_metrica <= 0)""")).scalar()
    comprobar("QS no guarda ceros donde no publica el total", ceros == 0, ceros)

    print("\n=== 3. Los calculados siguen su método ===")
    for nombre, expr, dec in (("Shanghai GRAS", "sum(mu.valor_metrica)", 1),
                              ("Scimago Latam", "sum(mu.valor_metrica * m.peso_metrica / 100.0)", 2),
                              ("Ranking KAI", "sum(mu.valor_metrica * m.peso_metrica / 100.0)", 2)):
        distintos = db.execute(text(f"""
            SELECT count(*) FROM (
              SELECT round({expr}, {dec}) AS suma, max(t.valor_metrica) AS guardado
              FROM metrica_universidad mu
              JOIN metrica m ON m.id_metrica = mu.id_metrica AND m.pondera
              JOIN ranking r ON r.id_ranking = m.id_ranking AND r.nombre_ranking = :r
              JOIN metrica tm ON tm.id_ranking = r.id_ranking AND tm.tipo_metrica = 'Puntaje'
                             AND tm.disciplina IS NOT DISTINCT FROM m.disciplina
              LEFT JOIN metrica_universidad t ON t.id_metrica = tm.id_metrica
                    AND t.id_universidad = mu.id_universidad AND t.anio_metrica = mu.anio_metrica
              -- En GRAS la suma vale desde 2024; antes, cada materia tenía sus pesos.
              WHERE NOT (r.nombre_ranking = 'Shanghai GRAS' AND mu.anio_metrica < 2024)
              GROUP BY tm.id_metrica, mu.id_universidad, mu.anio_metrica) x
            WHERE x.guardado IS DISTINCT FROM x.suma"""), {"r": nombre}).scalar()
        comprobar(f"{nombre}: el total es la suma de sus componentes"
                  + (" (desde 2024)" if nombre == "Shanghai GRAS" else ""), distintos == 0, distintos)

    print("\n=== 4. Los publicados coinciden con la fuente ===")
    # THE Latam: CSV de KAI/THE/…/csv_latam (Overall).
    comprobar("THE Latam 2026, PUCV: 29,6", total(db, "THE Latam", PUCV, 2026) == 29.6,
              total(db, "THE Latam", PUCV, 2026))
    comprobar("THE Latam 2026, U. de Chile: 38,4", total(db, "THE Latam", "Universidad de Chile", 2026) == 38.4)
    concepcion = total(db, "THE Latam", "Universidad de Concepcion", 2024)
    comprobar("THE Latam 2024, U. de Concepción: 57,3", concepcion == 57.3, concepcion)
    # PUCV 2016 estaba en la banda 40,2–44,2: el calculado debe caer dentro.
    banda = total(db, "THE Latam", PUCV, 2016)
    comprobar("THE Latam 2016, PUCV: calculado dentro de su banda publicada (40,2–44,2)",
              banda is not None and 40.2 <= banda <= 44.2, banda)
    # QS: planillas oficiales en KAI/QS/DatosQS.
    comprobar("QS Latam 2026, PUCV: 76,4", total(db, "QS Latam", PUCV, 2026) == 76.4, total(db, "QS Latam", PUCV, 2026))
    comprobar("QS Global 2026, U. de Concepción: 27,8 (antes 69,5, su Sustainability)",
              total(db, "QS Global", "Universidad de Concepcion", 2026) == 27.8,
              total(db, "QS Global", "Universidad de Concepcion", 2026))
    comprobar("QS Global 2026, PUCV: sin total, porque QS no lo publica",
              total(db, "QS Global", PUCV, 2026) is None, total(db, "QS Global", PUCV, 2026))
    # Shanghai: API pública de ShanghaiRanking.
    comprobar("GRAS Matemáticas 2025, U. de Chile: 112,0 (suma de sus indicadores en la API)",
              total(db, "Shanghai GRAS", "Universidad de Chile", 2025, "Mathematics") == 112.0)
    comprobar("ARWU 2025, PUC: 11,3", total(db, "Shanghai ARWU", "Pontificia Universidad Catolica de Chile", 2025) == 11.3)

    print("\n=== 5. QS Global 2026 ya no tiene columnas corridas ===")
    concepcion = "Universidad de Concepcion"
    comprobar("International Research Network: 64,1", valor(db, "QS Global", "International Research Network", concepcion, 2026) == 64.1,
              valor(db, "QS Global", "International Research Network", concepcion, 2026))
    comprobar("Employment Outcomes: 16,9", valor(db, "QS Global", "Employment Outcomes", concepcion, 2026) == 16.9,
              valor(db, "QS Global", "Employment Outcomes", concepcion, 2026))
    comprobar("Sustainability: 69,5", valor(db, "QS Global", "Sustainability", concepcion, 2026) == 69.5,
              valor(db, "QS Global", "Sustainability", concepcion, 2026))

    print("\n=== 6. Los pesos de THE Latam reproducen su total ===")
    # Los de la metodología latinoamericana desde 2024: la suma ponderada que
    # muestra el Resumen debe quedar a menos de 0,1 del total publicado.
    peor = db.execute(text("""
        SELECT max(abs(x.suma - t.valor_metrica)) FROM (
          SELECT mu.id_universidad, mu.anio_metrica, sum(mu.valor_metrica * m.peso_metrica / 100.0) AS suma
          FROM metrica_universidad mu
          JOIN metrica m ON m.id_metrica = mu.id_metrica AND m.pondera
          JOIN ranking r ON r.id_ranking = m.id_ranking AND r.nombre_ranking = 'THE Latam'
          WHERE mu.anio_metrica >= 2024
          GROUP BY mu.id_universidad, mu.anio_metrica) x
        JOIN metrica tm ON tm.tipo_metrica = 'Puntaje'
        JOIN ranking r ON r.id_ranking = tm.id_ranking AND r.nombre_ranking = 'THE Latam'
        JOIN metrica_universidad t ON t.id_metrica = tm.id_metrica
             AND t.id_universidad = x.id_universidad AND t.anio_metrica = x.anio_metrica""")).scalar()
    comprobar("desde 2024, a menos de 0,1 del total", peor is not None and float(peor) < 0.1, peor)
finally:
    db.close()

pago = crear_usuario()
try:
    print("\n=== 7. Lo leen Tendencias, Simulación y Glosario ===")
    the, gras = ids["THE Latam"], ids["Shanghai GRAS"]
    metricas = cliente.get(f"/metricas-con-datos?ranking_id={the}", headers=pago).json()
    tot = [m for m in metricas if m.get("tipo_metrica") == "Puntaje"]
    comprobar("Tendencias: el selector de métricas de THE trae el puntaje total",
              len(tot) == 1 and tot[0]["nombre_metrica"] == "Puntaje total" and tot[0]["descripcion_metrica"],
              tot)
    if tot:
        serie = cliente.get(f"/trends?ranking_id={the}&metrica_id={tot[0]['id_metrica']}", headers=pago).json()["data"]
        pucv = {f["anio"]: float(f["valor"]) for f in serie if f["universidad"] == PUCV}
        comprobar("Tendencias: su serie histórica cubre todas las ediciones de la PUCV", len(pucv) >= 9 and pucv.get(2026) == 29.6,
                  pucv)
        comp = cliente.get(f"/tendencias-comparacion?ranking_id={the}&anio=2026&metricas={tot[0]['id_metrica']}",
                           headers=pago).json()
        comprobar("Tendencias: la comparación anual lo incluye", len(comp) > 20, len(comp))

    sim = cliente.get(f"/simulacion?ranking_id={the}&anio=2026", headers=pago).json()
    comprobar("Simulación: el puntaje total no aparece como métrica editable",
              all(f["nombre_metrica"] != "Puntaje total" for f in sim))
    fila = next((f for f in sim if f["nombre_universidad"] == PUCV), None)
    comprobar("Simulación: cada fila trae el total registrado y lo que aporta cada punto",
              fila is not None and float(fila["puntaje_total"]) == 29.6 and float(fila["factor"]) > 0, fila)
    anio_gras = max(cliente.get(f"/anios?ranking_id={gras}", headers=pago).json())
    sim_gras = cliente.get(f"/simulacion?ranking_id={gras}&anio={anio_gras}", headers=pago).json()
    comprobar("Simulación: en Shanghai GRAS cada punto aporta uno, porque ya viene ponderado",
              sim_gras and all(float(f["factor"]) == 1.0 for f in sim_gras))
    resumen = cliente.get("/ranking-resumen", params={"ranking_id": gras, "anio": 2025, "disciplina": "Mathematics"},
                          headers=pago).json()
    uchile = next((f for f in resumen if f["nombre_universidad"] == "Universidad de Chile"), None)
    comprobar("Resumen y Simulación: el total de GRAS es el de GRAS (112,0), no la suma por el peso",
              uchile is not None and abs(float(uchile["score_total"]) - 112.0) < 0.05, uchile)

    glos = cliente.get("/valores-metrica-universidad", params={"tipo": "Puntaje", "universidad_id": next(
        r[0] for r in main.SessionLocal().execute(text(
            "SELECT id_universidad FROM universidad WHERE nombre_universidad = :n"), {"n": PUCV}))},
        headers=pago).json()
    rankings_con_total = {f["nombre_ranking"] for f in glos}
    comprobar("Glosario: la PUCV tiene puntaje total en THE, QS Latam, Scimago, GRAS y el Ranking KAI",
              {"THE Latam", "QS Latam", "Scimago Latam", "Shanghai GRAS", "Ranking KAI"} <= rankings_con_total,
              sorted(rankings_con_total))

    from app import herramientas
    texto = herramientas.consultar_ranking_resumen(the, 2026)
    comprobar("Asistente: el resumen del ranking trae el puntaje total registrado",
              "puntaje_total" in texto and "29.6" in texto, texto[:300])
finally:
    db = main.SessionLocal()
    db.execute(text("DELETE FROM usuario WHERE id_usuario = ANY(:ids)"), {"ids": usuarios})
    db.commit()
    db.close()

print("\n" + "=" * 74)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
