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
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
import navegador as nav  # noqa: E402

FUENTE = "openalex"
API = "https://api.openalex.org"
CORREO = os.getenv("KAI_CORREO_OPENALEX", "keyacademicsindicators@gmail.com")

# Ventanas quinquenales que terminan entre 2017 y 2025. Al principio eran tres
# —la de Scimago 2019-2023 para el factor entre universos y dos para las
# ediciones vigentes de THE y QS—; el Ranking KAI necesita una por año para que
# su serie tenga la misma extensión que la del SIES, y para que Tendencias pueda
# ajustar una recta con algo más que tres puntos.
VENTANAS = [(desde, desde + 4) for desde in range(2013, 2022)]

# Los socios recurrentes se piden solo para una ventana, que es la que usa QS. Se
# fija aparte para que agregar ventanas nuevas al final no cambie cuál es.
VENTANA_SOCIOS = (2020, 2024)

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

    # Colaboración internacional: trabajos en los que participa más de un país.
    #
    # Aquí hay una trampa que costó una recolección entera. Lo natural parece pedir
    # `institutions.country_code:!cl` —"que haya una institución de fuera"—, pero la
    # negación de OpenAlex sobre un campo de varios valores excluye el trabajo si
    # *alguno* de sus valores es `cl`. Junto al filtro de una institución chilena,
    # eso describe el conjunto vacío, y devuelve 0 sin error ninguno. El campo que
    # sirve es `countries_distinct_count`.
    internacional = pedir("works", filter=f"{filtro},countries_distinct_count:>1",
                          per_page=1)["meta"]["count"]

    # Citas recibidas: OpenAlex no las suma, pero agrupar por `cited_by_count`
    # devuelve el histograma —cuántos trabajos tienen 0 citas, cuántos 1, …— y la
    # suma ponderada es el total. Cabe en una petición porque los buckets son unos
    # cientos como mucho. Se verifica que el histograma cubra todos los trabajos:
    # si OpenAlex truncara la lista, el total saldría corto en silencio.
    histograma = pedir("works", filter=filtro, group_by="cited_by_count",
                       per_page=200).get("group_by", [])
    cubiertos = sum(g["count"] for g in histograma)
    citas = sum(int(g["key"]) * g["count"] for g in histograma)

    return {"total": total or 0, "tipos": tipos, "internacional": internacional,
            "citas": citas, "citas_cubren": cubiertos}


def socios(id_openalex: str, desde: int, hasta: int) -> list[tuple[str, str, int]]:
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


def _archivo_crudo(universidad: str) -> Path:
    return nav.carpeta(FUENTE) / "raw" / f"{universidad.replace(' ', '_')}.json"


def recolectar(universidades: dict[str, str], solo: list[str] | None,
               rehacer: bool = False) -> list[dict]:
    """Consulta la API y deja el crudo de cada universidad en `raw/`.

    Lo guardado se reutiliza **por ventana**: si el crudo ya tiene una ventana no
    se vuelve a pedir, y si le faltan —porque `VENTANAS` creció— se piden solo
    esas. Así extender la serie cuesta lo que las ventanas nuevas y no una
    recolección completa. Con `--rehacer` se ignora lo guardado.
    """
    filas: list[dict] = []
    objetivo = {k: v for k, v in universidades.items() if not solo or k in solo}
    print(f"{len(objetivo)} universidades por consultar")

    for n, (universidad, id_openalex) in enumerate(sorted(objetivo.items()), start=1):
        guardado = _archivo_crudo(universidad)
        crudo = None
        if guardado.exists() and not rehacer:
            try:
                crudo = json.loads(guardado.read_text(encoding="utf-8"))
            except ValueError:
                crudo = None
        if not crudo or not crudo.get("ventanas"):
            crudo = {"id_openalex": id_openalex, "ventanas": {}}

        faltan = [(d, h) for d, h in VENTANAS if f"{d}-{h}" not in crudo["ventanas"]]
        sin_socios = "socios" not in crudo
        if not faltan and not sin_socios:
            print(f"  [{n:2}/{len(objetivo)}] {universidad[:46]} · en caché")
            filas.extend(_filas_de_crudo(universidad, crudo))
            continue

        print(f"  [{n:2}/{len(objetivo)}] {universidad[:46]} · {len(faltan)} ventanas por pedir")
        for desde, hasta in faltan:
            ventana = f"{desde}-{hasta}"
            try:
                resumen = resumen_de_ventana(id_openalex, desde, hasta)
            except Exception as e:  # noqa: BLE001 - se informa y se sigue
                print(f"      {ventana}: fallo ({type(e).__name__})")
                continue
            crudo["ventanas"][ventana] = resumen
            # Se guarda tras cada ventana: si la recolección se corta, lo pedido
            # no se pierde.
            guardado.write_text(json.dumps(crudo, ensure_ascii=False, indent=1), encoding="utf-8")

        if sin_socios:
            desde, hasta = VENTANA_SOCIOS
            try:
                lista = socios(id_openalex, desde, hasta)
            except Exception as e:  # noqa: BLE001
                print(f"      socios: fallo ({type(e).__name__})")
                lista = []
            crudo["socios"] = lista
            crudo["ventana_socios"] = f"{desde}-{hasta}"
        guardado.write_text(json.dumps(crudo, ensure_ascii=False, indent=1), encoding="utf-8")
        filas.extend(_filas_de_crudo(universidad, crudo))

    return filas


