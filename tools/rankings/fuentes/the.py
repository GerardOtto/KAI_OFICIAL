# -*- coding: utf-8 -*-
"""THE Latin America University Rankings y THE World University Rankings, desde
sus páginas oficiales.

THE World tiene endpoint JSON público (`/json/ranking_tables/world_university_
rankings/<edición>`), el mismo que usa tools/recoleccion/the.py. La tabla
latinoamericana no: viaja dentro del HTML, en el bloque `__NEXT_DATA__`. Una
edición que todavía no sale responde 404. THE no publicó edición latinoamericana
2025: tras la 2024 vino la 2026.

El puntaje total: THE publica el Overall exacto de las mejor clasificadas y, de
las demás, solo una banda («13.2–24.5»). Para esas se calcula con los pesos de
los pilares de la edición, y solo si esos pesos reproducen los Overall exactos de
la misma edición (±0,15). Cada valor calculado debe caer dentro de su banda.
"""
from __future__ import annotations

import json
import re

from comun import TOTAL, ErrorDeFuente, Fila, ahora, descargar, numero, resolvedor, sha256

PAGINA = "https://www.timeshighereducation.com/world-university-rankings/{edicion}/latin-america-university-rankings"
MUNDIAL = "https://www.timeshighereducation.com/json/ranking_tables/world_university_rankings/{edicion}"
PRIMERA_MUNDIAL = 2016
# Ediciones mundiales cuyo total no se puede calcular con certeza. En 2016 THE no
# publicó el Overall de las universidades en bandas (escribió «0») y ningún juego de
# pesos reproduce sus Overall exactos mejor que ±0,62: se cargan los pilares, sin
# total. Cualquier otra edición que no cuadre se rechaza.
SIN_TOTAL_MUNDIAL = {2016}
PRIMERA = 2016
SIN_EDICION = {2025}

# Campo del JSON de THE -> pilar en la base. Hasta 2023 los pilares se llamaban
# Research y Citations; la base los guarda con el nombre nuevo.
PILARES = {
    "scores_teaching": "Teaching",
    "scores_research": "Research Environment",
    "scores_citations": "Research Quality",
    "scores_industry_income": "Industry",
    "scores_international_outlook": "International Outlook",
}

# Pesos de la metodología latinoamericana, deducidos de los Overall publicados
# (migración 020), y los de la mundial (WUR 2.0 hasta 2023, WUR 3.0 desde 2024).
# Una edición con otros pesos hace fallar la comprobación y hay que agregarla aquí.
PESOS = {
    "hasta_2023": {"Teaching": 36, "Research Environment": 34, "Research Quality": 20,
                   "Industry": 2.5, "International Outlook": 7.5},
    "desde_2024": {"Teaching": 35, "Research Environment": 33.5, "Research Quality": 20,
                   "Industry": 4, "International Outlook": 7.5},
}
PESOS_MUNDIAL = {
    "hasta_2023": {"Teaching": 30, "Research Environment": 30, "Research Quality": 30,
                   "Industry": 2.5, "International Outlook": 7.5},
    "desde_2024": {"Teaching": 29.5, "Research Environment": 29, "Research Quality": 30,
                   "Industry": 4, "International Outlook": 7.5},
}


def pesos_de(edicion: int, mundial: bool = False) -> dict:
    return (PESOS_MUNDIAL if mundial else PESOS)["hasta_2023" if edicion <= 2023 else "desde_2024"]


def _tabla(html: str) -> list[dict] | None:
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
    if not m:
        return None
    arbol = json.loads(m.group(1))
    try:
        return arbol["props"]["pageProps"]["page"]["rankingsTableConfig"]["rankingsData"]["data"]
    except (KeyError, TypeError):
        return None


def existe(edicion: int) -> bool:
    import requests

    from comun import CABECERAS

    if edicion in SIN_EDICION:
        return False
    r = requests.get(PAGINA.format(edicion=edicion), headers=CABECERAS, timeout=90)
    return r.status_code == 200 and bool(_tabla(r.text))


def existe_mundial(edicion: int) -> bool:
    import requests

    from comun import CABECERAS

    r = requests.get(MUNDIAL.format(edicion=edicion), headers=CABECERAS, timeout=120)
    try:
        return r.status_code == 200 and bool(r.json().get("data"))
    except ValueError:
        return False


def _exacto(texto) -> float | None:
    """El Overall cuando es una cifra (no una banda ni el «0» de las bandas de 2016)."""
    texto = str(texto or "").strip()
    if not re.fullmatch(r"[\d.]+", texto):
        return None
    v = float(texto)
    return v if v > 0 else None


