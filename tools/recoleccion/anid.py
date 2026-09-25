# -*- coding: utf-8 -*-
"""T2.4 — ANID: fondos de investigación adjudicados, por institución y año.

THE mide *Research income* e *Industry income*, y ninguna universidad chilena los
publica con la definición del ranking. Los montos que ANID adjudica son el mejor
sustituto abierto: no son los ingresos totales de investigación —faltan fondos
internacionales, contratos privados y recursos propios— pero cubren la parte
concursable, que es la que mejor discrimina entre universidades chilenas.

La agencia publica su base histórica en GitHub, lo que evita raspar el sitio:

    ANID-GITHUB/Historico-de-Proyectos-Adjudicados · BDH_HISTORICA.csv (4,5 MB)

Una fila por iniciativa adjudicada desde 1982, con institución principal,
instrumento, año de fallo y monto. Se agrega por institución y año.

Uso:
    python tools/recoleccion/anid.py
    python tools/recoleccion/anid.py --solo-procesar
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import navegador as nav  # noqa: E402

FUENTE = "anid"
BASE = ("https://raw.githubusercontent.com/ANID-GITHUB/"
        "Historico-de-Proyectos-Adjudicados/master/BDH_HISTORICA.csv")
ARCHIVO = "proyectos_adjudicados.csv"
DESDE = 2015

# Instrumentos que suponen participación de empresas o transferencia a la
# industria. THE pide los ingresos que vienen de la industria; esto no es lo
# mismo, pero es lo más cercano que publica una fuente abierta, y se marca aparte
# para que quien lo use sepa qué está tomando.
CON_INDUSTRIA = ("FONDEF", "FONDAP", "IDEA I+D", "CONSORCIO", "CRHIAM",
                 "TRANSFERENCIA", "VINCULACION CIENCIA EMPRESA", "PORTAFOLIO I+D")


def descargar() -> Path | None:
    destino = nav.carpeta(FUENTE) / "raw" / ARCHIVO
    return nav.descargar(BASE, destino, FUENTE, notas="base histórica de proyectos adjudicados")


# La base declara la unidad en su propia columna: casi todo viene en **miles de
# pesos**, no en pesos. Tomarlo al pie de la letra dividiría por mil el
# presupuesto de investigación del país, así que se convierte según lo que diga
# `MONEDA` y lo que no esté en pesos se descarta con aviso.
FACTOR_A_PESOS = {
    "miles de pesos (m$)": 1000,
    "m$": 1000,
    "pesos": 1,
    "": 1000,  # las filas sin moneda siguen el formato dominante de la base
}


def numero(texto: str) -> float | None:
    """Los montos vienen con separador de miles y a veces con decimales."""
    limpio = (texto or "").strip().replace("$", "").replace(" ", "")
    if not limpio:
        return None
    # 1.234.567 o 1234567,89
    if limpio.count(",") == 1 and limpio.count(".") >= 1:
        limpio = limpio.replace(".", "").replace(",", ".")
    elif limpio.count(",") == 1:
        limpio = limpio.replace(",", ".")
    else:
        limpio = limpio.replace(".", "")
    try:
        return float(limpio)
    except ValueError:
        return None


def procesar() -> tuple[list[dict], set[str]]:
    ruta = nav.carpeta(FUENTE) / "raw" / ARCHIVO
    if not ruta.exists():
        return [], set()

    resolver = nav.resolvedor()
    montos: dict[tuple[str, int], float] = {}
    montos_industria: dict[tuple[str, int], float] = {}
    proyectos: dict[tuple[str, int], int] = {}
    por_instrumento: dict[tuple[str, int, str], float] = {}
    sin_alias: set[str] = set()
    otras_monedas: dict[str, int] = {}

    with ruta.open(encoding="utf-8-sig", newline="") as f:
        for registro in csv.DictReader(f, delimiter=";"):
            try:
                anio = int(str(registro.get("AGNO_FALLO") or "").strip()[:4])
            except ValueError:
                continue
            if anio < DESDE:
                continue

            universidad = resolver(registro.get("INSTITUCION_PRINCIPAL"))
            if universidad is None:
                sin_alias.add((registro.get("INSTITUCION_PRINCIPAL") or "").strip())
                continue

            moneda = (registro.get("MONEDA") or "").strip().lower()
            factor = FACTOR_A_PESOS.get(moneda)
            if factor is None:
                otras_monedas[moneda] = otras_monedas.get(moneda, 0) + 1
                continue
            monto = (numero(registro.get("MONTO_ADJUDICADO", "")) or 0) * factor
            clave = (universidad, anio)
            montos[clave] = montos.get(clave, 0) + monto
            proyectos[clave] = proyectos.get(clave, 0) + 1

            instrumento = (registro.get("INSTRUMENTO") or "").strip().upper()
            programa = (registro.get("PROGRAMA") or "").strip().upper()
            if monto:
                por_instrumento[(universidad, anio, instrumento)] = \
                    por_instrumento.get((universidad, anio, instrumento), 0) + monto
                if any(x in instrumento or x in programa for x in CON_INDUSTRIA):
                    montos_industria[clave] = montos_industria.get(clave, 0) + monto

    filas = []
    for (universidad, anio), monto in sorted(montos.items()):
        filas.append(nav.dato(FUENTE, universidad, "montos_anid_adjudicados", round(monto),
                              anio_dato=anio, unidad="CLP",
                              definicion="Suma adjudicada por ANID en el año de fallo, en pesos "
                                         "nominales (la base publica miles de pesos; aquí se "
                                         "convierte)", url=BASE))
        filas.append(nav.dato(FUENTE, universidad, "proyectos_anid_adjudicados",
                              proyectos[(universidad, anio)], anio_dato=anio, unidad="proyectos",
                              definicion="Iniciativas adjudicadas en el año de fallo", url=BASE))
        industria = montos_industria.get((universidad, anio))
        if industria:
            filas.append(nav.dato(FUENTE, universidad, "montos_anid_con_industria", round(industria),
                                  anio_dato=anio, unidad="CLP",
                                  definicion="Parte adjudicada en instrumentos que suponen "
                                             "participación de empresas o transferencia", url=BASE))

    # El desglose por instrumento se guarda aparte: son miles de filas y solo hace
    # falta para analizar la composición, no para las métricas.
    detalle = [nav.dato(FUENTE, universidad, f"montos_anid_{instrumento.lower().replace(' ', '_')}",
                        round(monto), anio_dato=anio, unidad="CLP",
                        definicion=f"Adjudicado en el instrumento {instrumento}", url=BASE)
               for (universidad, anio, instrumento), monto in sorted(por_instrumento.items())
               if instrumento]
    nav.escribir_procesado(FUENTE, detalle, "procesado_por_instrumento.csv")

    if otras_monedas:
        print(f"  ({sum(otras_monedas.values())} proyectos descartados por venir en otra "
              f"moneda: {otras_monedas})")
    return filas, sin_alias


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--solo-procesar", action="store_true")
    args = p.parse_args()

    if not args.solo_procesar:
        print("Descargando la base histórica de ANID…")
        ruta = descargar()
        print(f"  {'ok' if ruta else 'sin datos'}")

    filas, sin_alias = procesar()
    ruta = nav.escribir_procesado(FUENTE, filas)
    universidades = {f["universidad"] for f in filas}
    anios = {f["anio_dato"] for f in filas}
    print(f"\n{len(filas):,} filas · {len(universidades)} universidades · "
          f"{min(anios)}-{max(anios)} -> {ruta}".replace(",", "."))

    if sin_alias:
        print(f"  ({len(sin_alias)} beneficiarios que no son universidades de la tabla: "
              "centros, institutos, empresas y personas naturales)")

    # Control: la PUCV debe aparecer con adjudicaciones en todos los años.
    PUCV = "Pontificia Universidad Catolica de Valparaiso"
    suyos = sorted((f["anio_dato"], f["valor"]) for f in filas
                   if f["universidad"] == PUCV and f["variable"] == "montos_anid_adjudicados")
    print("\n  PUCV, adjudicado por año (millones de pesos):")
    for anio, monto in suyos:
        print(f"    {anio}  {monto/1e6:10,.0f}".replace(",", "."))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
