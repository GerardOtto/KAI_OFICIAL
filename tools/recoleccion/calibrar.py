# -*- coding: utf-8 -*-
"""T5.3 — Calibración: qué relación hay entre el valor crudo y el puntaje publicado.

Tres rankings, tres situaciones distintas, y conviene no tratarlas igual:

  * **QS normaliza de forma lineal**, así que la recta `puntaje = a + b·crudo` se
    ajusta con las universidades que tienen ambas cosas y sirve para estimar el
    puntaje de las que no. Los puntajes saturados (90 o más) se excluyen: un
    puntaje en el techo no dice dónde está el valor, solo que pasó el corte.

  * **THE normaliza con una función de probabilidad acumulada**, y eso es una
    hipótesis que aquí se pone a prueba contra la población mundial —3.731
    instituciones—, no se asume. La pregunta decisiva es si el puntaje sigue el
    **rango percentil** del valor crudo o la **normal ajustada** Φ((x−μ)/σ): para
    una variable sesgada las dos dan resultados muy distintos, y de eso depende
    cómo se carguen los valores reales en la plataforma.

  * **Scimago no normaliza nada**: sus valores ya son crudos, así que lo único
    que cabe es verificar que los de la base coincidan con la descarga.

Uso:
    python tools/recoleccion/calibrar.py
    python tools/recoleccion/calibrar.py --parte qs
"""
from __future__ import annotations

import argparse
import csv
import statistics
import sys
from collections import defaultdict
from pathlib import Path
from statistics import NormalDist

sys.path.insert(0, str(Path(__file__).resolve().parent))
import metricas_crudas as mc  # noqa: E402
import navegador as nav  # noqa: E402

SALIDA = nav.RAIZ / "calibracion.csv"

# Puntaje desde el cual QS satura y la universidad deja de servir como ancla.
TECHO = 90.0

# métrica recalculada -> variable con el puntaje que publica QS
ANCLAS_QS = {
    ("QS Latam", "Faculty student ratio"): "qs_puntaje_ratio_academicos_latam",
    ("QS Latam", "Staff with PhD"): "qs_puntaje_academicos_con_doctorado_latam",
    ("QS Latam", "Papers per faculty"): "qs_puntaje_articulos_por_academico_latam",
    ("QS Latam", "Citations per paper"): "qs_puntaje_citas_por_articulo_latam",
    ("QS Latam", "International research network"): "qs_puntaje_red_internacional_latam",
    ("QS Global", "Faculty Student Ratio"): "qs_puntaje_ratio_academicos_global",
    ("QS Global", "Citations per Faculty"): "qs_puntaje_citas_por_academico_global",
    ("QS Global", "International Faculty Ratio"): "qs_puntaje_academicos_internacionales_global",
    ("QS Global", "International Students Ratio"): "qs_puntaje_estudiantes_internacionales_global",
    ("QS Global", "International Research Network"): "qs_puntaje_red_internacional_global",
}

# métrica de la base de Scimago -> variable recolectada
SCIMAGO = {
    "Scientific Output": "publicaciones_scopus",
    "International Collaboration": "docs_colaboracion_internacional",
    "Normalized Impact": "impacto_normalizado",
    "Number of Q1 Articles": "docs_q1",
    "Excellence with Leadership": "docs_top10_liderados",
    "Scientific Leadership": "docs_liderados",
    "Patents": "patentes",
    "Innovative Knowledge": "conocimiento_innovador",
    "Open Access": "pct_acceso_abierto",
    "Female Scientific Pool": "autoras",
    "Mendeley": "lecturas_mendeley",
}


