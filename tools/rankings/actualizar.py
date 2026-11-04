# -*- coding: utf-8 -*-
"""Revisa las fuentes oficiales y escribe las instantáneas de las ediciones nuevas.

No toca la base: solo escribe `datos/rankings/<ranking>/<edición>.csv` (y su
`.json`), que después se revisan en un PR y se cargan con `cargar.py`.

    python tools/rankings/actualizar.py                        # la revisión mensual
    python tools/rankings/actualizar.py shanghai-arwu 2018 2026  # ediciones concretas
    python tools/rankings/actualizar.py --todas                # rehace todas (regresión)
    python tools/rankings/actualizar.py --informe informe.md   # deja el informe en un archivo

Qué hace la revisión mensual con cada fuente:

  THE Latam, ARWU, GRAS  Pregunta a la fuente por las ediciones posteriores a la
                         última guardada y descarga las que existan.
  QS Latam, QS Global    Convierte las planillas oficiales que estén en
                         KAI/QS/DatosQS y no tengan instantánea. QS no se puede
                         consultar en línea (Cloudflare): si por el calendario ya
                         debió salir una edición y no está su planilla, lo avisa.
  Scimago                Avisa cuando scimagoiber.com publique la ventana de la
                         edición siguiente a la cargada.

Termina con código 1 si alguna fuente falló o entregó algo incoherente: el flujo
mensual lo convierte en un aviso, en vez de un PR con datos dudosos.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import comun  # noqa: E402
from comun import ErrorDeFuente, ediciones_guardadas, escribir_instantanea  # noqa: E402
from fuentes import qs, scimago, shanghai, the  # noqa: E402
import verificar  # noqa: E402

AUTOMATICAS = ("the-latam", "shanghai-arwu", "shanghai-gras")
PRIMERA = {"the-latam": the.PRIMERA, "shanghai-arwu": shanghai.PRIMERA_ARWU,
           "shanghai-gras": shanghai.PRIMERA_GRAS}

# Mes en que QS suele publicar cada edición, y cuántos años adelanta su nombre: la
# edición 2027 de QS World salió en junio de 2026, la de Latam en octubre de 2026.
CALENDARIO_QS = {"qs-latam": (10, 1), "qs-global": (6, 1)}


def obtener(clave: str, edicion: int):
    if clave == "the-latam":
        return the.latam(edicion)
    if clave == "shanghai-arwu":
        return shanghai.arwu(edicion)
    if clave == "shanghai-gras":
        return shanghai.gras(edicion)
    if clave in qs.CARPETAS:
        return qs.leer(clave, edicion)
    raise SystemExit(f"Ranking desconocido: {clave}")


def existe(clave: str, edicion: int) -> bool:
    if clave == "the-latam":
        return the.existe(edicion)
    return shanghai.existe(clave, edicion)


def guardar(clave: str, edicion: int, informe: dict) -> None:
    import requests

    try:
        filas, meta = obtener(clave, edicion)
        problemas = verificar.instantanea(clave, edicion, filas)
        if problemas:
            raise ErrorDeFuente("; ".join(problemas))
    # Una fuente caída o que devuelve algo ilegible se informa y la revisión sigue
    # con las demás; un error de programación, en cambio, se deja ver entero.
    except (ErrorDeFuente, requests.RequestException, ValueError) as e:
        informe["errores"].append(f"{comun.RANKINGS[clave]} {edicion}: {e}")
        print(f"  [FALLA] {clave} {edicion}: {e}")
        return
    anterior = comun.ruta_instantanea(clave, edicion)
    previo = anterior.read_text(encoding="utf-8") if anterior.exists() else None
    ruta = escribir_instantanea(clave, edicion, filas, meta)
    universidades = len({(f.disciplina, f.universidad) for f in filas})
    estado = ("nueva" if previo is None else
              "sin cambios" if previo == ruta.read_text(encoding="utf-8") else "cambió")
    if estado == "nueva":
        informe["nuevas"].append(f"{comun.RANKINGS[clave]} {edicion}: {universidades} universidades "
                                 f"chilenas, {len(filas)} cifras")
    elif estado == "cambió":
        informe["cambios"].append(f"{comun.RANKINGS[clave]} {edicion}: la fuente corrigió la edición")
    print(f"  {clave} {edicion}: {estado} ({universidades} universidades, {len(filas)} cifras)")


def revisar(informe: dict, hoy: date) -> None:
    for clave in AUTOMATICAS:
        guardadas = ediciones_guardadas(clave)
        ultima = max(guardadas) if guardadas else PRIMERA[clave] - 1
        # Hasta el año próximo: varias fuentes nombran la edición por el año
        # siguiente al de su publicación.
        for edicion in range(ultima + 1, hoy.year + 2):
            try:
                hay = existe(clave, edicion)
            except Exception as e:  # noqa: BLE001 - una fuente caída no detiene a las demás
                informe["errores"].append(f"{comun.RANKINGS[clave]}: no se pudo consultar ({e})")
                break
            if hay:
                guardar(clave, edicion, informe)
        informe["al_dia"].append(f"{comun.RANKINGS[clave]}: última edición {max(ediciones_guardadas(clave) or [0])}")

    for clave, (mes, adelanto) in CALENDARIO_QS.items():
        disponibles = qs.planillas(clave)
        for edicion in sorted(set(disponibles) - set(ediciones_guardadas(clave))):
            guardar(clave, edicion, informe)
        esperada = hoy.year + adelanto if hoy.month >= mes else hoy.year + adelanto - 1
        if esperada not in disponibles:
            informe["accion"].append(
                f"{comun.RANKINGS[clave]} {esperada}: por el calendario de QS ya debió publicarse, y su "
                f"planilla oficial no está en {qs.CARPETAS[clave].relative_to(comun.RAIZ)}. QS no se puede "
                f"descargar de forma automática: bájala de QS y déjala en esa carpeta con el año al comienzo "
                f"del nombre.")
        else:
            informe["al_dia"].append(f"{comun.RANKINGS[clave]}: última planilla {max(disponibles)}")

    try:
        con_cifras = scimago.ultima_edicion_con_cifras()
    except Exception as e:  # noqa: BLE001
        con_cifras = None
        informe["errores"].append(f"Scimago: no se pudo consultar scimagoiber.com ({e})")
    if con_cifras and con_cifras > scimago.CARGADA:
        informe["accion"].append(
            f"Scimago {con_cifras}: scimagoiber.com ya publica sus cifras. Cárgala con "
            f"tools/recoleccion/scimago.py y la migración de percentiles (ver tools/rankings/README.md).")
    elif con_cifras:
        informe["al_dia"].append(f"Scimago: sin cifras nuevas (la última con cifras es {con_cifras})")


def escribir_informe(informe: dict, ruta: Path | None) -> str:
    partes = ["## Revisión de rankings", ""]
    for clave, titulo in (("nuevas", "Ediciones nuevas"), ("cambios", "Ediciones corregidas por la fuente"),
                          ("accion", "Requiere acción"), ("errores", "Errores"), ("al_dia", "Estado")):
        if informe[clave]:
            partes += [f"### {titulo}", ""] + [f"- {x}" for x in informe[clave]] + [""]
    texto = "\n".join(partes)
    if ruta:
        ruta.write_text(texto, encoding="utf-8")
        ruta.with_suffix(".json").write_text(json.dumps(informe, ensure_ascii=False, indent=2), encoding="utf-8")
    return texto


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("ranking", nargs="?", choices=sorted(comun.RANKINGS))
    p.add_argument("ediciones", nargs="*", type=int)
    p.add_argument("--todas", action="store_true", help="rehace todas las ediciones de las fuentes")
    p.add_argument("--informe", type=Path)
    args = p.parse_args()

    informe = {"nuevas": [], "cambios": [], "accion": [], "errores": [], "al_dia": []}
    if args.ranking:
        for edicion in args.ediciones or ediciones_guardadas(args.ranking):
            guardar(args.ranking, edicion, informe)
    elif args.todas:
        for clave in AUTOMATICAS:
            for edicion in range(PRIMERA[clave], date.today().year + 1):
                if clave == "the-latam" and edicion in the.SIN_EDICION:
                    continue
                if existe(clave, edicion):
                    guardar(clave, edicion, informe)
        for clave in CALENDARIO_QS:
            for edicion in qs.planillas(clave):
                guardar(clave, edicion, informe)
    else:
        revisar(informe, date.today())

    print("\n" + escribir_informe(informe, args.informe))
    return 1 if informe["errores"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
