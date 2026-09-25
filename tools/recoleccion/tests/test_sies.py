# -*- coding: utf-8 -*-
"""Validación de la agregación del SIES contra fuentes independientes.

El plan la exige y con razón: agregar microdatos es donde se cuelan los errores
silenciosos. Un guion que termina sin excepciones puede haber sumado la columna
equivocada, y el resultado sigue pareciendo razonable.

Dos contrastes, ninguno con el propio SIES:

  1. **Cifras públicas de la PUCV.** Unos 650 JCE hacia 2022 y cerca del 64 % de
     esos JCE con doctorado. Si la diferencia pasa del 10 % no se fuerza el
     ajuste: se reporta, porque el sospechoso es la agregación.

  2. **Contra lo que las universidades declaran a THE.** THE publica el número de
     estudiantes FTE y la razón estudiantes por académico de cada universidad. De
     ahí sale el número de académicos que THE usa, y se compara con los JCE del
     SIES del mismo año. Son dos definiciones distintas —THE cuenta el personal
     académico FTE que la institución declara; el SIES, las jornadas equivalentes
     que reporta al Estado—, así que no tienen por qué coincidir: lo que se mide
     es si guardan relación y cuáles se salen.

    python tools/recoleccion/tests/test_sies.py
"""
from __future__ import annotations

import csv
import statistics
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
DATOS = RAIZ / "KAI" / "Datos reales"
PUCV = "Pontificia Universidad Catolica de Valparaiso"

fallos: list[str] = []


def comprobar(nombre: str, condicion: bool, detalle: str = "") -> None:
    print(f"  [{'OK ' if condicion else 'FALLA'}] {nombre}" + (f" -> {detalle}" if detalle and not condicion else ""))
    if not condicion:
        fallos.append(nombre)


def leer(fuente: str, nombre: str = "procesado.csv") -> list[dict]:
    ruta = DATOS / fuente / nombre
    if not ruta.exists():
        raise SystemExit(f"Falta {ruta}. Ejecuta primero el recolector de {fuente}.")
    with ruta.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def indexar(filas: list[dict]) -> dict[tuple[str, str, str], float]:
    """(universidad, año, variable) -> valor."""
    salida = {}
    for f in filas:
        try:
            salida[(f["universidad"], f["anio_dato"], f["variable"])] = float(f["valor"])
        except (ValueError, KeyError):
            continue
    return salida


print("=== 1. La PUCV contra sus cifras públicas ===")
sies = indexar(leer("sies"))

jce_2022 = sies.get((PUCV, "2022", "academicos_jce"))
comprobar("la PUCV tiene JCE en 2022", jce_2022 is not None)
if jce_2022:
    desvio = abs(jce_2022 - 650) / 650
    print(f"    JCE 2022: {jce_2022:.1f} (cifra pública ~650, desvío {desvio:.1%})")
    comprobar("los JCE de 2022 están dentro del 10 % de la cifra pública",
              desvio <= 0.10, f"{jce_2022:.1f} frente a 650")

doctorado = sies.get((PUCV, "2022", "academicos_jce_doctorado"))
if jce_2022 and doctorado:
    porcentaje = 100 * doctorado / jce_2022
    print(f"    JCE con doctorado 2022: {porcentaje:.1f} % (cifra pública ~64 %)")
    comprobar("la proporción con doctorado está dentro del 10 % de la cifra pública",
              abs(porcentaje - 64) / 64 <= 0.10, f"{porcentaje:.1f} % frente a 64 %")

print("\n=== 2. Serie completa y coherente ===")
anios = sorted({a for (u, a, v) in sies if u == PUCV and v == "academicos_jce"})
comprobar("la serie de la PUCV cubre 2015-2025",
          anios and anios[0] == "2015" and anios[-1] == "2025", f"{anios[:1]}…{anios[-1:]}")
universidades = {u for (u, a, v) in sies if v == "academicos_jce"}
comprobar("hay al menos 40 universidades con JCE", len(universidades) >= 40, len(universidades))

# Ninguna proporción de doctorado puede pasar del 100 %: si pasa, se sumaron
# columnas de hojas distintas.
excesos = [(u, a) for (u, a, v) in sies if v == "academicos_jce_doctorado"
           and sies.get((u, a, "academicos_jce"), 0)
           and sies[(u, a, v)] > sies[(u, a, "academicos_jce")] * 1.001]
comprobar("ninguna universidad declara más doctorados que académicos",
          not excesos, f"{len(excesos)} casos, p. ej. {excesos[:2]}")

print("\n=== 3. Contra lo que las universidades declaran a THE ===")
the = indexar(leer("the", "procesado_chile.csv"))
comparables = []
for (universidad, anio, variable), fte in the.items():
    if variable != "estudiantes_fte":
        continue
    ratio_the = the.get((universidad, anio, "ratio_estudiantes_academico"))
    jce = sies.get((universidad, anio, "academicos_jce"))
    if not (ratio_the and jce):
        continue
    # THE no publica el número de académicos: se deduce de sus dos cifras.
    academicos_the = fte / ratio_the
    comparables.append((universidad, anio, academicos_the, jce, jce / academicos_the))

