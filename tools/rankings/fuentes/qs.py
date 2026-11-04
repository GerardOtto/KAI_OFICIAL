# -*- coding: utf-8 -*-
"""QS Latin America & The Caribbean y QS World University Rankings, desde la
planilla oficial.

topuniversities.com, qs.com y support.qs.com responden con un desafío de
Cloudflare a todo cliente automatizado, incluido un navegador sin cabeza. El
cargador no intenta pasarlo: la planilla oficial se descarga a mano —como las de
2024-2027 que ya están en el repositorio— y se deja en

    KAI/QS/DatosQS/QS LATAM/<año> QS Latam Rankings Results ….xlsx
    KAI/QS/DatosQS/QS global/<año> QS World University Rankings ….xlsx

con el año de la edición al comienzo del nombre. El resto es automático.

Las columnas se reconocen por el **rótulo visible** de la fila de categorías y no
por la fila de claves internas: en la planilla Latam 2025, las claves de «Staff
with PhD» y «Web Impact» dicen «ifr score2» e «isr score». Una categoría que no
está en el mapa detiene la carga: significa que QS cambió su metodología.
"""
from __future__ import annotations

import re
from pathlib import Path

from comun import RAIZ, TOTAL, ErrorDeFuente, Fila, ahora, forma, numero, resolvedor, sha256

CARPETAS = {
    "qs-latam": RAIZ / "KAI" / "QS" / "DatosQS" / "QS LATAM",
    "qs-global": RAIZ / "KAI" / "QS" / "DatosQS" / "QS global",
}
NOMBRE = {"qs-latam": "QS Latam", "qs-global": "QS Global"}

# Rótulo de la categoría (en su forma comparable) -> métrica de la base.
CATEGORIAS = {
    "qs-latam": {
        "academic reputation": "Academic reputation",
        "employer reputation": "Employer reputation",
        "faculty student": "Faculty student ratio",
        "faculty student ratio": "Faculty student ratio",
        "papers per faculty": "Papers per faculty",
        "citations per paper": "Citations per paper",
        "staff with phd": "Staff with PhD",
        "international research network": "International research network",
        "web impact": "Web impact",
        "overall": TOTAL,
    },
    "qs-global": {
        "academic reputation": "Academic Reputation",
        "employer reputation": "Employer Reputation",
        "faculty student": "Faculty Student Ratio",
        "faculty student ratio": "Faculty Student Ratio",
        "citations per faculty": "Citations per Faculty",
        "international faculty": "International Faculty Ratio",
        "international faculty ratio": "International Faculty Ratio",
        "international students": "International Students Ratio",
        "international students ratio": "International Students Ratio",
        "international research network": "International Research Network",
        "employment outcomes": "Employment Outcomes",
        "sustainability": "Sustainability",
        "overall": TOTAL,
    },
}
# Categorías que QS publica con peso 0 y que la base no guarda.
IGNORADAS = {"international students diversity"}
# Columnas de contexto, que no son indicadores.
CONTEXTO = {"rank", "index", "institution", "institution name", "name", "location", "country",
            "country territory", "region", "classification", "subregional rank", "previous rank"}


def planillas(clave: str) -> dict[int, Path]:
    """Edición -> planilla oficial disponible en el repositorio."""
    salida = {}
    for p in sorted(CARPETAS[clave].glob("*.xlsx")):
        m = re.match(r"(20\d\d)\b", p.name)
        if m and not p.name.startswith("~$"):
            salida[int(m.group(1))] = p
    return salida


def _cabeceras(filas: list[tuple]) -> tuple[int, list[str], list[str]]:
    """Fila de categorías (la que dice «Overall») y la de subcabeceras debajo."""
    for i, fila in enumerate(filas[:10]):
        rotulos = [forma(c) for c in fila]
        if "overall" in rotulos and i + 1 < len(filas):
            debajo = [forma(c) for c in filas[i + 1]]
            if any("score" in c for c in debajo):
                # La categoría ocupa varias columnas (puntaje y posición): se
                # propaga hacia la derecha hasta la siguiente.
                categorias, actual = [], ""
                for r in rotulos:
                    actual = r or actual
                    categorias.append(actual)
                return i, categorias, debajo
    raise ErrorDeFuente("no se encuentra la fila de categorías (ninguna dice «Overall»)")


