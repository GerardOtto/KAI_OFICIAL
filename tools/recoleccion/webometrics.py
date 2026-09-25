# -*- coding: utf-8 -*-
"""T1.4 — Webometrics: posición mundial y subindicadores de las universidades chilenas.

Alimenta la métrica *Web impact* de QS, que es la única que se puede medir sin
datos internos de la institución: QS la construye a partir de la posición de
Webometrics.

Estado del acceso: `webometrics.info` **no resuelve** desde este equipo. El
dominio existe pero no publica dirección IP —no es un bloqueo del proxy ni un 403,
es que el sitio no responde—, así que la descarga automática falla antes de salir
a la red. El guion queda escrito y funciona en cuanto el sitio vuelva; mientras
tanto procesa un archivo guardado a mano:

    1. Abre https://www.webometrics.info/en/Latin_America/Chile en un navegador.
    2. Guarda la página completa como HTML.
    3. Déjala en KAI/Datos reales/webometrics/raw/chile.html
    4. python tools/recoleccion/webometrics.py --solo-procesar

Uso:
    python tools/recoleccion/webometrics.py
    python tools/recoleccion/webometrics.py --solo-procesar
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import navegador as nav  # noqa: E402

FUENTE = "webometrics"
URL = "https://www.webometrics.info/en/Latin_America/Chile"

# Columnas de la tabla de Webometrics, en el orden en que las publica.
COLUMNAS = {
    "World Rank": ("webometrics_rank_mundial", "posición",
                   "Posición mundial en el Ranking Web de Universidades"),
    "Impact Rank": ("webometrics_rank_visibilidad", "posición",
                    "Posición en visibilidad: enlaces externos hacia el dominio"),
    "Openness Rank": ("webometrics_rank_transparencia", "posición",
                      "Posición en transparencia: citas de los autores más citados"),
    "Excellence Rank": ("webometrics_rank_excelencia", "posición",
                        "Posición en excelencia: artículos en el 10 % más citado"),
    "Ranking": ("webometrics_rank_nacional", "posición", "Posición dentro de Chile"),
}


def _texto(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<.*?>", " ", html)).strip()


def _tabla(html: str) -> tuple[list[str], list[list[str]]]:
    """Encabezados y filas de la primera tabla con más de diez filas."""
    for bloque in re.findall(r"<table.*?</table>", html, re.S | re.I):
        filas = re.findall(r"<tr.*?</tr>", bloque, re.S | re.I)
        if len(filas) < 10:
            continue
        analizadas = []
        for fila in filas:
            celdas = [_texto(c) for c in re.findall(r"<t[dh].*?>(.*?)</t[dh]>", fila, re.S | re.I)]
            if celdas:
                analizadas.append(celdas)
        if len(analizadas) > 10:
            return analizadas[0], analizadas[1:]
    return [], []


def procesar() -> tuple[list[dict], list[str]]:
    archivo = nav.carpeta(FUENTE) / "raw" / "chile.html"
    if not archivo.exists():
        return [], []

    encabezados, filas_tabla = _tabla(archivo.read_text(encoding="utf-8", errors="replace"))
    if not filas_tabla:
        print("  [aviso] el archivo no contiene una tabla reconocible")
        return [], []

    # La columna del nombre no siempre se rotula igual; se toma la que trae texto
    # largo y no números, que es la única con nombres de universidad.
    indice_nombre = next((i for i, h in enumerate(encabezados)
                          if "university" in h.lower() or "institution" in h.lower()), 1)

    mapa = nav.mapa_de_nombres()
    filas, sin_alias = [], []
    for celdas in filas_tabla:
        if len(celdas) <= indice_nombre:
            continue
        nombre = celdas[indice_nombre]
        universidad = mapa.get(nombre)
        if universidad is None:
            sin_alias.append(nombre)
            universidad = nombre
        for i, encabezado in enumerate(encabezados):
            if encabezado not in COLUMNAS or i >= len(celdas):
                continue
            variable, unidad, definicion = COLUMNAS[encabezado]
            valor = celdas[i].replace(",", "").strip()
            if not valor.isdigit():
                continue
            filas.append(nav.dato(FUENTE, universidad, variable, int(valor),
                                  unidad=unidad, definicion=definicion, url=URL,
                                  metodo="manual"))
    return filas, sin_alias


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--solo-procesar", action="store_true")
    args = p.parse_args()

    if not args.solo_procesar:
        destino = nav.carpeta(FUENTE) / "raw" / "chile.html"
        if nav.descargar(URL, destino, FUENTE, notas="tabla de Chile") is None:
            print("  No se pudo descargar. Si el sitio sigue sin responder, guarda la")
            print(f"  página a mano en {destino} y vuelve con --solo-procesar.")

    filas, sin_alias = procesar()
    if not filas:
        print("\nT1.4 pendiente: no hay datos que procesar (ver instrucciones arriba).")
        return 1

    ruta = nav.escribir_procesado(FUENTE, filas)
    universidades = {f["universidad"] for f in filas}
    print(f"\n{len(filas)} filas · {len(universidades)} universidades -> {ruta}")
    if sin_alias:
        print(f"  [aviso] sin alias en la base: {sorted(set(sin_alias))[:8]}")
    print("\nT1.4 terminada")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