def _procesar(nombre: str, edicion: int, tabla: list[dict], pesos: dict, url: str, contenido: bytes,
              sin_total: bool = False):
    # Los pesos se comprueban con todas las universidades de la tabla que traen un
    # Overall exacto, no solo con las chilenas.
    errores = []
    for r in tabla:
        exacto = _exacto(r.get("scores_overall"))
        pilares = [numero(r.get(c)) for c in PILARES]
        if exacto is not None and None not in pilares:
            errores.append(abs(sum(v * pesos[n] / 100 for v, n in zip(pilares, PILARES.values())) - exacto))
    error_max = max(errores) if errores else None
    if not sin_total and (error_max is None or error_max > 0.15):
        raise ErrorDeFuente(f"{nombre} {edicion}: los pesos conocidos no reproducen el Overall publicado "
                            f"(error máximo {error_max}); agrega los de esta edición en fuentes/the.py")

    resolver, sin_alias, filas, sin_banda = resolvedor(), set(), [], 0
    for r in tabla:
        if r.get("location") != "Chile":
            continue
        # Tal como lo publica THE («126–150»): rango_posicion entiende las dos rayas.
        posicion = str(r.get("rank", "")).strip()
        # «Reporter»: entregó datos a THE pero no se clasifica.
        if not re.search(r"\d", posicion):
            continue
        universidad = resolver(r["name"])
        if universidad is None:
            sin_alias.add(r["name"])
            continue
        valores = {}
        for campo, pilar in PILARES.items():
            v = numero(r.get(campo))
            if v is not None:
                valores[pilar] = v
                filas.append(Fila(nombre, edicion, "General", universidad, r["name"], posicion, pilar, v))
        exacto = _exacto(r.get("scores_overall"))
        if exacto is not None:
            filas.append(Fila(nombre, edicion, "General", universidad, r["name"], posicion, TOTAL, exacto))
            continue
        if sin_total:
            continue
        if len(valores) < len(PILARES):
            raise ErrorDeFuente(f"{nombre} {edicion}: {r['name']} sin Overall ni pilares completos")
        suma = sum(valores[p] * pesos[p] / 100 for p in PILARES.values())
        calculado = round(suma, 1)
        overall = str(r.get("scores_overall", "")).strip()
        banda = re.fullmatch(r"([\d.]+)\s*[–-]\s*([\d.]+)", overall)
        if banda:
            # Con la suma sin redondear y un margen de 0,1: los pilares se publican
            # con un decimal, y la UNAB en 2027 da 24,154 frente a una banda que
            # termina en 24,1.
            desde, hasta = float(banda.group(1)), float(banda.group(2))
            if not desde - 0.1 <= suma <= hasta + 0.1:
                raise ErrorDeFuente(f"{nombre} {edicion}: {r['name']} calculado {calculado} fuera de su banda {overall}")
        else:
            sin_banda += 1  # THE 2016 publicó «0» en vez de la banda
        filas.append(Fila(nombre, edicion, "General", universidad, r["name"], posicion, TOTAL,
                          calculado, "calculado"))
    if sin_alias:
        raise ErrorDeFuente(f"{nombre} {edicion}: universidades chilenas sin alias {sorted(sin_alias)}")
    meta = {"fuente": url, "descargado": ahora(), "sha256": sha256(contenido),
            "total": ("sin total: los pesos no reproducen los Overall publicados de esta edición" if sin_total
                      else "Overall publicado; en las bandas, calculado con los pesos de la edición"),
            "pesos": pesos, "error_max_contra_publicados": round(error_max, 3) if error_max is not None else None}
    if sin_banda:
        meta["sin_banda_publicada"] = sin_banda
    return filas, meta


def latam(edicion: int) -> tuple[list[Fila], dict]:
    url = PAGINA.format(edicion=edicion)
    contenido = descargar(url, f"the/latam_{edicion}.html", permitir_404=True)
    if contenido is None:
        raise ErrorDeFuente(f"THE Latam {edicion} no está publicado")
    tabla = _tabla(contenido.decode("utf-8", errors="replace"))
    if not tabla:
        raise ErrorDeFuente(f"THE Latam {edicion}: la página ya no trae la tabla en __NEXT_DATA__")
    return _procesar("THE Latam", edicion, tabla, pesos_de(edicion), url, contenido)


def mundial(edicion: int) -> tuple[list[Fila], dict]:
    url = MUNDIAL.format(edicion=edicion)
    contenido = descargar(url, f"the/mundial_{edicion}.json", permitir_404=True)
    if contenido is None:
        raise ErrorDeFuente(f"THE World {edicion} no está publicado")
    try:
        tabla = json.loads(contenido).get("data")
    except ValueError:
        tabla = None
    if not tabla:
        raise ErrorDeFuente(f"THE World {edicion}: el JSON no trae la tabla")
    return _procesar("THE World", edicion, tabla, pesos_de(edicion, mundial=True), url, contenido,
                     sin_total=edicion in SIN_TOTAL_MUNDIAL)
