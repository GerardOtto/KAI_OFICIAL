# -*- coding: utf-8 -*-
"""T5.2 — El valor crudo de cada métrica, con la fórmula del ranking que la define.

La plataforma guarda puntajes normalizados. Este guion hace el camino de vuelta
por la única vía que no es adivinanza: **recalcular** la métrica desde datos
reales con la fórmula publicada, en vez de intentar invertir la normalización.

Dos cosas que la metodología de THE fija y que aquí se respetan al pie de la
letra (`KAI/THE/the_world_university_rankings_2026_methodology.pdf`):

  * **El desfase institucional es de tres años.** «WUR 2026 […] the year ending
    in 2023». Así que la edición 2026 se calcula con el año 2023 del SIES. Es el
    mismo desfase que la comparación empírica con el SIES había encontrado por su
    cuenta —desvío mediano del 3 % en matrícula—, y esto lo confirma.

  * **La bibliometría va por otra ventana.** «all indexed publications between
    2020 and 2024» para esa misma edición 2026, es decir los cinco años que
    terminan dos antes. No es el mismo desfase, y usar uno solo desalinea la
    mitad de las métricas.

Lo que **no** se hace aquí es inventar. Una métrica sin insumo queda con
`valor_crudo` vacío y un motivo en `estado`; nunca se rellena con un promedio.

Uso:
    python tools/recoleccion/metricas_crudas.py
    python tools/recoleccion/metricas_crudas.py --ranking "THE Latam"
"""
from __future__ import annotations

import argparse
import csv
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

sys.path.insert(0, str(Path(__file__).resolve().parent))
import navegador as nav  # noqa: E402

SALIDA = nav.RAIZ / "metricas_crudas_chile.csv"

COLUMNAS = ["ranking", "metrica", "universidad", "edicion", "valor_crudo", "unidad",
            "formula", "variables_usadas", "anios_usados", "estado"]


# --------------------------------------------------------------------------- #
#  Desfases: de qué año son los datos que alimentan cada edición
# --------------------------------------------------------------------------- #
# (desfase institucional, ventana bibliométrica relativa a la edición)
#
# THE viene de su propia metodología. QS no publica el mapeo con esa claridad, así
# que su desfase se estima midiendo cuál alinea mejor —lo hace `calibrar.py`— y
# el valor de aquí es el que esa medición respalda.
DESFASES = {
    "THE Latam": {"institucional": 3, "ventana": (-6, -2)},
    # QS: medido con `calibrar.py`. Sobre una muestra idéntica en todos los
    # desfases, tres de los indicadores con R² por encima de 0,6 —International
    # Faculty Ratio, Staff with PhD y Papers per faculty— tienen su máximo en E-4 y
    # no en el borde del rango probado. El salto más elocuente es el de
    # International Faculty Ratio: 0,43 en E-0 contra 0,70 en E-4.
    "QS Latam": {"institucional": 4, "ventana": (-6, -2)},
    "QS Global": {"institucional": 4, "ventana": (-6, -2)},
    "Scimago Latam": {"institucional": 0, "ventana": (-4, 0)},
}


@dataclass(frozen=True)
class Metrica:
    """Una métrica de un ranking y cómo se recalcula desde datos reales."""
    ranking: str
    nombre: str          # exactamente como la nombra la tabla `metrica`
    formula: str         # legible, para que la fila del CSV se explique sola
    unidad: str
    calcular: Callable   # (inst, bib) -> float | None
    calidad: str         # 'directa' | 'aproximada' | 'parcial'
    nota: str = ""


def div(a, b):
    """División que se rinde en vez de explotar: sin insumo no hay métrica."""
    if a is None or not b:
        return None
    return a / b


def pct(a, b):
    r = div(a, b)
    return None if r is None else 100 * r


