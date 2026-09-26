# -*- coding: utf-8 -*-
"""Carga en la base los valores medidos de THE y QS que produjo la reversión.

`metricas_crudas.py` recalcula cada métrica de THE Latam, QS Latam y QS Global con
la fórmula que publica su ranking, sobre datos del SIES, la ANID, OpenAlex y
SCImago. Este guion lleva esos valores a `valor_real_universidad` (migración
008), que es lo que muestra el modo numérico de la pantalla de ranking.

Tres reglas:

  * **Solo ediciones publicadas.** Los insumos de una edición futura suelen estar
    disponibles antes que la edición —la 2027 de THE se arma con el SIES 2024—,
    pero mostrar «THE 2027» sería mostrar un ranking que no existe. Se cargan
    únicamente las ediciones que el ranking ya tiene en `metrica_universidad`.

  * **La calidad viaja con el valor.** `directa` si la definición y la fuente
    coinciden con las del ranking, `aproximada` si la definición coincide pero el
    universo de datos no (OpenAlex por Scopus), `parcial` si solo capta una parte
    (los fondos ANID frente al ingreso de investigación total). La interfaz la
    usa para advertir valor por valor.

  * **No toca el Ranking KAI.** Borra y vuelve a escribir solo las filas de las
    métricas de THE y QS; las del Ranking KAI las administra su propio cargador.

Uso:
    python tools/recoleccion/cargar_valores_reales.py              # resume sin tocar la base
    python tools/recoleccion/cargar_valores_reales.py --escribir
    python tools/recoleccion/cargar_valores_reales.py --url postgresql://... --escribir
"""
from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import navegador as nav  # noqa: E402

RAIZ_REPO = Path(__file__).resolve().parents[2]
ENTRADA = nav.RAIZ / "metricas_crudas_chile.csv"
RANKINGS = ("THE Latam", "QS Latam", "QS Global")
CALIDADES = {"directa", "aproximada", "parcial"}


def leer() -> list[dict]:
    if not ENTRADA.exists():
        raise SystemExit(f"Falta {ENTRADA}. Ejecuta antes metricas_crudas.py.")
    with ENTRADA.open(encoding="utf-8-sig", newline="") as f:
        filas = [r for r in csv.DictReader(f) if r["ranking"] in RANKINGS]
    raras = {r["estado"] for r in filas} - CALIDADES
    if raras:
        raise SystemExit(f"Calidades desconocidas en {ENTRADA.name}: {raras}")
    return filas


def _url(args) -> str:
    if args.url:
        return args.url
    from dotenv import dotenv_values
    url = dotenv_values(RAIZ_REPO / "backend" / ".env").get("DATABASE_URL")
    if not url:
        raise SystemExit("Sin DATABASE_URL en backend/.env; pásala con --url.")
    return url


