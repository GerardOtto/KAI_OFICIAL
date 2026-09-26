# -*- coding: utf-8 -*-
"""Pruebas de la reversión de métricas (T5.2 y T5.3).

Lo que se comprueba no es que los números sean bonitos, sino que las decisiones
del guion sean las correctas: que el desfase de THE sea el que su metodología
declara, que una métrica sin insumo quede vacía en vez de rellenarse, que la
recta de QS excluya los puntajes saturados, y que la aritmética de la regresión
dé lo que tiene que dar en casos donde la respuesta se sabe de antemano.

Uso:
    python tools/recoleccion/tests/test_reversion.py
"""
from __future__ import annotations

import csv

import sys
from pathlib import Path

AQUI = Path(__file__).resolve()
sys.path.insert(0, str(AQUI.parents[1]))

import calibrar as cal  # noqa: E402
import metricas_crudas as mc  # noqa: E402
import navegador as nav  # noqa: E402

fallos = 0


def ok(condicion: bool, mensaje: str, detalle: str = "") -> None:
    global fallos
    if condicion:
        print(f"  [OK ] {mensaje}")
    else:
        fallos += 1
        print(f"  [FALLA] {mensaje}")
    if detalle:
        print(f"    {detalle}")


def seccion(t: str) -> None:
    print("\n" + "=" * 62 + f"\n{t}\n" + "=" * 62)


# --------------------------------------------------------------------------- #
seccion("1. La aritmética, contra casos de respuesta conocida")

r = cal.recta([(1.0, 3.0), (2.0, 5.0), (3.0, 7.0), (4.0, 9.0)])
ok(r is not None and abs(r[0] - 1) < 1e-9 and abs(r[1] - 2) < 1e-9 and abs(r[2] - 1) < 1e-9,
   "una recta exacta y = 1 + 2x se recupera con R² = 1",
   f"a={r[0]:.4f} b={r[1]:.4f} R²={r[2]:.4f}" if r else "devolvió None")

ok(cal.recta([(1.0, 1.0), (2.0, 2.0)]) is None,
   "con menos de tres puntos no se ajusta nada")

ok(cal.recta([(5.0, 1.0), (5.0, 2.0), (5.0, 3.0)]) is None,
   "sin variación en x no hay recta que ajustar")

s = cal.spearman([(1.0, 10.0), (2.0, 20.0), (3.0, 30.0), (4.0, 40.0)])
ok(s is not None and abs(s - 1) < 1e-9, "Spearman de una relación creciente es +1",
   f"{s:.4f}" if s is not None else "None")

s = cal.spearman([(1.0, 40.0), (2.0, 30.0), (3.0, 20.0), (4.0, 10.0)])
ok(s is not None and abs(s + 1) < 1e-9, "Spearman de una relación decreciente es -1",
   f"{s:.4f}" if s is not None else "None")

# Spearman resiste una relación monótona pero curva; Pearson no.
curva = [(float(x), float(x) ** 3) for x in range(1, 9)]
s = cal.spearman(curva)
ok(s is not None and abs(s - 1) < 1e-9,
   "Spearman detecta una relación monótona aunque sea curva",
   f"{s:.4f}" if s is not None else "None")

tabla = cal.percentiles([10.0, 20.0, 30.0, 40.0])
ok(abs(tabla[10.0] - 12.5) < 1e-9 and abs(tabla[40.0] - 87.5) < 1e-9,
   "el rango percentil reparte simétrico en los extremos",
   f"min={tabla[10.0]} max={tabla[40.0]}")

tabla = cal.percentiles([5.0, 5.0, 5.0, 5.0])
ok(abs(tabla[5.0] - 50.0) < 1e-9,
   "con todos los valores empatados el percentil es 50 para todos")


# --------------------------------------------------------------------------- #
seccion("2. Los desfases: los que la metodología declara")

ok(mc.DESFASES["THE Latam"]["institucional"] == 3,
   "THE usa datos institucionales de tres años antes",
   "«WUR 2026 […] the year ending in 2023», metodología WUR 2026")

ok(mc.DESFASES["THE Latam"]["ventana"] == (-6, -2),
   "la bibliometría de THE va por otra ventana que los datos institucionales",
   "«all indexed publications between 2020 and 2024» para la edición 2026")

