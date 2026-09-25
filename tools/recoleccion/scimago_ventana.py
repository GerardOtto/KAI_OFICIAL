# -*- coding: utf-8 -*-
"""T1.3 (segunda parte) — la ventana nueva de Scimago, por su exportación oficial.

`scimagoiber.com` solo llega hasta la ventana 2019-2023. La edición nueva vive en
`scimagoir.com`, cuya página de rankings está tras Cloudflare: un cliente HTTP
recibe 403, pero un navegador **visible** pasa la comprobación en unos segundos.

El patrón es el del scraper de Scopus y el que el plan describe como método C:
se abre el navegador, se deja que resuelva el desafío, se copian sus cookies a una
sesión de `requests` y a partir de ahí se descarga por HTTP, que es mucho más
rápido y no depende de la ventana.

La exportación oficial está en `getdata.php`, con `year` como edición. Cada edición
cubre la ventana de cinco años que termina dos antes: la de 2026 corresponde a
2020-2024.

Uso:
    python tools/recoleccion/scimago_ventana.py            # última edición
    python tools/recoleccion/scimago_ventana.py --anios 2026 2025
"""
from __future__ import annotations

import argparse
import csv
import io
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import navegador as nav  # noqa: E402

FUENTE = "scimago"
PORTADA = "https://www.scimagoir.com/rankings.php?country=CHL"
EXPORTA = ("https://www.scimagoir.com/getdata.php?ranking=Overall&area=&sector="
           "&country=CHL&year={anio}&top=0&format=csv&type=download")

# La edición N informa la ventana de cinco años que termina en N-2.
def ventana_de(anio: int) -> str:
    return f"{anio - 6}-{anio - 2}"


# Qué trae realmente la exportación, comprobado sobre la edición 2026:
#
#     Rank; Global Rank; Institution; Country; Sector; Best Country Quartile
#
# **No trae los indicadores.** Ni output, ni excellence, ni impacto normalizado:
# SCImago dejó de publicar los valores crudos y ahora su sitio muestra solo
# percentiles y posiciones. Lo que se puede recolectar de la ventana nueva son las
# posiciones; los valores de la serie histórica siguen viniendo de scimagoiber
# (`scimago.py`), que llega hasta 2019-2023.
#
# Se mapea lo que hay, y si algún día vuelven los indicadores basta añadirlos aquí:
# el guion los recogerá sin más cambios.
COLUMNAS = {
    "rank": ("scimago_posicion_nacional", "posición",
             "Posición entre las instituciones chilenas del ranking Scimago"),
    "global rank": ("scimago_posicion_mundial", "posición",
                    "Posición mundial en el ranking Scimago"),
    "best country quartile": ("scimago_mejor_cuartil", "cuartil",
                              "Mejor cuartil alcanzado por la institución en el país"),
    # Por si vuelven a publicarse:
    "output": ("publicaciones_scopus", "documentos",
               "Documentos en revistas indizadas en Scopus en la ventana"),
    "excellence": ("docs_top10_scimago", "documentos",
                   "Documentos en el 10 % más citado de su área"),
    "normalized impact": ("impacto_normalizado", "razón",
                          "Citas respecto del promedio mundial de su área"),
    "international collaboration": ("pct_colaboracion_internacional", "%",
                                    "Producción con coautoría extranjera"),
}


def sesion_con_cookies(mostrar: bool = True):
    """Abre el navegador, deja que pase Cloudflare y devuelve una sesión con sus cookies."""
    driver = nav.crear_driver(headless=not mostrar, capturar_red=False)
    try:
        driver.set_page_load_timeout(120)
        driver.get(PORTADA)
        for _ in range(24):
            time.sleep(5)
            if len(driver.find_elements("css selector", "table tr")) > 10:
                break
        else:
            nav.guardar_debug(driver, FUENTE, "cloudflare_sin_pasar")
            raise SystemExit("El desafío de Cloudflare no se resolvió; hay evidencia en debug/.")
        return nav.cookies_a_session(driver)
    finally:
        driver.quit()


def procesar(anios: list[int]) -> list[dict]:
    base = nav.carpeta(FUENTE) / "raw"
    resolver = nav.resolvedor()
    filas: list[dict] = []
    sin_alias: set[str] = set()

    for anio in anios:
        archivo = base / f"ranking_chile_{anio}.csv"
        if not archivo.exists():
            continue
        texto = archivo.read_text(encoding="utf-8-sig", errors="replace")
        lector = csv.DictReader(io.StringIO(texto), delimiter=";")
        columnas = {(c or "").strip().lower(): c for c in (lector.fieldnames or [])}

        for registro in lector:
            # El asterisco que Scimago añade a algunas instituciones marca que
            # están acreditadas; no forma parte del nombre.
            columna_nombre = columnas.get("institution") or columnas.get("name")
            nombre = (registro.get(columna_nombre, "") or "").strip().rstrip("*").strip()
            universidad = resolver(nombre)
            if universidad is None:
                sin_alias.add(nombre)
                continue
            for etiqueta, (variable, unidad, definicion) in COLUMNAS.items():
                original = columnas.get(etiqueta)
                if original is None:
                    continue
                crudo = (registro.get(original) or "").replace(",", ".").strip()
                try:
                    valor = float(crudo)
                except ValueError:
                    continue
                filas.append(nav.dato(FUENTE, universidad, variable, valor,
                                      anio_dato=anio - 2, ventana=ventana_de(anio),
                                      unidad=unidad, definicion=definicion,
                                      url=EXPORTA.format(anio=anio),
                                      metodo="selenium_cdp + requests"))
    if sin_alias:
        print(f"  [aviso] sin alias: {sorted(sin_alias)[:6]}")
    return filas


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--anios", nargs="*", type=int, default=[2026])
    p.add_argument("--solo-procesar", action="store_true")
    p.add_argument("--oculto", action="store_true",
                   help="intenta sin ventana visible (Cloudflare suele rechazarlo)")
    args = p.parse_args()

    base = nav.carpeta(FUENTE) / "raw"
    if not args.solo_procesar:
        faltan = [a for a in args.anios if not (base / f"ranking_chile_{a}.csv").exists()]
        if faltan:
            print("Abriendo el navegador para pasar la comprobación de Cloudflare…")
            sesion = sesion_con_cookies(mostrar=not args.oculto)
            for anio in faltan:
                destino = base / f"ranking_chile_{anio}.csv"
                ruta = nav.descargar(EXPORTA.format(anio=anio), destino, FUENTE,
                                     session=sesion, notas=f"edición {anio}, ventana {ventana_de(anio)}")
                print(f"  {anio}: {'ok' if ruta else 'sin datos'}")

    filas = procesar(args.anios)
    if not filas:
        print("\nSin datos nuevos que añadir.")
        return 1

    # Se escribe aparte y la consolidación juntará ambos archivos: el histórico
    # viene de scimagoiber y este, de la exportación de scimagoir.
    ruta = nav.escribir_procesado(FUENTE, filas, "procesado_ventana_nueva.csv")
    ventanas = sorted({f["ventana"] for f in filas})
    universidades = {f["universidad"] for f in filas}
    print(f"\n{len(filas)} filas · {len(universidades)} universidades · ventanas {ventanas}")
    print(f"-> {ruta}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