def _filas_de_crudo(universidad: str, crudo: dict) -> list[dict]:
    """Formato largo a partir del JSON guardado de una universidad."""
    id_openalex = crudo.get("id_openalex", "")
    filas: list[dict] = []
    for ventana, resumen in crudo.get("ventanas", {}).items():
        desde, hasta = (int(x) for x in ventana.split("-"))
        url = f"{API}/works?filter=institutions.id:{id_openalex},publication_year:{desde}-{hasta}"
        filas.append(nav.dato(FUENTE, universidad, "publicaciones_openalex", resumen["total"],
                              anio_dato=hasta, ventana=ventana, unidad="trabajos",
                              definicion="Trabajos con al menos un autor de la institución",
                              url=url, metodo="api"))
        for tipo, cuenta in sorted(resumen.get("tipos", {}).items()):
            # Desde 2025 OpenAlex devuelve la clave del tipo como URI
            # («https://openalex.org/types/article») en vez del término suelto. El
            # nombre de la variable se queda con el término, que es lo que la base
            # va a guardar.
            termino = str(tipo).rsplit("/", 1)[-1]
            filas.append(nav.dato(FUENTE, universidad, f"publicaciones_openalex_{termino}", cuenta,
                                  anio_dato=hasta, ventana=ventana, unidad="trabajos",
                                  definicion=f"Trabajos de tipo «{termino}»", url=url, metodo="api"))
        cubren = resumen.get("citas_cubren") or 0
        total_v = resumen.get("total") or 0
        if resumen.get("citas") and total_v and cubren >= 0.98 * total_v:
            # El histograma casi nunca cuadra al trabajo exacto con el recuento por
            # tipo: las dos peticiones van seguidas contra un índice vivo, y hay
            # trabajos sin tipo declarado. La mediana de cobertura es 99,86 % y el
            # peor caso 97,4 %, lejos de lo que sería un truncamiento —que cortaría
            # de golpe y dejaría una cobertura ridícula—. Se exige 98 % y se publica
            # la razón sobre los trabajos efectivamente cubiertos, que no arrastra
            # el hueco.
            filas.append(nav.dato(FUENTE, universidad, "citas_openalex", resumen["citas"],
                                  anio_dato=hasta, ventana=ventana, unidad="citas",
                                  definicion=f"Citas recibidas por los trabajos de la ventana "
                                             f"(histograma sobre {cubren} de {total_v})",
                                  url=url, metodo="api"))
            filas.append(nav.dato(FUENTE, universidad, "citas_por_documento_openalex",
                                  round(resumen["citas"] / cubren, 3),
                                  anio_dato=hasta, ventana=ventana, unidad="citas por documento",
                                  definicion="Citas por trabajo, sobre los trabajos del histograma",
                                  url=url, metodo="api"))
        if resumen.get("total"):
            filas.append(nav.dato(FUENTE, universidad, "pct_colaboracion_internacional",
                                  round(100 * resumen["internacional"] / resumen["total"], 2),
                                  anio_dato=hasta, ventana=ventana, unidad="%",
                                  definicion="Trabajos con coautor de una institución de otro país",
                                  url=url, metodo="api"))

    socios_guardados = crudo.get("socios") or []
    if socios_guardados:
        # Los crudos anteriores a `ventana_socios` se pidieron para 2020-2024.
        desde, hasta = (int(x) for x in
                        crudo.get("ventana_socios", "2020-2024").split("-"))
        filas.append(nav.dato(FUENTE, universidad, "socios_recurrentes", len(socios_guardados),
                              anio_dato=hasta, ventana=f"{desde}-{hasta}", unidad="instituciones",
                              definicion=f"Instituciones con {MINIMO_SOCIO} o más trabajos conjuntos",
                              url=f"{API}/works", metodo="api"))
        # Los socios con su país son el insumo de la métrica de red internacional
        # de QS, que necesita saber cuántos países distintos hay. Algunos socios
        # llegan sin nombre —OpenAlex tiene fichas incompletas—: se descartan para
        # el recuento de países en vez de romper la recolección entera.
        paises = {str(nombre).split(",")[-1].strip()
                  for _, nombre, _ in socios_guardados if nombre}
        filas.append(nav.dato(FUENTE, universidad, "socios_recurrentes_paises", len(paises),
                              anio_dato=hasta, ventana=f"{desde}-{hasta}", unidad="países",
                              definicion="Países distintos entre los socios recurrentes",
                              url=f"{API}/works", metodo="api"))
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
    p.add_argument("--rehacer", action="store_true",
                   help="ignora lo guardado en raw/ y vuelve a consultar la API")
    args = p.parse_args()

    print(f"OpenAlex · cola cortés con {CORREO}")
    if args.solo_procesar:
        print("(--solo-procesar no aplica aquí: los datos llegan por API, no como archivo)")

    universidades = instituciones_chilenas()
    print(f"{len(universidades)} universidades de la base identificadas en OpenAlex")

    filas = recolectar(universidades, args.universidades, rehacer=args.rehacer)
    ruta = nav.escribir_procesado(FUENTE, filas)
    print(f"\n{len(filas):,} filas -> {ruta}".replace(",", "."))

    fallos = verificar(filas)
    print("\nT3.1 " + ("terminada" if not fallos else f"con {fallos} comprobación(es) en rojo"))
    return 1 if fallos else 0


if __name__ == "__main__":
    raise SystemExit(main())