edicion = 2026
d = mc.DESFASES["THE Latam"]
ok(edicion - d["institucional"] == 2023 and
   (edicion + d["ventana"][0], edicion + d["ventana"][1]) == (2020, 2024),
   "la edición 2026 se arma con el SIES 2023 y la ventana 2020-2024")


# --------------------------------------------------------------------------- #
seccion("3. El catálogo de métricas")

for ranking, esperadas in [("THE Latam", 17), ("QS Latam", 8), ("QS Global", 9)]:
    n = sum(1 for m in mc.CATALOGO if m.ranking == ranking)
    ok(n == esperadas, f"{ranking} define {esperadas} métricas", f"encontradas {n}")

sin_formula = [m for m in mc.CATALOGO if m.formula == "—"]
ok(all(m.calidad == "parcial" for m in sin_formula),
   "toda métrica sin fórmula queda marcada como parcial, nunca como directa",
   f"{len(sin_formula)} métricas sin fórmula")

ok(all(m.nota for m in sin_formula),
   "toda métrica sin fórmula explica por qué no la tiene")

# La confusión fácil: doctorados otorgados contra académicos con doctorado.
dsr = next(m for m in mc.CATALOGO if m.nombre == "Doctorate staff ratio")
ok("graduados_doctorado" in dsr.formula and "academicos_doctorado" not in dsr.formula,
   "Doctorate staff ratio usa doctorados OTORGADOS, no académicos con doctorado",
   dsr.formula)

phd = next(m for m in mc.CATALOGO if m.nombre == "Staff with PhD")
ok("academicos_doctorado" in phd.formula and "graduados" not in phd.formula,
   "Staff with PhD sí usa académicos con doctorado: son métricas distintas",
   phd.formula)

# Las que THE normaliza por personal deben llevar el divisor en la fórmula.
for nombre in ("Patents", "Research excellence", "Research influence",
               "Research productivity", "Research income", "Industry income"):
    m = next(x for x in mc.CATALOGO if x.nombre == nombre and x.ranking == "THE Latam")
    ok("academicos_jce" in m.formula,
       f"«{nombre}» se divide por el personal, como manda la metodología",
       m.formula)


# --------------------------------------------------------------------------- #
seccion("4. El cálculo no inventa")

ok(mc.div(10, 0) is None, "dividir por cero devuelve None, no un error ni un cero")
ok(mc.div(None, 5) is None, "sin numerador no hay métrica")
ok(mc.div(10, None) is None, "sin denominador no hay métrica")
ok(mc.pct(1, 4) == 25.0, "el porcentaje es el cociente por cien", "1/4 -> 25")

anual = {("U", "estudiantes_total"): {2023: 1000.0},
         ("U", "academicos_jce"): {2023: 50.0}}
ventana: dict = {}
filas = mc.calcular_ranking("THE Latam", anual, ventana, {"U"})
ssr = [f for f in filas if f["metrica"] == "Student staff ratio"]
ok(len(ssr) == 1 and ssr[0]["edicion"] == 2026 and ssr[0]["valor_crudo"] == 20.0,
   "con datos de 2023, Student staff ratio sale en la edición 2026 y vale 20",
   f"{ssr[0]['edicion']} -> {ssr[0]['valor_crudo']}" if ssr else "no se calculó")

sin_insumo = [f for f in filas if f["metrica"] in ("Patents", "Citation impact")]
ok(not sin_insumo,
   "las métricas sin insumo no aparecen en la salida en vez de salir en cero")

ok(all(f["anios_usados"] for f in filas),
   "cada valor dice de qué años salió")


# --------------------------------------------------------------------------- #
seccion("5. La calibración de QS excluye lo saturado")

ok(cal.TECHO == 90.0, "el techo de saturación está en 90, como pide el plan")

ok(all(v.startswith("qs_puntaje") for v in cal.ANCLAS_QS.values()),
   "cada ancla apunta a un puntaje publicado por QS")

nombres = {m.nombre for m in mc.CATALOGO}
huerfanas = [k[1] for k in cal.ANCLAS_QS if k[1] not in nombres]
ok(not huerfanas, "toda ancla corresponde a una métrica del catálogo",
   f"sin correspondencia: {huerfanas}" if huerfanas else "")