def leer(clave: str, edicion: int, archivo: Path | None = None) -> tuple[list[Fila], dict]:
    import openpyxl

    archivo = archivo or planillas(clave).get(edicion)
    if archivo is None:
        raise ErrorDeFuente(f"{NOMBRE[clave]} {edicion}: no hay planilla oficial en {CARPETAS[clave]}")
    libro = openpyxl.load_workbook(archivo, read_only=True, data_only=True)
    ws = libro[libro.sheetnames[0]]
    filas = [tuple(f) for f in ws.iter_rows(values_only=True)]
    libro.close()

    i, categorias, sub = _cabeceras(filas)
    mapa = CATEGORIAS[clave]
    columnas: dict[str, int] = {}
    desconocidas = set()
    for j, (cat, s) in enumerate(zip(categorias, sub)):
        if not cat or "score" not in s:
            continue
        if cat in mapa:
            columnas.setdefault(mapa[cat], j)
        elif cat not in IGNORADAS and cat not in CONTEXTO and not cat.isdigit():
            desconocidas.add(cat)
    if desconocidas:
        raise ErrorDeFuente(f"{NOMBRE[clave]} {edicion}: categorías que el cargador no conoce "
                            f"{sorted(desconocidas)}; QS cambió su metodología")
    faltan = set(mapa.values()) - set(columnas)
    if TOTAL in faltan:
        raise ErrorDeFuente(f"{NOMBRE[clave]} {edicion}: sin columna de puntaje total")

    rotulos = [forma(c) for c in filas[i]]
    col_nombre = next((j for j, r in enumerate(rotulos) if r in ("institution", "institution name", "name")), None)
    if col_nombre is None:
        col_nombre = next((j for j, r in enumerate(sub) if r in ("institution", "institution name", "name")), None)
    if col_nombre is None:
        raise ErrorDeFuente(f"{NOMBRE[clave]} {edicion}: no se encuentra la columna del nombre")
    # La posición de la edición está bajo la categoría que lleva su año.
    col_rank = next((j for j, c in enumerate(categorias) if c in (str(edicion), f"{edicion} 0")), None)

    resolver, sin_alias, salida, chilenas = resolvedor(), set(), [], 0
    for fila in filas[i + 2:]:
        # La columna del país se reconoce por su contenido, no por su rótulo
        # (QS lo escribe de cinco maneras).
        if not any(isinstance(c, str) and c.strip() == "Chile" for c in fila):
            continue
        nombre = str(fila[col_nombre] or "").strip()
        if not nombre:
            continue
        universidad = resolver(nombre)
        if universidad is None:
            sin_alias.add(nombre)
            continue
        chilenas += 1
        posicion = str(fila[col_rank]).strip() if col_rank is not None and fila[col_rank] is not None else ""
        posicion = re.sub(r"\.0$", "", posicion)
        for metrica, j in columnas.items():
            v = numero(fila[j]) if j < len(fila) else None
            if v is not None:
                salida.append(Fila(NOMBRE[clave], edicion, "General", universidad, nombre, posicion, metrica, v))
    if sin_alias:
        raise ErrorDeFuente(f"{NOMBRE[clave]} {edicion}: universidades chilenas sin alias {sorted(sin_alias)}")
    if not chilenas:
        raise ErrorDeFuente(f"{NOMBRE[clave]} {edicion}: la planilla no trae universidades chilenas")
    meta = {"fuente": str(archivo.relative_to(RAIZ)).replace("\\", "/"), "leido": ahora(),
            "sha256": sha256(archivo.read_bytes()),
            "total": "Overall publicado; QS no lo publica bajo las primeras posiciones",
            "metricas_sin_columna": sorted(faltan)}
    return salida, meta
