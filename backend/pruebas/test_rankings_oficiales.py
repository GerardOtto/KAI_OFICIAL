"""Cargador de rankings oficiales: la base se reconstruye desde las fuentes.

`datos/rankings` guarda una instantánea de cada edición de THE Latam, QS Latam,
QS Global, ARWU y GRAS, tomada de su fuente oficial (tools/rankings). Esta
batería vigila:

  * que cada instantánea de una edición ya cargada coincida cifra por cifra con
    la base: es la prueba de regresión de toda la carga histórica, y la que habría
    detectado las columnas corridas de QS Global 2026;
  * que las ediciones que la base aún no tiene se puedan cargar —métricas de su
    época, universidades del catálogo, total coherente— sin dejar nada escrito
    (todo ocurre en una transacción que se deshace);
  * que las planillas oficiales de QS se sigan leyendo igual;
  * y que el cargador rechace un total descuadrado, una métrica que no existe y
    una edición cargada que difiere.

Sin las migraciones 020 y 021 la batería se omite.
"""
import os
import sys
from dataclasses import replace

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(RAIZ)
sys.path.insert(0, RAIZ)
sys.path.insert(0, os.path.join(REPO, "tools", "rankings"))

from dotenv import load_dotenv

load_dotenv(os.path.join(RAIZ, ".env"))
from sqlalchemy import text

from app.db import engine
import cargar
import comun
import verificar
from fuentes import qs

fallos = []


def comprobar(nombre, cond, detalle=""):
    print(f"  [{'OK ' if cond else 'FALLA'}] {nombre}" + (f" -> {detalle}" if detalle and not cond else ""))
    if not cond:
        fallos.append(nombre)