print(f"    {len(comparables)} pares universidad-año comparables")
comprobar("hay al menos 30 pares que comparar", len(comparables) >= 30, len(comparables))

if comparables:
    razones = [r for *_, r in comparables]
    mediana = statistics.median(razones)
    print(f"    razón JCE del SIES / académicos según THE: mediana {mediana:.2f}")
    # No se exige que coincidan: se exige que la relación sea estable y del orden
    # de uno. Una mediana de 0,5 o de 2 indicaría que se está comparando otra cosa.
    comprobar("la mediana de la razón está entre 0,7 y 1,4",
              0.7 <= mediana <= 1.4, f"{mediana:.2f}")

    lejos = sorted((abs(r - mediana) / mediana, u, a, r) for u, a, _, _, r in comparables)
    discrepantes = [(u, a, r) for d, u, a, r in lejos if d > 0.25]
    print(f"    {len(discrepantes)} pares se alejan más de 25 % de la mediana")
    for u, a, r in discrepantes[-5:]:
        print(f"      {u[:44]:46} {a}  razón {r:.2f}")
    # Que existan discrepantes no es un fallo: son universidades cuya declaración
    # a THE no cuadra con su reporte al Estado, y eso es justamente un hallazgo.
    comprobar("los discrepantes son minoría",
              len(discrepantes) <= len(comparables) * 0.4,
              f"{len(discrepantes)} de {len(comparables)}")

print("\n=== 4. La razón estudiantes/académico, medida contra la publicada ===")
# La comprobación que pide el plan: con la matrícula y los JCE del SIES se calcula
# la misma razón que THE publica. Mide las dos bases a la vez, así que un error en
# cualquiera de ellas aparece aquí.
#
# Se prueba con varios desfases de año porque THE no publica el dato del año de su
# edición: lo recoge con retraso. Cuál es ese retraso no estaba documentado en
# ninguna parte, y determinarlo importa para la calibración, porque empareja cada
# edición con el año del SIES que de verdad le corresponde.


def correlacion(pares):
    xs = [x for x, _ in pares]
    ys = [y for _, y in pares]
    if len(pares) < 3 or not statistics.pstdev(xs) or not statistics.pstdev(ys):
        return None
    mx, my = statistics.fmean(xs), statistics.fmean(ys)
    cov = sum((x - mx) * (y - my) for x, y in pares) / len(pares)
    return cov / (statistics.pstdev(xs) * statistics.pstdev(ys))


def comparar(desfase):
    filas = []
    for (universidad, anio, variable), estudiantes in sies.items():
        if variable != "estudiantes_total":
            continue
        jce = sies.get((universidad, anio, "academicos_jce"))
        publicada = the.get((universidad, str(int(anio) + desfase), "ratio_estudiantes_academico"))
        if not (jce and publicada):
            continue
        filas.append((universidad, anio, estudiantes / jce, publicada))
    if not filas:
        return [], None, None
    desvio = statistics.median(abs(p - q) / q for _, _, p, q in filas)
    return filas, correlacion([(p, q) for _, _, p, q in filas]), desvio


resultados = {}
for desfase in range(0, 6):
    filas_d, r_d, desvio_d = comparar(desfase)
    if r_d is None:
        continue
    resultados[desfase] = (filas_d, r_d, desvio_d)
    print(f"    desfase {desfase} año(s): {len(filas_d):3} pares · r = {r_d:+.2f} · "
          f"desvío mediano {desvio_d:.1%}")

comprobar("hay comparaciones que hacer", bool(resultados))

if resultados:
    mejor = min(resultados, key=lambda d: resultados[d][2])
    filas_m, r_m, desvio_m = resultados[mejor]
    print(f"\n    Mejor ajuste con {mejor} años de desfase: r = {r_m:+.2f}, "
          f"desvío mediano {desvio_m:.1%}")
    comprobar("la razón del SIES reproduce la publicada dentro del 15 %",
              desvio_m < 0.15, f"{desvio_m:.1%} con {mejor} años de desfase")
    comprobar("el mejor ajuste no es con el mismo año, sino con retraso",
              mejor >= 1, f"el mejor fue {mejor}")

    fuera = sorted(((abs(p - q) / q, u, a, p, q) for u, a, p, q in filas_m), reverse=True)
    discrepantes = [x for x in fuera if x[0] > 0.25]
    print(f"    {len(discrepantes)} de {len(filas_m)} pares se alejan más de 25 %:")
    for d, u, a, propia, publicada in discrepantes[:6]:
        print(f"      {u[:40]:42} {a}  SIES {propia:5.1f}  THE {publicada:5.1f}  ({d:+.0%})")
    # Que los haya no es un fallo: son universidades cuya declaración a THE no
    # cuadra con su reporte al Estado, y eso es un hallazgo, no un defecto.

print("\n" + "=" * 62)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