# --------------------------------------------------------------------------- #
#  THE Latam — las 17 métricas hoja, con la definición textual de la metodología
# --------------------------------------------------------------------------- #
THE = [
    Metrica("THE Latam", "Student Staff Ratio",
            "estudiantes_total / academicos_jce", "estudiantes por académico",
            lambda i, b: div(i("estudiantes_total"), i("academicos_jce")), "directa",
            "THE la define como personal FTE dividido por estudiantes FTE; se publica "
            "invertida, como estudiantes por académico, y así se calcula aquí"),

    Metrica("THE Latam", "Doctorate Bachelor Ratio",
            "graduados_doctorado / titulados_pregrado_total", "razón",
            lambda i, b: div(i("graduados_doctorado"), i("titulados_pregrado_total")), "directa",
            "«dividing the total number of doctorates awarded by the total number of "
            "undergraduate degrees awarded»"),

    Metrica("THE Latam", "Doctorate Staff Ratio",
            "graduados_doctorado / academicos_jce", "doctorados por académico",
            lambda i, b: div(i("graduados_doctorado"), i("academicos_jce")), "directa",
            "doctorados OTORGADOS por académico, no la proporción de académicos que "
            "tienen doctorado: son métricas distintas y es fácil confundirlas"),

    Metrica("THE Latam", "International Students",
            "pct_estudiantes_extranjeros (declarado a THE)", "%",
            lambda i, b: i("pct_estudiantes_extranjeros"), "directa",
            "THE lo publica entre sus key statistics, redondeado al entero"),

    Metrica("THE Latam", "International Staff",
            "100 * academicos_jce_extranjeros / academicos_jce", "%",
            lambda i, b: pct(i("academicos_jce_extranjeros"), i("academicos_jce")), "directa",
            "THE pide FTE sobre FTE, y el SIES publica ambos en JCE"),

    Metrica("THE Latam", "International Co-authorship",
            "pct_colaboracion_internacional", "%",
            lambda i, b: b("pct_colaboracion_internacional"), "aproximada",
            "misma definición, universo distinto: OpenAlex en vez de Scopus"),

    Metrica("THE Latam", "Citation Impact",
            "impacto_normalizado", "índice",
            lambda i, b: b("impacto_normalizado"), "aproximada",
            "impacto normalizado por campo de Scimago como sustituto del FWCI de Scopus"),

    Metrica("THE Latam", "Research Excellence",
            "docs_top10_scimago / academicos_jce", "documentos por académico",
            lambda i, b: div(b("docs_top10_scimago"), i("academicos_jce")), "aproximada",
            "«top 10% of publications worldwide by FWCI […] adjust by […] the total "
            "number of academic and research staff»: el divisor es parte de la métrica"),

    Metrica("THE Latam", "Research Influence",
            "docs_alta_calidad / academicos_jce", "documentos por académico",
            lambda i, b: div(b("docs_alta_calidad"), i("academicos_jce")), "aproximada",
            "THE pondera cada cita por la importancia de quien cita; Scimago no publica "
            "ese cálculo, así que es un sustituto de familia, no equivalente"),

    Metrica("THE Latam", "Research Productivity",
            "publicaciones_scopus / academicos_jce", "documentos por académico",
            lambda i, b: div(b("publicaciones_scopus"), i("academicos_jce")), "directa",
            "«papers […] indexed by Scopus […] divided by […] FTE research staff and "
            "FTE academic staff»"),

    Metrica("THE Latam", "Patents",
            "patentes / academicos_jce", "patentes por académico",
            lambda i, b: div(b("patentes"), i("academicos_jce")), "aproximada",
            "«count of patents citing an entity's published research […] we also "
            "normalise this by the sum of academic and research staff»"),

    Metrica("THE Latam", "Research Income",
            "montos_anid_adjudicados / academicos_jce", "pesos por académico",
            lambda i, b: div(i("montos_anid_adjudicados"), i("academicos_jce")), "parcial",
            "ANID es una parte del ingreso de investigación, no el total; además THE "
            "ajusta por paridad de poder adquisitivo"),

    Metrica("THE Latam", "Industry Income",
            "montos_anid_con_industria / academicos_jce", "pesos por académico",
            lambda i, b: div(i("montos_anid_con_industria"), i("academicos_jce")), "parcial",
            "solo capta el aporte de industria que pasa por un proyecto ANID"),

    Metrica("THE Latam", "Institutional Income",
            "ingresos_totales / academicos_jce", "pesos por académico",
            lambda i, b: div(i("ingresos_totales"), i("academicos_jce")), "parcial",
            "pendiente de los estados financieros (T2.3)"),

    Metrica("THE Latam", "Research Strength", "—", "percentil",
            lambda i, b: None, "parcial",
            "percentil 75 del FWCI de cada trabajo: exige el FWCI trabajo a trabajo, "
            "que ninguna fuente abierta publica"),

    Metrica("THE Latam", "Research Reputation", "—", "puntaje",
            lambda i, b: None, "parcial",
            "encuesta propia de THE; no se publica ni se vende"),

    Metrica("THE Latam", "Teaching Reputation", "—", "puntaje",
            lambda i, b: None, "parcial",
            "encuesta propia de THE; no se publica ni se vende"),
]


# --------------------------------------------------------------------------- #
#  QS — Latam y Global comparten la mayoría de las definiciones
# --------------------------------------------------------------------------- #
def _qs(ranking: str, nombre: str, *resto) -> Metrica:
    return Metrica(ranking, nombre, *resto)


