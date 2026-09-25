# -*- coding: utf-8 -*-
"""T1.1 — THE: puntajes y estadísticas de todas las universidades del mundo.

Por qué el mundo entero y no solo Chile: THE normaliza cada métrica con la función
de probabilidad acumulada de los puntajes Z de toda la tabla (§3.1 del estudio). Sin
la distribución mundial no hay forma de estimar μ y σ, y sin ellas no se puede
invertir un puntaje. El scraper que ya existía filtraba por Chile y descartaba la
mayor parte de los campos; aquí se guarda el JSON íntegro.

Fuentes (endpoints JSON públicos, los mismos que usa la web de THE):
    /json/ranking_tables/world_university_rankings/{año}
    /json/ranking_tables/world_university_rankings/{año}/key_statistics
    /json/ranking_tables/latin_america_university_rankings/{año}

Uso:
    python tools/recoleccion/the.py                # 2016-2026, mundial y Latam
    python tools/recoleccion/the.py --anios 2026
    python tools/recoleccion/the.py --solo-procesar # reprocesa lo que ya está en raw/
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import navegador as nav  # noqa: E402

FUENTE = "the"
BASE = "https://www.timeshighereducation.com/json/ranking_tables"
# La tabla mundial tiene endpoint JSON; la de Latinoamérica no, y hay que sacarla
# del bloque `__NEXT_DATA__` que la página incrusta (mismo dato, otra envoltura).
TABLA_WUR = "world_university_rankings"
LATAM = "https://www.timeshighereducation.com/world-university-rankings/{anio}/latin-america-university-rankings"
ANIOS = list(range(2016, 2027))
# THE no publicó edición latinoamericana 2025: tras la de 2024 vino la de 2026.
SIN_LATAM = {2025}

# Campos numéricos del JSON que interesan como *valores reales* y no como puntaje.
# El nombre de la izquierda es el del JSON de THE; el de la derecha, la variable del
# catálogo (§4 del plan).
ESTADISTICAS = {
    "stats_number_students": ("estudiantes_fte", "estudiantes",
                              "Número de estudiantes equivalentes a jornada completa (FTE) declarado a THE"),
    "stats_student_staff_ratio": ("ratio_estudiantes_academico", "estudiantes por académico",
                                  "Estudiantes FTE por académico FTE, definición THE"),
    "stats_pc_intl_students": ("pct_estudiantes_extranjeros", "%",
                               "Porcentaje de estudiantes internacionales, definición THE"),
    "stats_female_male_ratio": ("ratio_mujeres_hombres", "mujeres:hombres",
                                "Proporción de estudiantes mujeres por hombres"),
    "stats_proportion_of_isr": ("pct_academicos_extranjeros", "%",
                                "Proporción de personal internacional, definición THE"),
}

# Puntajes publicados: no son valores reales, pero son las anclas de calibración.
PUNTAJES = {
    "scores_overall": "the_puntaje_global",
    "scores_teaching": "the_puntaje_teaching",
    "scores_research": "the_puntaje_research_environment",
    "scores_citations": "the_puntaje_research_quality",
    "scores_industry_income": "the_puntaje_industry",
    "scores_international_outlook": "the_puntaje_international_outlook",
}


def url_tabla(tabla: str, anio: int, sufijo: str = "") -> str:
    if tabla == "latam":
        return LATAM.format(anio=anio)
    return f"{BASE}/{TABLA_WUR}/{anio}{sufijo}"


def descargar_todo(anios: list[int]) -> None:
    base = nav.carpeta(FUENTE)
    for anio in anios:
        for sufijo, etiqueta in (("", "ranking"), ("/key_statistics", "key_statistics")):
            destino = base / "raw" / f"wur_{anio}_{etiqueta}.json"
            ruta = nav.descargar(url_tabla("wur", anio, sufijo), destino, FUENTE,
                                 notas=f"wur {anio} {etiqueta}")
            print(f"  wur   {anio} {etiqueta:15} {'ok' if ruta else 'sin datos'}")

    for anio in anios:
        if anio in SIN_LATAM:
            print(f"  latam {anio} {'':15} no hubo edición")
            continue
        destino = base / "raw" / f"latam_{anio}_ranking.json"
        if destino.exists() and destino.stat().st_size > 0:
            print(f"  latam {anio} {'':15} en caché")
            continue
        pagina = base / "raw" / f"latam_{anio}_pagina.html"
        if not nav.descargar(url_tabla("latam", anio), pagina, FUENTE, notas=f"latam {anio} html"):
            print(f"  latam {anio} {'':15} sin datos")
            continue
        datos = _extraer_next_data(pagina)
        if datos is None:
            print(f"  latam {anio} {'':15} sin tabla en la página")
            continue
        destino.write_text(json.dumps({"data": datos}, ensure_ascii=False), encoding="utf-8")
        nav.anotar(FUENTE, {"archivo": destino.name, "url": url_tabla("latam", anio),
                            "fecha_descarga": nav.ahora(), "metodo": "requests+next_data",
                            "sha256": nav.sha256(destino), "notas": f"{len(datos)} instituciones"})
        print(f"  latam {anio} {'':15} ok ({len(datos)} instituciones)")


def _extraer_next_data(pagina: Path) -> list[dict] | None:
    """Saca la tabla del bloque JSON que Next.js incrusta en la página.

    La tabla latinoamericana no tiene endpoint propio: el mismo dato viaja dentro
    del HTML, en `__NEXT_DATA__`. Se busca por la ruta conocida y, si THE cambia su
    estructura, se recorre el árbol en busca de la lista de instituciones, para que
    un cambio de nombres no obligue a reescribir el recolector.
    """
    html = pagina.read_text(encoding="utf-8", errors="replace")
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
    if not m:
        return None
    try:
        arbol = json.loads(m.group(1))
    except ValueError:
        return None

    try:
        return arbol["props"]["pageProps"]["page"]["rankingsTableConfig"]["rankingsData"]["data"]
    except (KeyError, TypeError):
        pass

    encontrada: list[dict] | None = None

    def recorrer(nodo):
        nonlocal encontrada
        if encontrada is not None:
            return
        if isinstance(nodo, list):
            if nodo and isinstance(nodo[0], dict) and {"name", "rank"} <= set(nodo[0]):
                encontrada = nodo
                return
            for x in nodo:
                recorrer(x)
        elif isinstance(nodo, dict):
            for v in nodo.values():
                recorrer(v)

    recorrer(arbol)
    return encontrada


def _numero(valor) -> float | None:
    """Convierte los números de THE a float. Devuelve None si no es un número.

    THE mezcla formatos en el mismo campo: «18,070» con separador de miles, «23.2»
    con punto decimal, «2%» con símbolo y «n/a». Un valor no numérico no es un
    error: significa que esa universidad no reportó ese dato.
    """
    if valor is None:
        return None
    texto = str(valor).strip().replace(",", "").replace("%", "").strip()
    if not texto or texto.lower() in {"n/a", "na", "-", "reporter", "unranked"}:
        return None
    try:
        return float(texto)
    except ValueError:
        return None


def _filas_de(archivo: Path, tabla: str, anio: int, mapa: dict) -> list[dict]:
    """Traduce un JSON de THE al formato largo."""
    try:
        datos = json.loads(archivo.read_text(encoding="utf-8"))
    except (ValueError, OSError) as e:
        print(f"  [aviso] {archivo.name} ilegible: {e}")
        return []

    url = url_tabla(tabla, anio, "/key_statistics" if "key_statistics" in archivo.name else "")
    filas = []
    for institucion in datos.get("data", []):
        nombre_the = (institucion.get("name") or "").strip()
        # El nombre canónico solo existe para las chilenas; del resto se conserva el
        # nombre de THE, porque hacen falta para la distribución mundial.
        universidad = mapa.get(nombre_the, nombre_the)
        pais = institucion.get("location", "")

        for clave, (variable, unidad, definicion) in ESTADISTICAS.items():
            valor = _numero(institucion.get(clave))
            if valor is None:
                continue
            filas.append(nav.dato(FUENTE, universidad, variable, valor, anio_dato=anio,
                                  unidad=unidad, definicion=f"{definicion} ({pais})", url=url))

        for clave, variable in PUNTAJES.items():
            valor = _numero(institucion.get(clave))
            if valor is None:
                continue
            filas.append(nav.dato(FUENTE, universidad, f"{variable}_{tabla}", valor,
                                  anio_dato=anio, unidad="puntaje 0-100",
                                  definicion=f"Puntaje publicado por THE ({tabla}, {pais})", url=url))

        rango = institucion.get("rank")
        if rango:
            filas.append(nav.dato(FUENTE, universidad, f"the_posicion_{tabla}", rango,
                                  anio_dato=anio, unidad="posición",
                                  definicion=f"Posición publicada por THE ({pais})", url=url))
    return filas


def procesar(anios: list[int]) -> list[dict]:
    base = nav.carpeta(FUENTE) / "raw"
    mapa = nav.mapa_de_nombres("the")
    filas: list[dict] = []
    for tabla in ("wur", "latam"):
        for anio in anios:
            for etiqueta in ("ranking", "key_statistics"):
                archivo = base / f"{tabla}_{anio}_{etiqueta}.json"
                if archivo.exists():
                    filas.extend(_filas_de(archivo, tabla, anio, mapa))
    return filas


def verificar(filas: list[dict]) -> int:
    """Criterio de término de T1.1, tal como lo fija el plan."""
    PUCV = "Pontificia Universidad Catolica de Valparaiso"
    fallos = 0

    universidades_2026 = {f["universidad"] for f in filas
                          if f["anio_dato"] == 2026 and f["variable"].endswith("_wur")}
    print(f"\n  universidades en la edición mundial 2026: {len(universidades_2026)}")
    if len(universidades_2026) < 2000:
        print("  [FALLA] se esperaban más de 2.000")
        fallos += 1

    esperado = {"estudiantes_fte": 18070, "ratio_estudiantes_academico": 23.2,
                "pct_estudiantes_extranjeros": 2}
    for variable, valor_esperado in esperado.items():
        obtenidos = [f["valor"] for f in filas
                     if f["universidad"] == PUCV and f["variable"] == variable
                     and f["anio_dato"] == 2026]
        if not obtenidos:
            print(f"  [FALLA] la PUCV no trae {variable} en 2026")
            fallos += 1
            continue
        valor = obtenidos[0]
        ok = abs(valor - valor_esperado) <= max(0.1, abs(valor_esperado) * 0.001)
        print(f"  [{'OK ' if ok else 'FALLA'}] PUCV {variable}: {valor} (esperado {valor_esperado})")
        fallos += 0 if ok else 1

    return fallos


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--anios", nargs="*", type=int, default=ANIOS)
    p.add_argument("--solo-procesar", action="store_true")
    args = p.parse_args()

    if not args.solo_procesar:
        print("Descargando THE (mundial y Latinoamérica)…")
        descargar_todo(args.anios)

    filas = procesar(args.anios)
    ruta = nav.escribir_procesado(FUENTE, filas)
    print(f"\n{len(filas):,} filas -> {ruta}".replace(",", "."))

    # El archivo completo pesa unos 90 MB: lleva las más de 3.000 universidades
    # del mundo, que hacen falta para estimar la distribución con la que THE
    # normaliza, pero no para la plataforma. Se emite aparte el subconjunto
    # chileno —pequeño y versionable— y el completo se regenera con este guion.
    chilenas = set(nav.universidades_de_la_base())
    solo_chile = [f for f in filas if f["universidad"] in chilenas]
    ruta_chile = nav.escribir_procesado(FUENTE, solo_chile, "procesado_chile.csv")
    print(f"{len(solo_chile):,} de ellas chilenas -> {ruta_chile.name}".replace(",", "."))

    fallos = verificar(filas)
    print("\nT1.1 " + ("terminada" if not fallos else f"con {fallos} comprobación(es) en rojo"))
    return 1 if fallos else 0


if __name__ == "__main__":
    raise SystemExit(main())
