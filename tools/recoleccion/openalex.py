# -*- coding: utf-8 -*-
"""T3.1 — OpenAlex: bibliometría abierta de las universidades chilenas.

OpenAlex es la única fuente bibliométrica abierta que cubre todas las
universidades con el mismo criterio. No sustituye a Scopus —su cobertura es más
amplia y por tanto sus conteos son mayores—, pero permite dos cosas que ninguna
otra fuente abierta da:

  * medir la **colaboración internacional** y los **socios recurrentes**, que es lo
    que QS necesita para su métrica de red internacional (IRN);
  * calcular el **factor OpenAlex/Scopus** por universidad, comparando la misma
    ventana con los datos de Scimago, para poder traducir entre ambos universos.

Se consulta con `mailto`, que es lo que OpenAlex pide para dar acceso a su cola
cortés: sin él, las peticiones entran en la cola común y se ralentizan.

Uso:
    python tools/recoleccion/openalex.py                  # todas las chilenas
    python tools/recoleccion/openalex.py --universidades "Pontificia Universidad Catolica de Valparaiso"
    python tools/recoleccion/openalex.py --solo-procesar
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
import navegador as nav  # noqa: E402

FUENTE = "openalex"
API = "https://api.openalex.org"
CORREO = os.getenv("KAI_CORREO_OPENALEX", "keyacademicsindicators@gmail.com")

# Las tres ventanas que interesan: la de Scimago 2019-2023 sirve para calcular el
# factor entre universos, y las otras dos acompañan a las ediciones vigentes.
VENTANAS = [(2018, 2022), (2019, 2023), (2020, 2024)]

# Un socio cuenta como recurrente a partir de tres trabajos conjuntos, que es el
# umbral que usa QS en su métrica de red internacional.
MINIMO_SOCIO = 3


def pedir(ruta: str, **parametros) -> dict:
    parametros["mailto"] = CORREO
    nav.esperar()
    respuesta = requests.get(f"{API}/{ruta}", params=parametros, headers=nav.CABECERAS, timeout=90)
    respuesta.raise_for_status()
    return respuesta.json()


def instituciones_chilenas() -> dict[str, str]:
    """Nombre canónico -> identificador de OpenAlex.

    Se resuelve por nombre y no por ROR porque la tabla `universidad` no guarda
    identificadores externos. Lo que no se resuelve se informa: es preferible a
    emparejar por parecido y contaminar los datos.
    """
    resolver = nav.resolvedor()
    encontradas: dict[str, str] = {}
    sin_resolver: list[str] = []

    pagina, cursor = 1, "*"
    while cursor:
        datos = pedir("institutions", filter="country_code:CL", per_page=200, cursor=cursor)
        for institucion in datos["results"]:
            nombre = institucion["display_name"]
            canonico = resolver(nombre)
            if canonico is None:
                # También se prueban los alias que OpenAlex guarda.
                for alterno in institucion.get("display_name_alternatives", []):
                    canonico = resolver(alterno)
                    if canonico:
                        break
            if canonico:
                # Si dos registros apuntan a la misma universidad, gana el que más
                # trabajos tiene: OpenAlex mantiene duplicados menores de sedes.
                anterior = encontradas.get(canonico)
                if anterior is None or institucion["works_count"] > anterior[1]:
                    encontradas[canonico] = (institucion["id"].rsplit("/", 1)[-1],
                                             institucion["works_count"])
            elif institucion["works_count"] > 500:
                sin_resolver.append(f"{nombre} ({institucion['works_count']})")
        cursor = datos["meta"].get("next_cursor")
        pagina += 1
        if pagina > 10:
            break

    if sin_resolver:
        print(f"  [aviso] instituciones chilenas con producción que no son de la tabla "
              f"`universidad` ({len(sin_resolver)}): {sin_resolver[:4]}")
    return {k: v[0] for k, v in encontradas.items()}


def resumen_de_ventana(id_openalex: str, desde: int, hasta: int) -> dict:
    """Conteos agregados de una institución en una ventana, sin recorrer los trabajos.

    `group_by` resuelve en una petición lo que recorrer los trabajos costaría
    cientos: OpenAlex devuelve el recuento por tipo de documento, y el total viene
    en el propio `meta`.
    """
    filtro = f"institutions.id:{id_openalex},publication_year:{desde}-{hasta}"
    por_tipo = pedir("works", filter=filtro, group_by="type", per_page=200)
    total = por_tipo["group_by"] and sum(g["count"] for g in por_tipo["group_by"])
    tipos = {g["key"]: g["count"] for g in por_tipo["group_by"]}

    # Colaboración internacional: el mismo filtro con el número de países distintos.
    internacional = pedir("works", filter=f"{filtro},institutions.country_code:!cl",
                          per_page=1)["meta"]["count"]

    return {"total": total or 0, "tipos": tipos, "internacional": internacional}


def socios(id_openalex: str, desde: int, hasta: int, tope_paginas: int = 6) -> list[tuple[str, str, int]]:
    """Instituciones extranjeras con trabajos conjuntos, con su país.

    Se piden agregados por institución asociada; OpenAlex devuelve los más
    frecuentes primero, de modo que unas pocas páginas bastan para los socios
    recurrentes, que es lo que pide QS.
    """
    filtro = f"institutions.id:{id_openalex},publication_year:{desde}-{hasta}"
    datos = pedir("works", filter=filtro, group_by="institutions.id", per_page=200)
    cuenta: list[tuple[str, str, int]] = []
    for grupo in datos.get("group_by", []):
        if grupo["count"] < MINIMO_SOCIO or grupo["key"].endswith(id_openalex):
            continue
        cuenta.append((grupo["key"].rsplit("/", 1)[-1], grupo["key_display_name"], grupo["count"]))
    return cuenta[:200]


def recolectar(universidades: dict[str, str], solo: list[str] | None) -> list[dict]:
    filas: list[dict] = []
    objetivo = {k: v for k, v in universidades.items() if not solo or k in solo}
    print(f"{len(objetivo)} universidades por consultar")

    for n, (universidad, id_openalex) in enumerate(sorted(objetivo.items()), start=1):
        print(f"  [{n:2}/{len(objetivo)}] {universidad[:46]}")
        crudo = {"id_openalex": id_openalex, "ventanas": {}}
        for desde, hasta in VENTANAS:
            ventana = f"{desde}-{hasta}"
            try:
                resumen = resumen_de_ventana(id_openalex, desde, hasta)
            except Exception as e:  # noqa: BLE001 - se informa y se sigue
                print(f"      {ventana}: fallo ({type(e).__name__})")
                continue
            crudo["ventanas"][ventana] = resumen

            url = f"{API}/works?filter=institutions.id:{id_openalex},publication_year:{desde}-{hasta}"
            filas.append(nav.dato(FUENTE, universidad, "publicaciones_openalex", resumen["total"],
                                  anio_dato=hasta, ventana=ventana, unidad="trabajos",
                                  definicion="Trabajos con al menos un autor de la institución",
                                  url=url, metodo="api"))
            for tipo, cuenta in sorted(resumen["tipos"].items()):
                filas.append(nav.dato(FUENTE, universidad, f"publicaciones_openalex_{tipo}", cuenta,
                                      anio_dato=hasta, ventana=ventana, unidad="trabajos",
                                      definicion=f"Trabajos de tipo «{tipo}»", url=url, metodo="api"))
            if resumen["total"]:
                filas.append(nav.dato(FUENTE, universidad, "pct_colaboracion_internacional",
                                      round(100 * resumen["internacional"] / resumen["total"], 2),
                                      anio_dato=hasta, ventana=ventana, unidad="%",
                                      definicion="Trabajos con coautor de una institución de otro país",
                                      url=url, metodo="api"))

        # Los socios se piden solo para la ventana más reciente: es la que usa QS.
        desde, hasta = VENTANAS[-1]
        try:
            lista = socios(id_openalex, desde, hasta)
        except Exception as e:  # noqa: BLE001
            print(f"      socios: fallo ({type(e).__name__})")
            lista = []
        crudo["socios"] = lista
        if lista:
            filas.append(nav.dato(FUENTE, universidad, "socios_recurrentes", len(lista),
                                  anio_dato=hasta, ventana=f"{desde}-{hasta}", unidad="instituciones",
                                  definicion=f"Instituciones con {MINIMO_SOCIO} o más trabajos conjuntos",
                                  url=f"{API}/works", metodo="api"))

        (nav.carpeta(FUENTE) / "raw" / f"{universidad.replace(' ', '_')}.json").write_text(
            json.dumps(crudo, ensure_ascii=False, indent=1), encoding="utf-8")

    return filas


def verificar(filas: list[dict]) -> int:
    """Control del plan: la PUCV debe rondar los 5.900 trabajos en 2019-2023."""
    PUCV = "Pontificia Universidad Catolica de Valparaiso"
    fallos = 0
    valores = [f["valor"] for f in filas if f["universidad"] == PUCV
               and f["variable"] == "publicaciones_openalex" and f["ventana"] == "2019-2023"]
    if not valores:
        print("  [FALLA] no hay dato de la PUCV en 2019-2023")
        return 1
    obtenido = valores[0]
    desvio = abs(obtenido - 5900) / 5900
    print(f"\n  PUCV 2019-2023: {obtenido:,.0f} trabajos (referencia del estudio ~5.900, "
          f"desvío {desvio:.0%})".replace(",", "."))
    if desvio > 0.25:
        print("  [FALLA] se aparta más de un 25 % de la referencia")
        fallos += 1
    return fallos


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--universidades", nargs="*", default=None)
    p.add_argument("--solo-procesar", action="store_true")
    args = p.parse_args()

    print(f"OpenAlex · cola cortés con {CORREO}")
    if args.solo_procesar:
        print("(--solo-procesar no aplica aquí: los datos llegan por API, no como archivo)")

    universidades = instituciones_chilenas()
    print(f"{len(universidades)} universidades de la base identificadas en OpenAlex")

    filas = recolectar(universidades, args.universidades)
    ruta = nav.escribir_procesado(FUENTE, filas)
    print(f"\n{len(filas):,} filas -> {ruta}".replace(",", "."))

    fallos = verificar(filas)
    print("\nT3.1 " + ("terminada" if not fallos else f"con {fallos} comprobación(es) en rojo"))
    return 1 if fallos else 0


if __name__ == "__main__":
    raise SystemExit(main())