def _metricas_qs(ranking: str, latam: bool) -> list[Metrica]:
    ms = [
        _qs(ranking, "Faculty student ratio" if latam else "Faculty Student Ratio",
            "academicos_total / estudiantes_total", "académicos por estudiante",
            lambda i, b: div(i("academicos_total"), i("estudiantes_total")), "aproximada",
            "QS cuenta jornada completa + parcial/3, que no es ni el recuento de "
            "personas ni el JCE del SIES; queda entre ambos"),

        _qs(ranking, "Papers per faculty" if latam else "Citations per Faculty",
            "publicaciones_scopus / academicos_total" if latam
            else "citas_openalex / academicos_total",
            "documentos por académico" if latam else "citas por académico",
            (lambda i, b: div(b("publicaciones_scopus"), i("academicos_total"))) if latam
            else (lambda i, b: div(b("citas_openalex"), i("academicos_total"))),
            "aproximada", "el denominador arrastra la misma ambigüedad del recuento de académicos"),

        _qs(ranking, "International research network" if latam else "International Research Network",
            "socios_recurrentes_paises", "países",
            lambda i, b: b("socios_recurrentes_paises"), "aproximada",
            "el IRN de QS es un índice sobre los socios con los que se publica de forma "
            "sostenida; aquí se usa el número de países distintos entre esos socios"),
    ]
    if latam:
        ms += [
            _qs(ranking, "Staff with PhD",
                "100 * academicos_doctorado / academicos_total", "%",
                lambda i, b: pct(i("academicos_doctorado"), i("academicos_total")), "directa",
                "proporción del cuerpo académico con grado de doctor"),

            _qs(ranking, "Citations per paper",
                "citas_por_documento_openalex", "citas por documento",
                lambda i, b: b("citas_por_documento_openalex"), "aproximada",
                "QS lo calcula sobre Scopus; OpenAlex indiza más, así que el cociente "
                "no es idéntico aunque sí del mismo orden"),

            _qs(ranking, "Web impact", "—", "índice",
                lambda i, b: None, "parcial",
                "depende de Webometrics, cuyo dominio no resuelve"),

            _qs(ranking, "Academic reputation", "—", "puntaje",
                lambda i, b: None, "parcial", "encuesta propia de QS"),

            _qs(ranking, "Employer reputation", "—", "puntaje",
                lambda i, b: None, "parcial", "encuesta propia de QS"),
        ]
    else:
        ms += [
            _qs(ranking, "International Students Ratio",
                "pct_estudiantes_extranjeros", "%",
                lambda i, b: i("pct_estudiantes_extranjeros"), "aproximada",
                "la cifra disponible es la que la universidad declara a THE"),

            _qs(ranking, "International Faculty Ratio",
                "100 * academicos_extranjeros / academicos_total", "%",
                lambda i, b: pct(i("academicos_extranjeros"), i("academicos_total")), "directa",
                "el SIES publica académicos extranjeros en personas y en JCE"),

            _qs(ranking, "Academic Reputation", "—", "puntaje",
                lambda i, b: None, "parcial", "encuesta propia de QS"),
            _qs(ranking, "Employer Reputation", "—", "puntaje",
                lambda i, b: None, "parcial", "encuesta propia de QS"),
            _qs(ranking, "Employment Outcomes", "—", "puntaje",
                lambda i, b: None, "parcial",
                "mezcla una encuesta de empleadores con un índice de egresados destacados"),
            _qs(ranking, "Sustainability", "—", "puntaje",
                lambda i, b: None, "parcial",
                "evaluación propia de QS sobre evidencia que la universidad presenta"),
        ]
    return ms


CATALOGO = THE + _metricas_qs("QS Latam", True) + _metricas_qs("QS Global", False)


# --------------------------------------------------------------------------- #
#  Lectura de los datos consolidados
# --------------------------------------------------------------------------- #
def cargar() -> tuple[dict, dict, set]:
    """Devuelve (anual, ventana, universidades) desde el consolidado."""
    ruta = nav.RAIZ / "valores_reales_chile.csv"
    if not ruta.exists():
        raise SystemExit(f"Falta {ruta}. Ejecuta antes consolidar.py.")

    anual: dict = defaultdict(dict)    # (universidad, variable) -> {anio: valor}
    ventana: dict = defaultdict(dict)  # (universidad, variable) -> {ventana: valor}
    universidades: set = set()

    with ruta.open(encoding="utf-8-sig", newline="") as f:
        for fila in csv.DictReader(f):
            try:
                valor = float(fila["valor"])
            except (TypeError, ValueError):
                continue
            universidades.add(fila["universidad"])
            clave = (fila["universidad"], fila["variable"])
            if fila.get("ventana"):
                ventana[clave][fila["ventana"]] = valor
            elif fila.get("anio_dato"):
                anual[clave][int(fila["anio_dato"])] = valor
    return anual, ventana, universidades