with engine.connect() as conexion:
    tiene_021 = conexion.execute(text("""SELECT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ranking' AND column_name = 'puntajes_ponderados_desde')""")).scalar()
    if not tiene_021:
        print("  (sin las migraciones 020 y 021: aplica backend/migraciones/020_puntaje_total.sql y 021)")
        print("\n" + "=" * 74 + "\nFALLOS: 0  (omitida)")
        sys.exit(0)

    base = cargar.Base(conexion)
    conexion.rollback()

    print("=== 1. Hay instantáneas de los cinco rankings ===")
    ediciones = {c: comun.ediciones_guardadas(c) for c in comun.RANKINGS}
    for clave, lista in ediciones.items():
        comprobar(f"{comun.RANKINGS[clave]}: {len(lista)} ediciones ({min(lista, default='—')}–{max(lista, default='—')})",
                  len(lista) > 0)

    print("\n=== 2. Cada edición cargada se reconstruye desde su fuente ===")
    nuevas, por_completar = [], []
    for clave, lista in ediciones.items():
        coinciden, completables, distintas = 0, 0, []
        for edicion in lista:
            filas, meta = comun.leer_instantanea(clave, edicion)
            try:
                valores, metricas = cargar.traducir(base, clave, edicion, filas)
            except cargar.Rechazo as e:
                distintas.append(f"{edicion}: {e}")
                continue
            cargados = base.cargadas(base.rankings[comun.RANKINGS[clave]].id_ranking, edicion)
            if not cargados:
                nuevas.append((clave, edicion, filas, valores, metricas))
                continue
            diferencias = cargar.comparar(valores, metricas, cargados)
            if not diferencias:
                coinciden += 1
            elif all(d.startswith("falta en la base") for d in diferencias):
                # Solo le faltan cifras —el total de GRAS anterior a 2024, que la
                # migración 020 no calcula—: el cargador las agrega sin tocar nada.
                completables += 1
                por_completar.append((clave, edicion, valores, metricas, cargados))
            else:
                distintas.append(f"{edicion}: {len(diferencias)} cifras, p. ej. {diferencias[0]}")
        comprobar(f"{comun.RANKINGS[clave]}: las {coinciden + completables} ediciones cargadas coinciden con la base"
                  + (f" ({completables} a falta de su total)" if completables else ""),
                  not distintas, distintas[:3])
    conexion.rollback()

    print("\n=== 3. Las ediciones que faltan se cargan sin dejar rastro ===")
    for clave, edicion, filas, valores, metricas in nuevas:
        etiqueta = f"{comun.RANKINGS[clave]} {edicion}"
        problemas = verificar.instantanea(clave, edicion, filas) + cargar.coherencia(base, clave, edicion, valores, metricas)
        comprobar(f"{etiqueta}: la instantánea es coherente", not problemas, problemas)
        transaccion = conexion.begin()
        try:
            cargar.escribir(base, edicion, valores, metricas)
            releidos = {k: v for k, v in base.cargadas(base.rankings[comun.RANKINGS[clave]].id_ranking, edicion).items()
                        if k[0] in metricas}
            comprobar(f"{etiqueta}: se escribe y se relee igual ({len(valores)} cifras)",
                      not cargar.comparar(valores, metricas, releidos))
            con_total = {u for (m, u) in valores if metricas[m].tipo_metrica == "Puntaje"}
            universidades = {u for (m, u) in valores}
            if clave in ("the-latam", "the-world", "shanghai-gras", "shanghai-arwu") \
                    and not (clave == "the-world" and edicion == 2016):
                comprobar(f"{etiqueta}: toda universidad trae su puntaje total", con_total == universidades,
                          len(universidades - con_total))
        finally:
            transaccion.rollback()
    if not nuevas:
        print("  (la base ya tiene todas las ediciones de las instantáneas)")
    for clave, edicion, valores, metricas, cargados in por_completar[:3]:
        etiqueta = f"{comun.RANKINGS[clave]} {edicion}"
        faltan = {k: v for k, v in valores.items() if k not in cargados}
        transaccion = conexion.begin()
        try:
            cargar.completar(base, edicion, faltan)
            releidos = base.cargadas(base.rankings[comun.RANKINGS[clave]].id_ranking, edicion)
            comprobar(f"{etiqueta}: se completan {len(faltan)} cifras sin cambiar las demás",
                      not cargar.comparar(valores, metricas, releidos)
                      and all(releidos[k] == v for k, v in cargados.items()))
        finally:
            transaccion.rollback()
    for clave, edicion, *_ in nuevas:
        queda = base.cargadas(base.rankings[comun.RANKINGS[clave]].id_ranking, edicion)
        comprobar(f"{comun.RANKINGS[clave]} {edicion}: la prueba no dejó nada escrito", not queda, len(queda))
    conexion.rollback()

    print("\n=== 4. Las planillas oficiales de QS se leen igual ===")
    for clave in ("qs-latam", "qs-global"):
        for edicion in sorted(qs.planillas(clave)):
            if edicion not in ediciones[clave]:
                continue
            leidas, _ = qs.leer(clave, edicion)
            guardadas, _ = comun.leer_instantanea(clave, edicion)
            clave_de = lambda f: (f.disciplina, f.universidad, f.metrica, round(f.valor, 4))  # noqa: E731
            comprobar(f"{comun.RANKINGS[clave]} {edicion}: la planilla da la instantánea versionada",
                      sorted(map(clave_de, leidas)) == sorted(map(clave_de, guardadas)))

    print("\n=== 5. El cargador rechaza lo que no cuadra ===")
    # Una columna corrida como la de QS Global 2026: el total pasa a ser el de
    # Sustainability. La razón total/suma deja de ser pareja.
    filas, _ = comun.leer_instantanea("qs-global", 2026)
    sostenibilidad = {f.universidad: f.valor for f in filas if f.metrica == "Sustainability"}
    corridas = [replace(f, valor=sostenibilidad[f.universidad]) if f.metrica == comun.TOTAL else f for f in filas]
    valores, metricas = cargar.traducir(base, "qs-global", 2026, corridas)
    problemas = cargar.coherencia(base, "qs-global", 2026, valores, metricas)
    comprobar("un total corrido de columna se detecta", bool(problemas), problemas)

    # Una métrica que la base no tiene (una metodología nueva).
    filas, _ = comun.leer_instantanea("shanghai-arwu", max(ediciones["shanghai-arwu"]))
    inventada = filas + [replace(filas[0], metrica="Indicador nuevo", valor=10)]
    try:
        cargar.traducir(base, "shanghai-arwu", filas[0].edicion, inventada)
        comprobar("una métrica desconocida detiene la carga", False)
    except cargar.Rechazo as e:
        comprobar("una métrica desconocida detiene la carga", "migración" in str(e), str(e))

    # Una edición cargada que difiere de su fuente.
    edicion = next(e for e in ediciones["the-latam"] if base.cargadas(base.rankings["THE Latam"].id_ranking, e))
    conexion.rollback()
    filas, _ = comun.leer_instantanea("the-latam", edicion)
    alterada = [replace(filas[0], valor=filas[0].valor + 1)] + filas[1:]
    valores, metricas = cargar.traducir(base, "the-latam", edicion, alterada)
    diferencias = cargar.comparar(valores, metricas, base.cargadas(base.rankings["THE Latam"].id_ranking, edicion))
    conexion.rollback()
    comprobar("una cifra distinta de la cargada se informa", len(diferencias) == 1, diferencias[:2])

    # GRAS: para una edición nueva se elige la métrica de la época más reciente.
    gras = base.rankings["Shanghai GRAS"].id_ranking
    ic = base.metrica(gras, "Mathematics", "IC", 2099)
    comprobar("GRAS: una edición nueva usa la métrica IC de la metodología vigente", max(ic.anios) >= 2024, ic.anios)
    ic_2018 = base.metrica(gras, "Mathematics", "IC", 2018)
    comprobar("GRAS: la edición 2018 usa la de su época", 2018 in ic_2018.anios, ic_2018.anios)

print("\n" + "=" * 74)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
