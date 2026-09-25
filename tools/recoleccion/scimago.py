# -*- coding: utf-8 -*-
"""T1.3 — Scimago: series por ventana de las instituciones chilenas.

Scimago no normaliza con una función a invertir: sus indicadores ya son valores
reales (§3.3 del estudio). Lo que falta es la ventana más reciente y el indicador
`excel`, que la base no tiene.

Dónde están los datos, tras probar tres caminos:

  * `scimagoir.com/institution.php?idp=…` ya **no** publica los valores crudos:
    la edición nueva muestra percentiles. Queda documentado en `debug/`.
  * `scimagoir.com/rankings.php?...&out=xls` responde 403 (Cloudflare). Un
    navegador visible lo pasaría, pero eso exige la pantalla del usuario.
  * `scimagoiber.com/institution.php?id=…` —con el parámetro `id`, no `idp`—
    sigue devolviendo el bloque `var data=` con la serie completa de ventanas,
    que es el formato que leía `KAI/Scimago/Scimago_completo.ipynb`. Es el que se
    usa aquí.

Uso:
    python tools/recoleccion/scimago.py              # todas las chilenas
    python tools/recoleccion/scimago.py --ids 1151   # solo la PUCV
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import navegador as nav  # noqa: E402

FUENTE = "scimago"
URL = "https://www.scimagoiber.com/institution.php?id={idp}"
RAIZ = Path(__file__).resolve().parents[2]
# Identificadores y nombres chilenos ya resueltos en el trabajo anterior.
INSTITUCIONES_CHILE = RAIZ / "KAI" / "Scimago" / "SCIMAGO-DATA" / "instituciones_chilenas_limpias.csv"

# Columnas del bloque `var data=` que interesan, con su significado. El resto se
# guarda igualmente en `raw/`, de modo que añadir una variable no exige volver a
# descargar.
INDICADORES = {
    "output": ("publicaciones_scopus", "documentos",
               "Documentos publicados en revistas indizadas en Scopus en la ventana"),
    "excel": ("docs_top10_scimago", "documentos",
              "Documentos en el 10 % más citado de su área (Excellence)"),
    "excel_lider": ("docs_top10_liderados", "documentos",
                    "Documentos del 10 % más citado en los que la institución es líder"),
    "normalized_impact": ("impacto_normalizado", "razón",
                          "Impacto normalizado: citas respecto del promedio mundial de su área"),
    "normalized_impact_leadership": ("impacto_normalizado_liderado", "razón",
                                     "Impacto normalizado de la producción liderada"),
    "colab": ("docs_colaboracion_internacional", "documentos",
              "Documentos con coautoría de otra institución extranjera"),
    "lider": ("docs_liderados", "documentos",
              "Documentos en los que el autor de correspondencia pertenece a la institución"),
    "q1": ("docs_q1", "documentos", "Documentos publicados en revistas del primer cuartil"),
    "ik": ("conocimiento_innovador", "documentos",
           "Producción citada en patentes (Innovative Knowledge)"),
    "patents": ("patentes", "patentes", "Solicitudes de patente de la institución"),
    "open_access": ("pct_acceso_abierto", "%", "Porcentaje de producción en acceso abierto"),
    "stp": ("docs_alta_calidad", "documentos", "Documentos en revistas de alto impacto (STP)"),
    "mendeley": ("lecturas_mendeley", "lecturas", "Lecturas registradas en Mendeley"),
    "female_stp": ("autoras", "autoras", "Autoras en la producción de alta calidad"),
}


def instituciones() -> list[tuple[str, str]]:
    """(idp, nombre) de las instituciones chilenas, del archivo ya depurado."""
    if not INSTITUCIONES_CHILE.exists():
        raise SystemExit(f"Falta {INSTITUCIONES_CHILE}")
    vistas: dict[str, str] = {}
    with INSTITUCIONES_CHILE.open(encoding="utf-8-sig", newline="") as f:
        for fila in csv.DictReader(f):
            vistas.setdefault(fila["idp"].strip(), fila["Institucion"].strip())
    return sorted(vistas.items(), key=lambda x: int(x[0]))


def descargar(ids: list[str]) -> None:
    base = nav.carpeta(FUENTE) / "raw"
    for idp in ids:
        destino = base / f"institucion_{idp}.html"
        ruta = nav.descargar(URL.format(idp=idp), destino, FUENTE, notas=f"idp {idp}")
        print(f"  {idp:>5} {'ok' if ruta else 'sin datos'}")


def _bloque(archivo: Path) -> list[dict] | None:
    """Convierte el `var data=` en filas. Es un CSV con punto y coma dentro de JS."""
    texto = archivo.read_text(encoding="utf-8", errors="replace")
    m = re.search(r'var data\s*=\s*"(.*?)"\s*;', texto, re.S)
    if not m:
        return None
    crudo = m.group(1).encode().decode("unicode_escape")
    lineas = [l for l in crudo.splitlines() if l.strip()]
    if len(lineas) < 2:
        return None
    columnas = lineas[0].split(";")
    filas = []
    for linea in lineas[1:]:
        valores = linea.split(";")
        if len(valores) == len(columnas):
            filas.append(dict(zip(columnas, valores)))
    return filas


def _numero(texto: str) -> float | None:
    try:
        return float(texto)
    except (TypeError, ValueError):
        return None


def procesar(ids: list[str], nombres: dict[str, str]) -> tuple[list[dict], list[str]]:
    base = nav.carpeta(FUENTE) / "raw"
    mapa = nav.mapa_de_nombres()
    filas: list[dict] = []
    sin_nombre: list[str] = []

    for idp in ids:
        archivo = base / f"institucion_{idp}.html"
        if not archivo.exists():
            continue
        bloque = _bloque(archivo)
        if not bloque:
            print(f"  [aviso] {idp}: la página ya no trae el bloque de datos")
            continue

        nombre_fuente = nombres.get(idp, "")
        universidad = mapa.get(nombre_fuente)
        if universidad is None:
            # No se descarta en silencio: se avisa y se deja el nombre de origen,
            # para que un alias que falte se vea en el reporte y no en un hueco.
            sin_nombre.append(f"{idp} · {nombre_fuente}")
            universidad = nombre_fuente

        for registro in bloque:
            ventana = registro.get("years", "")
            anio = ventana.split("-")[-1] if "-" in ventana else ""
            for clave, (variable, unidad, definicion) in INDICADORES.items():
                valor = _numero(registro.get(clave, ""))
                if valor is None:
                    continue
                filas.append(nav.dato(FUENTE, universidad, variable, valor,
                                      anio_dato=anio, ventana=ventana, unidad=unidad,
                                      definicion=definicion, url=URL.format(idp=idp)))
    return filas, sin_nombre


def verificar(filas: list[dict]) -> int:
    """Criterio de término de T1.3."""
    PUCV = "Pontificia Universidad Catolica de Valparaiso"
    fallos = 0

    ventanas = {f["ventana"] for f in filas}
    nueva = "2020-2024"
    con_nueva = {f["universidad"] for f in filas if f["ventana"] == nueva}
    print(f"\n  ventanas obtenidas: {', '.join(sorted(ventanas))}")
    print(f"  instituciones con la ventana {nueva}: {len(con_nueva)}")
    if len(con_nueva) < 50:
        print(f"  [FALLA] se esperaban 50 o más con la ventana {nueva}")
        fallos += 1

    esperado = {"publicaciones_scopus": 5052, "docs_top10_scimago": 616}
    for variable, valor_esperado in esperado.items():
        obtenidos = [f["valor"] for f in filas if f["universidad"] == PUCV
                     and f["variable"] == variable and f["ventana"] == "2019-2023"]
        if not obtenidos:
            print(f"  [FALLA] la PUCV no trae {variable} en 2019-2023")
            fallos += 1
            continue
        ok = obtenidos[0] == valor_esperado
        print(f"  [{'OK ' if ok else 'FALLA'}] PUCV {variable} 2019-2023: "
              f"{obtenidos[0]:.0f} (esperado {valor_esperado})")
        fallos += 0 if ok else 1
    return fallos


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--ids", nargs="*", default=None, help="idp concretos; por defecto, todos")
    p.add_argument("--solo-procesar", action="store_true")
    args = p.parse_args()

    catalogo = dict(instituciones())
    ids = args.ids or list(catalogo)
    print(f"{len(ids)} instituciones chilenas")

    if not args.solo_procesar:
        descargar(ids)

    filas, sin_nombre = procesar(ids, catalogo)
    ruta = nav.escribir_procesado(FUENTE, filas)
    print(f"\n{len(filas):,} filas -> {ruta}".replace(",", "."))
    if sin_nombre:
        print(f"  [aviso] {len(sin_nombre)} instituciones sin alias en la base:")
        for s in sin_nombre[:10]:
            print("     ", s)

    fallos = verificar(filas)
    print("\nT1.3 " + ("terminada" if not fallos else f"con {fallos} comprobación(es) en rojo"))
    return 1 if fallos else 0


if __name__ == "__main__":
    raise SystemExit(main())