def preparar(conexion, filas: list[dict]) -> tuple[list[dict], Counter]:
    """Resuelve identificadores y descarta lo que no debe cargarse, contando por qué."""
    from sqlalchemy import text
    metricas = {(r[0], r[1]): r[2] for r in conexion.execute(text("""
        SELECT r.nombre_ranking, m.nombre_metrica, m.id_metrica
        FROM metrica m JOIN ranking r ON r.id_ranking = m.id_ranking
        WHERE r.nombre_ranking = ANY(:rk)"""), {"rk": list(RANKINGS)})}
    universidades = {r[1]: r[0] for r in conexion.execute(text(
        "SELECT id_universidad, nombre_universidad FROM universidad"))}
    publicadas = defaultdict(set)
    for nombre, anio in conexion.execute(text("""
            SELECT DISTINCT r.nombre_ranking, mu.anio_metrica
            FROM metrica_universidad mu
            JOIN metrica m ON m.id_metrica = mu.id_metrica
            JOIN ranking r ON r.id_ranking = m.id_ranking
            WHERE r.nombre_ranking = ANY(:rk)"""), {"rk": list(RANKINGS)}):
        publicadas[nombre].add(anio)

    descartes: Counter = Counter()
    listas: list[dict] = []
    for f in filas:
        id_m = metricas.get((f["ranking"], f["metrica"]))
        id_u = universidades.get(f["universidad"])
        edicion = int(f["edicion"])
        if id_m is None:
            descartes[f"métrica sin fila en la base: {f['ranking']} · {f['metrica']}"] += 1
        elif id_u is None:
            descartes[f"universidad fuera del catálogo: {f['universidad']}"] += 1
        elif edicion not in publicadas[f["ranking"]]:
            descartes[f"{f['ranking']} {edicion}: la base no tiene puntajes de esa edición"] += 1
        else:
            listas.append({"m": id_m, "u": id_u, "a": edicion, "v": float(f["valor_crudo"]),
                           "un": f["unidad"], "ca": f["estado"], "fo": f["formula"],
                           "ao": f["anios_usados"], "fu": f.get("fuentes") or "—"})
    # Si metricas_crudas cambiara de nombres sin que la base lo supiera, no debe
    # pasar inadvertido: una métrica entera sin fila es un error, no un descarte.
    sin_fila = [k for k in descartes if k.startswith("métrica sin fila")]
    if sin_fila:
        raise SystemExit("Métricas de metricas_crudas_chile.csv que la base no tiene:\n  "
                         + "\n  ".join(sin_fila))
    return listas, descartes


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--escribir", action="store_true", help="reemplaza en la base los valores de THE y QS")
    p.add_argument("--url", help="base de destino (por defecto, la de backend/.env)")
    args = p.parse_args()

    from sqlalchemy import create_engine, text
    filas = leer()
    motor = create_engine(_url(args))
    with motor.begin() as c:
        listas, descartes = preparar(c, filas)

        por_ranking = Counter()
        por_calidad = Counter()
        ids_por_ranking = defaultdict(set)
        for f in listas:
            por_calidad[f["ca"]] += 1
        nombres = {r[0]: r[1] for r in c.execute(text(
            "SELECT m.id_metrica, r.nombre_ranking FROM metrica m JOIN ranking r USING (id_ranking)"))}
        for f in listas:
            por_ranking[nombres[f["m"]]] += 1
            ids_por_ranking[nombres[f["m"]]].add(f["a"])

        print(f"{len(filas):,} valores recalculados en {ENTRADA.name}".replace(",", "."))
        for rk in RANKINGS:
            anios = sorted(ids_por_ranking[rk])
            rango = f"{anios[0]}-{anios[-1]}" if anios else "—"
            print(f"  {rk:10} {por_ranking[rk]:>6,} por cargar · ediciones {rango}".replace(",", "."))
        print("  calidad: " + ", ".join(f"{k} {v:,}".replace(",", ".") for k, v in por_calidad.most_common()))
        if descartes:
            print("  descartados:")
            for motivo, n in sorted(descartes.items()):
                print(f"    {n:>5}  {motivo}")

        if not args.escribir:
            print("\n  (no se tocó ninguna base; usa --escribir para cargar)")
            return 0

        ids = list({f["m"] for f in listas} | {
            r[0] for r in c.execute(text("""
                SELECT m.id_metrica FROM metrica m JOIN ranking r USING (id_ranking)
                WHERE r.nombre_ranking = ANY(:rk)"""), {"rk": list(RANKINGS)})})
        c.execute(text("DELETE FROM valor_real_universidad WHERE id_metrica = ANY(:ids)"), {"ids": ids})
        c.execute(text("""INSERT INTO valor_real_universidad
                          (id_metrica, id_universidad, anio_edicion, valor, unidad, calidad,
                           formula, anios_origen, fuentes)
                          VALUES (:m, :u, :a, :v, :un, :ca, :fo, :ao, :fu)"""), listas)
        print(f"\n  cargados {len(listas):,} valores de THE y QS".replace(",", "."))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
