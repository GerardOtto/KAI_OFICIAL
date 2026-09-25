# -*- coding: utf-8 -*-
"""T1.2 — QS: puntajes por indicador de las ediciones que ya están en el repo.

QS normaliza con una recta y un techo en 100 (§3.2 del estudio), así que sus
puntajes sirven de ancla para calibrar: con dos universidades de valor conocido se
recupera la recta de cada indicador y edición. Para eso hacen falta varias
ediciones, y las hojas oficiales ya están en el repositorio:

    KAI/QS/DatosQS/QS LATAM/   2024, 2025 y 2026
    KAI/QS/DatosQS/QS global/  2024 a 2027

La base solo tiene QS Latam 2025, de modo que procesarlas aquí multiplica por seis
las anclas disponibles sin salir a la red.

Queda fuera, y se documenta como pendiente: el **perfil** de cada universidad en
topuniversities.com (total de estudiantes y de académicos con la definición de QS),
que exige descubrir su endpoint con un navegador.

Uso:
    python tools/recoleccion/qs.py
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
import navegador as nav  # noqa: E402

FUENTE = "qs"
RAIZ = Path(__file__).resolve().parents[2]
CARPETAS = {
    "latam": RAIZ / "KAI" / "QS" / "DatosQS" / "QS LATAM",
    "global": RAIZ / "KAI" / "QS" / "DatosQS" / "QS global",
}

# Rótulo de la fila 4 de cada hoja -> variable del catálogo. Se usa esa fila y no
# la de títulos porque es la única estable entre ediciones: QS cambia el texto
# visible ("Faculty Student" / "Faculty Student Ratio") pero no la clave interna.
INDICADORES = {
    "ar score": ("qs_puntaje_reputacion_academica", "Encuesta de reputación académica"),
    "er score": ("qs_puntaje_reputacion_empleadores", "Encuesta de reputación entre empleadores"),
    "fsr score": ("qs_puntaje_ratio_academicos", "Razón de académicos por estudiante"),
    "irn score": ("qs_puntaje_red_internacional", "Red internacional de investigación"),
    "cpp score": ("qs_puntaje_citas_por_articulo", "Citas por artículo"),
    "ppf score": ("qs_puntaje_articulos_por_academico", "Artículos por académico"),
    "swp score": ("qs_puntaje_academicos_con_doctorado", "Proporción de académicos con doctorado"),
    "web score": ("qs_puntaje_impacto_web", "Impacto web, derivado de Webometrics"),
    "score scaled": ("qs_puntaje_global", "Puntaje global de la edición"),
    "ifr score": ("qs_puntaje_academicos_internacionales", "Proporción de académicos internacionales"),
    "isr score": ("qs_puntaje_estudiantes_internacionales", "Proporción de estudiantes internacionales"),
    "irt score": ("qs_puntaje_red_internacional", "Red internacional de investigación"),
    "sus score": ("qs_puntaje_sostenibilidad", "Sostenibilidad"),
    "ger score": ("qs_puntaje_empleabilidad", "Resultados de empleabilidad"),
    "cpf score": ("qs_puntaje_citas_por_academico", "Citas por académico"),
    "isd score": ("qs_puntaje_diversidad_internacional", "Diversidad de estudiantes internacionales"),
    "eo score": ("qs_puntaje_empleabilidad", "Resultados de empleabilidad"),
    "overall score": ("qs_puntaje_global", "Puntaje global de la edición"),
}

# La columna del nombre de la institución se rotula «institution» en las hojas
# latinoamericanas y «name» en las mundiales nuevas.
NOMBRE_INSTITUCION = ("institution", "name")


def _anio(nombre: str) -> int | None:
    m = re.search(r"(20\d\d)", nombre)
    return int(m.group(1)) if m else None


def _fila_de_claves(ws) -> tuple[int, list[str]]:
    """Fila cuyas celdas traen las claves internas («ar score», «institution»).

    Se busca en lugar de fijarla: entre ediciones cambia de la 3 a la 4.
    """
    for n, fila in enumerate(ws.iter_rows(min_row=1, max_row=8, values_only=True), start=1):
        celdas = [str(c).strip().lower() if c is not None else "" for c in fila]
        if any(x in celdas for x in NOMBRE_INSTITUCION) and any(c in INDICADORES for c in celdas):
            return n, celdas
    return 0, []


def _columna_del_pais(claves: list[str], filas: list[tuple]) -> int | None:
    """Índice de la columna que contiene nombres de país, visto en los datos."""
    candidatas = [i for i, c in enumerate(claves)
                  if "country" in c or "location" in c or "territory" in c]
    for i in candidatas or range(len(claves)):
        valores = {str(f[i]).strip().lower() for f in filas if i < len(f) and f[i]}
        if "chile" in valores:
            return i
    return None


def _numero(valor) -> float | None:
    if valor is None:
        return None
    texto = str(valor).strip().replace(",", "")
    if not texto or texto in {"-", "n/a"}:
        return None
    try:
        return float(texto)
    except ValueError:
        return None


def procesar() -> tuple[list[dict], list[str], list[str]]:
    mapa = nav.mapa_de_nombres()
    chilenas = set(nav.universidades_de_la_base())
    filas: list[dict] = []
    sin_alias: set[str] = set()
    hojas: list[str] = []

    for tabla, carpeta in CARPETAS.items():
        if not carpeta.exists():
            print(f"  [aviso] no existe {carpeta}")
            continue
        for archivo in sorted(carpeta.glob("*.xlsx")):
            anio = _anio(archivo.name)
            if anio is None:
                print(f"  [aviso] sin año en el nombre: {archivo.name}")
                continue
            libro = openpyxl.load_workbook(archivo, read_only=True, data_only=True)
            ws = libro[libro.sheetnames[0]]
            n_claves, claves = _fila_de_claves(ws)
            if not claves:
                print(f"  [aviso] {archivo.name}: no se reconoce la fila de claves")
                continue

            col_institucion = next(claves.index(x) for x in NOMBRE_INSTITUCION if x in claves)
            # La columna del país se elige por su contenido y no por su
            # rótulo. QS lo escribe de cinco maneras entre ediciones —«country /
            # territory», «location», «location code»…— y dos de ellas engañan:
            # «rank in country» trae la posición nacional y «location code», la
            # sigla. Buscar dónde dice «Chile» acierta en todas.
            filas_muestra = list(ws.iter_rows(min_row=n_claves + 1, max_row=n_claves + 400,
                                              values_only=True))
            col_pais = _columna_del_pais(claves, filas_muestra)
            if col_pais is None:
                print(f"  [aviso] {archivo.name}: no se identifica la columna de país")
                libro.close()
                continue

            n_chilenas = 0
            for fila in ws.iter_rows(min_row=n_claves + 1, values_only=True):
                nombre = fila[col_institucion] if col_institucion < len(fila) else None
                if not nombre:
                    continue
                nombre = str(nombre).strip()
                pais = str(fila[col_pais]).strip() if col_pais is not None and col_pais < len(fila) else ""
                if pais and pais.lower() not in {"chile"}:
                    continue

                universidad = mapa.get(nombre)
                if universidad is None:
                    if pais.lower() == "chile":
                        sin_alias.add(nombre)
                    continue
                if universidad not in chilenas:
                    continue
                n_chilenas += 1

                for i, clave in enumerate(claves):
                    if clave not in INDICADORES or i >= len(fila):
                        continue
                    valor = _numero(fila[i])
                    if valor is None:
                        continue
                    variable, definicion = INDICADORES[clave]
                    filas.append(nav.dato(
                        FUENTE, universidad, f"{variable}_{tabla}", valor, anio_dato=anio,
                        unidad="puntaje 0-100",
                        definicion=f"{definicion} · QS {tabla} {anio}, puntaje normalizado",
                        url=str(archivo.relative_to(RAIZ)).replace("\\", "/"),
                        metodo="archivo del repositorio"))

            hojas.append(f"{tabla} {anio}: {n_chilenas} universidades chilenas")
            libro.close()

    return filas, sorted(sin_alias), hojas


def verificar(filas: list[dict]) -> int:
    """Criterio de término de T1.2, en su parte de puntajes."""
    PUCV = "Pontificia Universidad Catolica de Valparaiso"
    fallos = 0

    ediciones = {(f["anio_dato"]) for f in filas
                 if f["universidad"] == PUCV and f["variable"].endswith("_latam")}
    print(f"\n  ediciones Latam con puntajes de la PUCV: {sorted(ediciones)}")
    if len(ediciones) < 3:
        print("  [FALLA] se esperaban al menos tres ediciones Latam")
        fallos += 1

    indicadores = {f["variable"] for f in filas if f["universidad"] == PUCV}
    print(f"  indicadores distintos para la PUCV: {len(indicadores)}")
    if len(indicadores) < 8:
        print("  [FALLA] se esperaban ocho o más indicadores")
        fallos += 1
    return fallos


def main() -> int:
    argparse.ArgumentParser(description=__doc__).parse_args()

    filas, sin_alias, hojas = procesar()
    for h in hojas:
        print(f"  {h}")

    ruta = nav.escribir_procesado(FUENTE, filas)
    print(f"\n{len(filas):,} filas -> {ruta}".replace(",", "."))
    if sin_alias:
        # Son en su mayoría universidades de otros países que el filtro no atrapó
        # por venir sin país; se listan para poder revisarlo.
        print(f"  [aviso] {len(sin_alias)} nombres sin alias (muestra): {sin_alias[:5]}")

    fallos = verificar(filas)
    print("\nT1.2 (puntajes) " + ("terminada" if not fallos else f"con {fallos} en rojo"))
    print("T1.2 (perfiles de topuniversities.com) pendiente: exige descubrir el "
          "endpoint con navegador.")
    return 1 if fallos else 0


if __name__ == "__main__":
    raise SystemExit(main())
