# -*- coding: utf-8 -*-
"""T5.1 — Une lo recolectado en un solo archivo, y señala dónde las fuentes discrepan.

Cada fuente escribe su `procesado.csv` en el mismo formato largo, así que
consolidar es concatenar. Lo que no es trivial es el conflicto: dos fuentes que
dan valores distintos para la misma universidad, año y variable. Ahí **no se
elige en silencio**; se conservan ambos y se listan aparte, porque cuál vale
depende de la definición de cada ranking y eso lo decide una persona.

Produce tres archivos en `KAI/Datos reales/`:

    valores_reales_chile.csv         todo el formato largo, con su fuente
    valores_reales_chile_ancho.csv   una fila por universidad y año
    conflictos.csv                   donde dos fuentes no coinciden

Uso:
    python tools/recoleccion/consolidar.py
"""
from __future__ import annotations

import argparse
import csv
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import navegador as nav  # noqa: E402

# Archivos de cada fuente que entran en el consolidado. Se nombran uno a uno y no
# con un comodín para no arrastrar salidas auxiliares —el desglose por
# instrumento de ANID, el procesado mundial de THE— que multiplicarían el tamaño
# sin aportar a las métricas.
ENTRADAS = [
    ("the", "procesado_chile.csv"),
    ("qs", "procesado.csv"),
    ("scimago", "procesado.csv"),
    ("scimago", "procesado_ventana_nueva.csv"),
    ("sies", "procesado.csv"),
    ("anid", "procesado.csv"),
    ("openalex", "procesado.csv"),
]

# Dos valores de la misma variable se consideran discrepantes si difieren más de
# esto. No es un umbral de calidad: es lo que separa un redondeo de una
# diferencia de definición.
TOLERANCIA = 0.02


def leer(fuente: str, nombre: str) -> list[dict]:
    ruta = nav.RAIZ / fuente / nombre
    if not ruta.exists():
        return []
    with ruta.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def numero(texto: str) -> float | None:
    try:
        return float(texto)
    except (TypeError, ValueError):
        return None