def ediciones_de(ranking: str, anual: dict, ventana: dict) -> list[int]:
    """Las ediciones para las que hay al menos un insumo."""
    d = DESFASES[ranking]
    anios = {a for datos in anual.values() for a in datos}
    ventanas = {v for datos in ventana.values() for v in datos}
    posibles = {a + d["institucional"] for a in anios}
    for v in ventanas:
        try:
            hasta = int(v.split("-")[1])
        except (IndexError, ValueError):
            continue
        posibles.add(hasta - d["ventana"][1])
    return sorted(e for e in posibles if 2015 <= e <= 2027)


def calcular_ranking(ranking: str, anual: dict, ventana: dict, universidades: set,
                     desfase_inst: int | None = None,
                     ventana_rel: tuple[int, int] | None = None) -> list[dict]:
    """Las filas crudas de un ranking, con el desfase que se le pida.

    Los desfases son parámetros y no constantes porque la calibración necesita
    probar varios: el de THE está documentado, el de QS hay que medirlo.
    """
    metricas = [m for m in CATALOGO if m.ranking == ranking]
    if not metricas:
        return []
    por_defecto = DESFASES[ranking]
    desfase_inst = por_defecto["institucional"] if desfase_inst is None else desfase_inst
    ventana_rel = por_defecto["ventana"] if ventana_rel is None else ventana_rel

    filas: list[dict] = []
    for edicion in ediciones_de(ranking, anual, ventana):
        anio_inst = edicion - desfase_inst
        etiqueta_ventana = f"{edicion + ventana_rel[0]}-{edicion + ventana_rel[1]}"

        for universidad in sorted(universidades):
            def inst(variable, _u=universidad, _a=anio_inst):
                return anual.get((_u, variable), {}).get(_a)

            def bib(variable, _u=universidad, _v=etiqueta_ventana):
                return ventana.get((_u, variable), {}).get(_v)

            for m in metricas:
                try:
                    valor = m.calcular(inst, bib)
                except (TypeError, ZeroDivisionError):
                    valor = None
                if valor is None:
                    continue
                filas.append({
                    "ranking": ranking,
                    "metrica": m.nombre,
                    "universidad": universidad,
                    "edicion": edicion,
                    "valor_crudo": round(valor, 6),
                    "unidad": m.unidad,
                    "formula": m.formula,
                    "variables_usadas": m.formula,
                    "anios_usados": f"institucional {anio_inst} · bibliometría {etiqueta_ventana}",
                    "estado": m.calidad,
                })
    return filas


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--ranking", help="calcular solo este ranking")
    args = p.parse_args()

    anual, ventana, universidades = cargar()
    print(f"{len(universidades)} universidades en el consolidado\n")

    rankings = [args.ranking] if args.ranking else sorted(DESFASES)
    filas: list[dict] = []

    for ranking in rankings:
        metricas = [m for m in CATALOGO if m.ranking == ranking]
        if not metricas:
            print(f"  {ranking}: sin métricas definidas (Scimago no se recalcula: "
                  f"sus valores ya son crudos)")
            continue
        desfase = DESFASES[ranking]
        print(f"=== {ranking} ===")
        print(f"  datos institucionales de la edición E: año E-{desfase['institucional']}")
        print(f"  ventana bibliométrica: E{desfase['ventana'][0]} a E{desfase['ventana'][1]}")

        nuevas = calcular_ranking(ranking, anual, ventana, universidades)
        filas.extend(nuevas)

        logrados = defaultdict(int)
        for f in nuevas:
            logrados[f["metrica"]] += 1
        for m in metricas:
            n = logrados[m.nombre]
            marca = f"{n:>5} valores" if n else "    sin insumo"
            print(f"    {m.nombre[:34]:36} {m.calidad:11} {marca}")
        print()

    if not filas:
        print("No se pudo calcular ninguna métrica.")
        return 1

    with SALIDA.open("w", encoding="utf-8-sig", newline="") as f:
        escritor = csv.DictWriter(f, fieldnames=COLUMNAS)
        escritor.writeheader()
        escritor.writerows(filas)

    metricas_con_valor = {(f["ranking"], f["metrica"]) for f in filas}
    print(f"{len(filas):,} valores crudos · {len(metricas_con_valor)} métricas "
          f"-> {SALIDA.name}".replace(",", "."))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
