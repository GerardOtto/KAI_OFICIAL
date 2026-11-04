# -*- coding: utf-8 -*-
"""THE Latin America University Rankings, desde su página oficial.

La tabla latinoamericana no tiene endpoint JSON: viaja dentro del HTML, en el
bloque `__NEXT_DATA__` (lo mismo que hace tools/recoleccion/the.py). Una edición
que todavía no sale responde 404. THE no publicó edición 2025: tras la 2024 vino
la 2026.

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
# (migración 020). Una edición con otros pesos hace fallar la comprobación y hay
# que agregarla aquí.
PESOS = {
    "hasta_2023": {"Teaching": 36, "Research Environment": 34, "Research Quality": 20,
                   "Industry": 2.5, "International Outlook": 7.5},
    "desde_2024": {"Teaching": 35, "Research Environment": 33.5, "Research Quality": 20,
                   "Industry": 4, "International Outlook": 7.5},
}


def pesos_de(edicion: int) -> dict:
    return PESOS["hasta_2023" if edicion <= 2023 else "desde_2024"]


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


def latam(edicion: int) -> tuple[list[Fila], dict]:
    url = PAGINA.format(edicion=edicion)
    contenido = descargar(url, f"the/latam_{edicion}.html", permitir_404=True)
    if contenido is None:
        raise ErrorDeFuente(f"THE Latam {edicion} no está publicado")
    tabla = _tabla(contenido.decode("utf-8", errors="replace"))
    if not tabla:
        raise ErrorDeFuente(f"THE Latam {edicion}: la página ya no trae la tabla en __NEXT_DATA__")

    pesos = pesos_de(edicion)
    # Los pesos se comprueban con todas las universidades de la tabla que traen un
    # Overall exacto, no solo con las chilenas.
    errores = []
    for r in tabla:
        exacto = numero(r.get("scores_overall"))
        pilares = [numero(r.get(c)) for c in PILARES]
        if exacto is not None and None not in pilares and re.fullmatch(r"[\d.]+", str(r["scores_overall"]).strip()):
            errores.append(abs(sum(v * pesos[n] / 100 for v, n in zip(pilares, PILARES.values())) - exacto))
    error_max = max(errores) if errores else None
    if error_max is None or error_max > 0.15:
        raise ErrorDeFuente(f"THE Latam {edicion}: los pesos conocidos no reproducen el Overall publicado "
                            f"(error máximo {error_max}); agrega los de esta edición en PESOS")

    resolver, sin_alias, filas = resolvedor(), set(), []
    for r in tabla:
        if r.get("location") != "Chile":
            continue
        universidad = resolver(r["name"])
        if universidad is None:
            sin_alias.add(r["name"])
            continue
        posicion = str(r.get("rank", "")).strip()
        valores = {}
        for campo, pilar in PILARES.items():
            v = numero(r.get(campo))
            if v is not None:
                valores[pilar] = v
                filas.append(Fila("THE Latam", edicion, "General", universidad, r["name"], posicion, pilar, v))
        overall = str(r.get("scores_overall", "")).strip()
        if re.fullmatch(r"[\d.]+", overall):
            filas.append(Fila("THE Latam", edicion, "General", universidad, r["name"], posicion, TOTAL,
                              float(overall)))
            continue
        banda = re.fullmatch(r"([\d.]+)\s*[–-]\s*([\d.]+)", overall)
        if not banda or len(valores) < len(PILARES):
            raise ErrorDeFuente(f"THE Latam {edicion}: {r['name']} sin Overall ni pilares completos ({overall!r})")
        calculado = round(sum(valores[p] * pesos[p] / 100 for p in PILARES.values()), 1)
        desde, hasta = float(banda.group(1)), float(banda.group(2))
        if not desde - 0.05 <= calculado <= hasta + 0.05:
            raise ErrorDeFuente(f"THE Latam {edicion}: {r['name']} calculado {calculado} fuera de su banda {overall}")
        filas.append(Fila("THE Latam", edicion, "General", universidad, r["name"], posicion, TOTAL,
                          calculado, "calculado"))
    if sin_alias:
        raise ErrorDeFuente(f"THE Latam {edicion}: universidades chilenas sin alias {sorted(sin_alias)}")
    meta = {"fuente": url, "descargado": ahora(), "sha256": sha256(contenido),
            "total": "Overall publicado; en las bandas, calculado con los pesos de la edición",
            "pesos": pesos, "error_max_contra_publicados": round(error_max, 3)}
    return filas, meta