# --------------------------------------------------------------------------- #
seccion("5b. Los nombres del catálogo son los de la base")

# Sin esto, una métrica recalculada nunca encuentra su fila y la carga la
# descarta en silencio. Pasó: la metodología de THE escribe «Student Staff
# Ratio» y la base guarda «Student staff ratio».
try:
    import os

    from dotenv import load_dotenv
    from sqlalchemy import create_engine, text

    load_dotenv(AQUI.parents[3] / "backend" / ".env")
    url = os.getenv("DATABASE_URL")
except ImportError:
    url = None

if not url:
    print("  (sin base de datos a mano; se omite)")
else:
    motor = create_engine(url)
    with motor.connect() as c:
        en_bd = {(r[0], r[1]) for r in c.execute(text(
            "select r.nombre_ranking, m.nombre_metrica from metrica m "
            "join ranking r on r.id_ranking = m.id_ranking"))}
    for ranking in ("THE Latam", "QS Latam", "QS Global"):
        faltan = [m.nombre for m in mc.CATALOGO
                  if m.ranking == ranking and (ranking, m.nombre) not in en_bd]
        ok(not faltan,
           f"las métricas de {ranking} existen en la base con ese nombre exacto",
           f"sin correspondencia: {faltan}" if faltan else "")


# --------------------------------------------------------------------------- #
seccion("6. Las salidas, si ya se generaron")

crudas = nav.RAIZ / "metricas_crudas_chile.csv"
if not crudas.exists():
    print("  (no existe metricas_crudas_chile.csv; ejecuta metricas_crudas.py)")
else:
    filas = list(csv.DictReader(crudas.open(encoding="utf-8-sig")))
    ok(len(filas) > 1000, f"hay {len(filas)} valores crudos")

    vacios = [f for f in filas if not f["valor_crudo"]]
    ok(not vacios, "ninguna fila se escribió sin valor")

    ok(all(f["formula"] and f["formula"] != "—" for f in filas),
       "toda fila publicada lleva la fórmula con la que se calculó")

    the = [f for f in filas if f["ranking"] == "THE Latam"]
    con_2023 = [f for f in the if f["edicion"] == "2026" and "2023" in f["anios_usados"]]
    ok(bool(con_2023),
       "las métricas de la edición 2026 de THE citan el año 2023 como origen")

    reputacion = [f for f in filas if "eputation" in f["metrica"]]
    ok(not reputacion,
       "ninguna métrica de reputación se publicó: no hay fuente y no se inventa")

calibracion = nav.RAIZ / "calibracion.csv"
if not calibracion.exists():
    print("  (no existe calibracion.csv; ejecuta calibrar.py)")
else:
    filas = list(csv.DictReader(calibracion.open(encoding="utf-8-sig")))
    ok(len(filas) > 20, f"hay {len(filas)} ajustes")

    scimago = [f for f in filas if f["ranking"] == "Scimago Latam"]
    if scimago:
        desvios = [float(f["residuo_mediano"]) for f in scimago if f["residuo_mediano"]]
        ok(desvios and max(desvios) < 0.5,
           "los valores de Scimago de la base coinciden con la descarga nueva",
           f"desvío máximo {max(desvios):.3f} % en {len(scimago)} métricas")

    cdf = [f for f in filas if f["modelo"].startswith("cdf")]
    if cdf:
        normal = sum(1 for f in cdf if "normal" in f["modelo"])
        ok(normal == len(cdf),
           "THE normaliza con la normal ajustada, no con el rango percentil",
           f"la normal gana en {normal} de {len(cdf)} ediciones")

    lineales = [f for f in filas if f["modelo"] == "lineal"]
    if lineales:
        ok(all(float(f["r2"]) <= 1.0001 for f in lineales),
           "ningún R² supera 1")
        utiles = [f for f in lineales if float(f["r2"]) >= 0.6]
        ok(bool(utiles),
           f"{len(utiles)} de {len(lineales)} rectas alcanzan R² de 0,6")


# --------------------------------------------------------------------------- #
print("\n" + "=" * 62)
print(f"FALLOS: {fallos}" + ("  (todo correcto)" if not fallos else ""))
raise SystemExit(1 if fallos else 0)
