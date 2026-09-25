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

print("\n" + "=" * 62)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