# --------------------------------------------------------------------------- #
#  Estadística mínima, sin dependencias
# --------------------------------------------------------------------------- #
def recta(pares: list[tuple[float, float]]) -> tuple[float, float, float] | None:
    """Mínimos cuadrados de y sobre x. Devuelve (a, b, R²) con y = a + b·x."""
    if len(pares) < 3:
        return None
    xs = [p[0] for p in pares]
    ys = [p[1] for p in pares]
    mx, my = statistics.fmean(xs), statistics.fmean(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx == 0:
        return None
    b = sum((x - mx) * (y - my) for x, y in pares) / sxx
    a = my - b * mx
    syy = sum((y - my) ** 2 for y in ys)
    if syy == 0:
        return None
    residual = sum((y - (a + b * x)) ** 2 for x, y in pares)
    return a, b, 1 - residual / syy


def spearman(pares: list[tuple[float, float]]) -> float | None:
    """Correlación de rangos: resiste que la relación no sea lineal."""
    if len(pares) < 3:
        return None

    def rangos(valores):
        orden = sorted(range(len(valores)), key=lambda i: valores[i])
        r = [0.0] * len(valores)
        i = 0
        while i < len(orden):
            j = i
            while j + 1 < len(orden) and valores[orden[j + 1]] == valores[orden[i]]:
                j += 1
            medio = (i + j) / 2 + 1
            for k in range(i, j + 1):
                r[orden[k]] = medio
            i = j + 1
        return r

    rx = rangos([p[0] for p in pares])
    ry = rangos([p[1] for p in pares])
    resultado = recta(list(zip(rx, ry)))
    if not resultado:
        return None
    _, b, r2 = resultado
    return (r2 ** 0.5) * (1 if b >= 0 else -1)


def percentiles(valores: list[float]) -> dict[float, float]:
    """Rango percentil de cada valor distinto, de 0 a 100."""
    ordenados = sorted(valores)
    n = len(ordenados)
    tabla: dict[float, float] = {}
    for v in set(ordenados):
        # posición media entre los que son menores y los que son menores o iguales
        menores = sum(1 for x in ordenados if x < v)
        iguales = sum(1 for x in ordenados if x == v)
        tabla[v] = 100 * (menores + iguales / 2) / n
    return tabla


# --------------------------------------------------------------------------- #
#  Carga
# --------------------------------------------------------------------------- #
def puntajes_publicados() -> dict:
    """(universidad, variable, anio) -> puntaje, desde el consolidado."""
    ruta = nav.RAIZ / "valores_reales_chile.csv"
    tabla: dict = {}
    with ruta.open(encoding="utf-8-sig", newline="") as f:
        for fila in csv.DictReader(f):
            if not fila["variable"].startswith(("qs_puntaje", "the_puntaje")):
                continue
            try:
                tabla[(fila["universidad"], fila["variable"], int(fila["anio_dato"]))] = \
                    float(fila["valor"])
            except (TypeError, ValueError):
                continue
    return tabla


def mundo_the() -> dict:
    """Los datos mundiales de THE: (institucion, variable, edicion) -> valor."""
    ruta = nav.RAIZ / "the" / "procesado.csv"
    if not ruta.exists():
        return {}
    tabla: dict = {}
    with ruta.open(encoding="utf-8-sig", newline="") as f:
        for fila in csv.DictReader(f):
            try:
                tabla[(fila["universidad"], fila["variable"], int(fila["anio_dato"]))] = \
                    float(fila["valor"])
            except (TypeError, ValueError):
                continue
    return tabla


def cab(t):
    print("\n" + "=" * 78 + f"\n{t}\n" + "=" * 78)


# --------------------------------------------------------------------------- #
#  QS
# --------------------------------------------------------------------------- #
def calibrar_qs(anual, ventana, universidades, publicados, filas_salida) -> None:
    cab("QS · el desfase que mejor alinea, y la recta de cada indicador")

    # 1. ¿Cuántos años de desfase institucional usa QS? Se mide, no se supone.
    #
    # Con una salvedad que cambia el resultado: hay que comparar **la misma
    # muestra** en todos los desfases. Si no, cada desfase se ajusta sobre un
    # conjunto distinto de universidades —las que tienen dato ese año— y el R²
    # sube o baja por la composición de la muestra, no por el alineamiento. El
    # rango llega hasta E-7 a propósito: si el ajuste sigue mejorando en desfases
    # que no tienen sentido editorial, la señal es espuria y hay que decirlo.
    DESFASES_PROBADOS = range(8)
    print("  Desfase institucional, R² sobre una muestra idéntica en todos los desfases:\n")
    print(f"    {'indicador':32} {'n':>4} " + " ".join(f"E-{d}" for d in DESFASES_PROBADOS))
    mejores: dict[tuple[str, str], int] = {}
    for (ranking, metrica), variable in sorted(ANCLAS_QS.items()):
        # pares por desfase, indexados por (universidad, edición) para poder cruzarlos
        por_desfase: dict[int, dict] = {}
        for d in DESFASES_PROBADOS:
            crudas = mc.calcular_ranking(ranking, anual, ventana, universidades,
                                         desfase_inst=d)
            tabla = {}
            for f in crudas:
                if f["metrica"] != metrica:
                    continue
                s = publicados.get((f["universidad"], variable, f["edicion"]))
                if s is None or s >= TECHO:
                    continue
                tabla[(f["universidad"], f["edicion"])] = (f["valor_crudo"], s)
            por_desfase[d] = tabla

        comunes = set.intersection(*(set(t) for t in por_desfase.values())) \
            if all(por_desfase.values()) else set()
        if len(comunes) < 8:
            print(f"    {metrica[:30]:32} {len(comunes):>4}  muestra común insuficiente")
            continue

        linea, puntuacion = [], {}
        for d in DESFASES_PROBADOS:
            r = recta([por_desfase[d][k] for k in sorted(comunes)])
            puntuacion[d] = r[2] if r else -1
            linea.append(f"{r[2]:.2f}" if r else "  · ")
        mejor = max(puntuacion, key=lambda d: puntuacion[d])
        # Si el máximo cae en el borde del rango, el desfase no está identificado:
        # significa que el ajuste todavía mejoraba cuando se acabó lo que se probó.
        borde = mejor == max(DESFASES_PROBADOS)
        if not borde:
            mejores[(ranking, metrica)] = mejor
        marca = f"  <- E-{mejor}" + ("  (en el borde: no identificado)" if borde else "")
        print(f"    {metrica[:30]:32} {len(comunes):>4} " +
              " ".join(f"{x:>4}" for x in linea) + marca)

    if mejores:
        votos = defaultdict(int)
        for d in mejores.values():
            votos[d] += 1
        elegido = max(votos, key=lambda d: votos[d])
        print(f"\n  Desfase más votado entre los identificados: E-{elegido} "
              f"({votos[elegido]} de {len(mejores)})")
    else:
        elegido = mc.DESFASES["QS Latam"]["institucional"]
        print(f"\n  Ningún indicador identifica un desfase dentro del rango probado.")
        print(f"  Se usa E-{elegido} por convención, y queda dicho que no está medido.")

    # 2. La recta por indicador y edición, con el desfase elegido.
    print(f"\n  Recta puntaje = a + b·crudo, con desfase E-{elegido}, "
          f"excluyendo puntajes >= {TECHO:g}:\n")
    print(f"    {'indicador':30} {'ed.':>4} {'n':>3} {'a':>8} {'b':>10} {'R2':>6} "
          f"{'residuo':>8}")
    for (ranking, metrica), variable in sorted(ANCLAS_QS.items()):
        crudas = mc.calcular_ranking(ranking, anual, ventana, universidades,
                                     desfase_inst=elegido)
        por_edicion = defaultdict(list)
        for f in crudas:
            if f["metrica"] != metrica:
                continue
            s = publicados.get((f["universidad"], variable, f["edicion"]))
            if s is None:
                continue
            por_edicion[f["edicion"]].append((f["valor_crudo"], s, f["universidad"]))

        for edicion in sorted(por_edicion):
            todos = por_edicion[edicion]
            anclas = [(x, s) for x, s, _ in todos if s < TECHO]
            r = recta(anclas)
            if not r:
                continue
            a, b, r2 = r
            residuos = [abs(s - (a + b * x)) for x, s in anclas]
            print(f"    {metrica[:28]:30} {edicion:>4} {len(anclas):>3} "
                  f"{a:>8.2f} {b:>10.4g} {r2:>6.2f} {statistics.median(residuos):>8.1f}")
            filas_salida.append({
                "ranking": ranking, "metrica": metrica, "edicion": edicion,
                "modelo": "lineal", "n": len(anclas), "a": round(a, 4),
                "b": round(b, 8), "r2": round(r2, 4),
                "residuo_mediano": round(statistics.median(residuos), 3),
                "saturados_excluidos": sum(1 for _, s, _ in todos if s >= TECHO),
                "nota": f"desfase institucional E-{elegido}",
            })

    # 3. Veredicto. El R² solo no basta para decidir si una recta sirve: hay
    #    indicadores con R² bajo y residuos de medio punto —porque los puntajes se
    #    apiñan cerca del piso— y otros con R² decente y residuos de once puntos.
    #    Lo que importa es cuánto se equivoca la estimación en puntos de puntaje.
    print("\n  ¿Qué recta sirve para estimar? (mediana de las ediciones de cada indicador)\n")
    print(f"    {'indicador':32} {'R2':>5} {'residuo':>8}  veredicto")
    por_metrica = defaultdict(list)
    for f in filas_salida:
        if f["modelo"] == "lineal":
            por_metrica[(f["ranking"], f["metrica"])].append(f)
    for (ranking, metrica), ajustes in sorted(por_metrica.items()):
        r2 = statistics.median(a["r2"] for a in ajustes)
        res = statistics.median(a["residuo_mediano"] for a in ajustes)
        if r2 >= 0.6 and res <= 7:
            veredicto = "sirve"
        elif res <= 2:
            veredicto = ("sirve con reparo: R² bajo porque los puntajes se apiñan, "
                         "pero el error es de un punto")
        elif r2 >= 0.6:
            veredicto = f"no sirve: el error mediano es de {res:.0f} puntos"
        else:
            veredicto = "no sirve: la métrica recalculada no es la que QS mide"
        print(f"    {metrica[:30]:32} {r2:>5.2f} {res:>8.1f}  {veredicto}")


# --------------------------------------------------------------------------- #
#  THE
# --------------------------------------------------------------------------- #
def calibrar_the(filas_salida) -> None:
    cab("THE · ¿el puntaje sigue el rango percentil o la normal ajustada?")

    mundo = mundo_the()
    if not mundo:
        print("  No están los datos mundiales de THE (T1.1). No es verificable.")
        return

    # La única métrica cruda que THE publica para todo el mundo y que además es
    # hoja de un pilar: el porcentaje de estudiantes extranjeros, dentro de
    # International Outlook. Es un tercio del pilar, así que la relación no puede
    # ser perfecta, pero sí debe ser monótona y revelar la forma de la transformación.
    CRUDA = "pct_estudiantes_extranjeros"
    PILAR = "the_puntaje_international_outlook_wur"

    ediciones = sorted({e for (_, v, e) in mundo if v == CRUDA})
    print(f"  Población mundial por edición, métrica «{CRUDA}» contra el pilar "
          f"International Outlook\n")
    print(f"    {'ed.':>4} {'n':>6} {'R2 percentil':>13} {'R2 normal Φ(z)':>15} "
          f"{'gana':>10}")

    ganadores = defaultdict(int)
    for edicion in ediciones:
        crudos = {u: v for (u, var, e), v in mundo.items()
                  if var == CRUDA and e == edicion}
        puntajes = {u: v for (u, var, e), v in mundo.items()
                    if var == PILAR and e == edicion}
        comunes = sorted(set(crudos) & set(puntajes))
        if len(comunes) < 50:
            continue

        valores = [crudos[u] for u in comunes]
        tabla_pct = percentiles(valores)
        mu = statistics.fmean(valores)
        sigma = statistics.pstdev(valores)
        if not sigma:
            continue
        normal = NormalDist()

        pares_pct = [(tabla_pct[crudos[u]], puntajes[u]) for u in comunes]
        pares_z = [(100 * normal.cdf((crudos[u] - mu) / sigma), puntajes[u]) for u in comunes]
        r_pct = recta(pares_pct)
        r_z = recta(pares_z)
        if not (r_pct and r_z):
            continue
        gana = "percentil" if r_pct[2] > r_z[2] else "normal"
        ganadores[gana] += 1
        print(f"    {edicion:>4} {len(comunes):>6} {r_pct[2]:>13.3f} {r_z[2]:>15.3f} "
              f"{gana:>10}")
        filas_salida.append({
            "ranking": "THE Latam", "metrica": "International Students",
            "edicion": edicion, "modelo": f"cdf ({gana})", "n": len(comunes),
            "a": round(r_pct[0], 4), "b": round(r_pct[1], 6),
            "r2": round(max(r_pct[2], r_z[2]), 4), "residuo_mediano": "",
            "saturados_excluidos": 0,
            "nota": f"población mundial; R2 percentil {r_pct[2]:.3f} vs normal {r_z[2]:.3f}",
        })

    if ganadores:
        print(f"\n  Veredicto: el rango percentil gana en {ganadores['percentil']} ediciones, "
              f"la normal ajustada en {ganadores['normal']}.")

    # Segunda prueba, independiente: si cada métrica se normaliza con una función
    # acumulada, su puntaje se reparte uniforme entre 0 y 100. Un pilar es el
    # promedio de varias, así que debe concentrarse hacia el centro. Se mira la
    # forma real.
    print("\n  Forma de la distribución de cada pilar en el mundo (edición más reciente):")
    print("    un puntaje normalizado por CDF sería uniforme: 10 % en cada decil\n")
    ultima = max(ediciones)
    print(f"    {'pilar':32} " + " ".join(f"{d:>4}" for d in range(10)))
    for pilar, hojas in [("the_puntaje_teaching_wur", 5),
                         ("the_puntaje_research_environment_wur", 3),
                         ("the_puntaje_research_quality_wur", 4),
                         ("the_puntaje_international_outlook_wur", 3),
                         ("the_puntaje_industry_wur", 2)]:
        vals = [v for (_, var, e), v in mundo.items() if var == pilar and e == ultima]
        if len(vals) < 50:
            continue
        deciles = [0] * 10
        for v in vals:
            deciles[min(9, int(v // 10))] += 1
        linea = " ".join(f"{100*d/len(vals):>4.0f}" for d in deciles)
        print(f"    {pilar.replace('the_puntaje_', '').replace('_wur', '')[:30]:32} "
              f"{linea}   ({hojas} hojas, n={len(vals)})")
    print("\n    Research Quality es el único casi uniforme, y es el único pilar sin")
    print("    encuesta de reputación entre sus hojas. Teaching y Research Environment,")
    print("    donde la reputación pesa 15 de 29,5 y 18 de 29, se apilan en los deciles")
    print("    bajos. Encaja con lo que THE declara: función acumulada para las métricas")
    print("    normales y «un componente exponencial» para reputación, excelencia,")
    print("    influencia y patentes. Visto desde fuera, las dos mitades se distinguen.")


# --------------------------------------------------------------------------- #
#  Scimago
# --------------------------------------------------------------------------- #
def verificar_scimago(filas_salida) -> None:
    cab("Scimago · la base contra la descarga (no hay nada que invertir)")

    import os
    try:
        from dotenv import load_dotenv
        from sqlalchemy import create_engine, text
    except ImportError:
        print("  Falta sqlalchemy o python-dotenv; se omite la verificación.")
        return

    load_dotenv(Path(__file__).resolve().parents[2] / "backend" / ".env")
    url = os.getenv("DATABASE_URL")
    if not url:
        print("  Sin DATABASE_URL; se omite la verificación.")
        return

    # Lo recolectado, por ventana: el año de la edición es el que cierra la ventana.
    recolectado: dict = {}
    ruta = nav.RAIZ / "scimago" / "procesado.csv"
    with ruta.open(encoding="utf-8-sig", newline="") as f:
        for fila in csv.DictReader(f):
            try:
                recolectado[(fila["universidad"], fila["variable"],
                             int(fila["anio_dato"]))] = float(fila["valor"])
            except (TypeError, ValueError):
                continue

    motor = create_engine(url)
    with motor.connect() as c:
        filas = list(c.execute(text("""
            select u.nombre_universidad, m.nombre_metrica, mu.anio_metrica, mu.valor_metrica
            from metrica_universidad mu
            join metrica m on m.id_metrica = mu.id_metrica
            join ranking r on r.id_ranking = m.id_ranking
            join universidad u on u.id_universidad = mu.id_universidad
            where r.nombre_ranking = 'Scimago Latam'""")))

    print(f"  {len(filas)} valores de Scimago en la base\n")
    print(f"    {'métrica':32} {'pares':>6} {'iguales':>8} {'desvío mediano':>15}")
    for nombre_bd, variable in sorted(SCIMAGO.items()):
        pares = []
        for universidad, metrica, anio, valor in filas:
            if metrica != nombre_bd or valor is None:
                continue
            mio = recolectado.get((universidad, variable, anio))
            if mio is None:
                continue
            pares.append((float(valor), mio))
        if not pares:
            print(f"    {nombre_bd[:30]:32} {'—':>6}   sin pares comparables")
            continue
        iguales = sum(1 for a, b in pares if a == b or (b and abs(a - b) / abs(b) < 0.001))
        desvios = [abs(a - b) / abs(b) for a, b in pares if b]
        mediano = 100 * statistics.median(desvios) if desvios else 0
        print(f"    {nombre_bd[:30]:32} {len(pares):>6} {iguales:>8} {mediano:>14.2f}%")
        filas_salida.append({
            "ranking": "Scimago Latam", "metrica": nombre_bd, "edicion": "todas",
            "modelo": "identidad", "n": len(pares), "a": 0, "b": 1,
            "r2": "", "residuo_mediano": round(mediano, 3),
            "saturados_excluidos": 0,
            "nota": f"{iguales} de {len(pares)} coinciden dentro del 0,1 %",
        })


# --------------------------------------------------------------------------- #
def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--parte", choices=["qs", "the", "scimago"],
                   help="ejecutar solo una parte")
    args = p.parse_args()

    anual, ventana, universidades = mc.cargar()
    publicados = puntajes_publicados()
    filas_salida: list[dict] = []

    if args.parte in (None, "qs"):
        calibrar_qs(anual, ventana, universidades, publicados, filas_salida)
    if args.parte in (None, "the"):
        calibrar_the(filas_salida)
    if args.parte in (None, "scimago"):
        verificar_scimago(filas_salida)

    if filas_salida:
        campos = ["ranking", "metrica", "edicion", "modelo", "n", "a", "b", "r2",
                  "residuo_mediano", "saturados_excluidos", "nota"]
        with SALIDA.open("w", encoding="utf-8-sig", newline="") as f:
            escritor = csv.DictWriter(f, fieldnames=campos, extrasaction="ignore")
            escritor.writeheader()
            escritor.writerows(filas_salida)
        print(f"\n{len(filas_salida)} ajustes -> {SALIDA.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