def main() -> int:
    argparse.ArgumentParser(description=__doc__).parse_args()

    filas: list[dict] = []
    for fuente, nombre in ENTRADAS:
        nuevas = leer(fuente, nombre)
        print(f"  {fuente + '/' + nombre:42} {len(nuevas):>7,} filas".replace(",", "."))
        filas.extend(nuevas)

    if not filas:
        print("No hay nada que consolidar. Ejecuta antes los recolectores.")
        return 1

    # 1. El archivo largo, tal cual, con la fuente de cada dato.
    salida = nav.RAIZ / "valores_reales_chile.csv"
    with salida.open("w", encoding="utf-8-sig", newline="") as f:
        escritor = csv.DictWriter(f, fieldnames=nav.COLUMNAS, extrasaction="ignore")
        escritor.writeheader()
        escritor.writerows(filas)

    # 2. Conflictos: misma universidad, año y variable, valores distintos.
    por_clave: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    for fila in filas:
        if fila.get("ventana"):
            continue  # las ventanas bibliométricas no compiten con los datos anuales
        por_clave[(fila["universidad"], fila["anio_dato"], fila["variable"])].append(fila)

    conflictos = []
    for (universidad, anio, variable), grupo in sorted(por_clave.items()):
        fuentes = {f["fuente"] for f in grupo}
        if len(fuentes) < 2:
            continue
        valores = {f["fuente"]: numero(f["valor"]) for f in grupo}
        limpios = [v for v in valores.values() if v is not None]
        if len(limpios) < 2:
            continue
        menor, mayor = min(limpios), max(limpios)
        if mayor == 0 or (mayor - menor) / abs(mayor) <= TOLERANCIA:
            continue
        conflictos.append({
            "universidad": universidad, "anio_dato": anio, "variable": variable,
            "fuentes": " vs ".join(sorted(fuentes)),
            "valores": " vs ".join(f"{f}={v:g}" for f, v in sorted(valores.items()) if v is not None),
            "diferencia_relativa": round((mayor - menor) / abs(mayor), 4),
        })

    ruta_conflictos = nav.RAIZ / "conflictos.csv"
    with ruta_conflictos.open("w", encoding="utf-8-sig", newline="") as f:
        escritor = csv.DictWriter(f, fieldnames=["universidad", "anio_dato", "variable",
                                                 "fuentes", "valores", "diferencia_relativa"])
        escritor.writeheader()
        escritor.writerows(sorted(conflictos, key=lambda c: -c["diferencia_relativa"]))

    # 3. La tabla ancha: una fila por universidad y año. Cuando dos fuentes dan la
    #    misma variable se antepone la que mide, no la que publica un puntaje.
    PRIORIDAD = {"sies": 0, "anid": 1, "openalex": 2, "scimago": 3, "the": 4, "qs": 5}
    ancho: dict[tuple[str, str], dict[str, str]] = defaultdict(dict)
    elegido: dict[tuple[str, str, str], int] = {}
    for fila in filas:
        if fila.get("ventana"):
            continue
        clave = (fila["universidad"], fila["anio_dato"])
        variable = fila["variable"]
        rango = PRIORIDAD.get(fila["fuente"], 9)
        if variable not in ancho[clave] or rango < elegido.get((*clave, variable), 9):
            ancho[clave][variable] = fila["valor"]
            elegido[(*clave, variable)] = rango

    variables = sorted({v for fila in ancho.values() for v in fila})
    ruta_ancho = nav.RAIZ / "valores_reales_chile_ancho.csv"
    with ruta_ancho.open("w", encoding="utf-8-sig", newline="") as f:
        escritor = csv.writer(f)
        escritor.writerow(["universidad", "anio"] + variables)
        for (universidad, anio), valores in sorted(ancho.items()):
            escritor.writerow([universidad, anio] + [valores.get(v, "") for v in variables])

    # 4. Factor entre universos bibliométricos. Scimago cuenta lo que indiza
    #    Scopus; OpenAlex, un universo más amplio. Sus totales no son comparables
    #    tal cual, pero su razón sí es estable por universidad, y es lo que permite
    #    traducir una cifra de OpenAlex a términos de Scopus —que es el universo
    #    con el que trabajan THE y QS— cuando solo se tiene la primera.
    scopus = {(f["universidad"], f["ventana"]): numero(f["valor"]) for f in filas
              if f["fuente"] == "scimago" and f["variable"] == "publicaciones_scopus"}
    openalex = {(f["universidad"], f["ventana"]): numero(f["valor"]) for f in filas
                if f["fuente"] == "openalex" and f["variable"] == "publicaciones_openalex"}

    factores = []
    for clave, valor_scopus in sorted(scopus.items()):
        valor_openalex = openalex.get(clave)
        if not (valor_scopus and valor_openalex):
            continue
        universidad, ventana = clave
        factores.append({"universidad": universidad, "ventana": ventana,
                         "publicaciones_scopus": round(valor_scopus),
                         "publicaciones_openalex": round(valor_openalex),
                         "factor_openalex_scopus": round(valor_openalex / valor_scopus, 3)})

    ruta_factor = nav.RAIZ / "factor_openalex_scopus.csv"
    with ruta_factor.open("w", encoding="utf-8-sig", newline="") as f:
        escritor = csv.DictWriter(f, fieldnames=["universidad", "ventana", "publicaciones_scopus",
                                                 "publicaciones_openalex", "factor_openalex_scopus"])
        escritor.writeheader()
        escritor.writerows(factores)

    universidades = {f["universidad"] for f in filas}
    print(f"\n{len(filas):,} datos · {len(universidades)} universidades · "
          f"{len(variables)} variables".replace(",", "."))
    print(f"  -> {salida.name}")
    print(f"  -> {ruta_ancho.name} ({len(ancho)} filas universidad-año)")
    print(f"  -> {ruta_conflictos.name} ({len(conflictos)} conflictos entre fuentes)")
    if factores:
        valores = sorted(f["factor_openalex_scopus"] for f in factores)
        mediana = valores[len(valores) // 2]
        print(f"  -> {ruta_factor.name} ({len(factores)} pares · factor mediano {mediana:.2f})")
        print("     OpenAlex indiza más que Scopus; el factor traduce entre ambos universos.")

    if conflictos:
        print("\n  Los cinco conflictos mayores:")
        for c in sorted(conflictos, key=lambda c: -c["diferencia_relativa"])[:5]:
            print(f"    {c['universidad'][:34]:36} {c['anio_dato']}  {c['variable'][:28]:30} "
                  f"{c['valores']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
