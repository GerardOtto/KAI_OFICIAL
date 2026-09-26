# -*- coding: utf-8 -*-
"""Calcula el Ranking KAI y lo carga en la base.

El Ranking KAI es el índice propio de la plataforma: diez métricas medidas en
fuentes oficiales —SIES, ANID— y bibliométricas abiertas —OpenAlex—, cada una
convertida en un percentil y promediadas con pesos que el usuario puede cambiar.
La definición del ranking en la base está en `backend/migraciones/009_ranking_kai.sql`;
este guion es la única fuente de las **fórmulas**.

Por cada universidad elegible, año y métrica escribe dos filas con la misma clave:

    metrica_universidad      el percentil, de 0 a 100 — lo que ven ranking,
                             tendencias, simulación y asistente
    valor_real_universidad   el valor medido, con su unidad, fórmula y fuentes

Tres reglas que conviene tener a la vista:

  * **Percentil.** El puntaje es la proporción de las DEMÁS universidades
    elegibles de ese año a las que la universidad supera: 100 · (superadas) / (n − 1).
    Los empates reciben el mismo puntaje, y todas las empatadas en el fondo —por
    ejemplo, las que no otorgan doctorados— reciben 0. En «Estudiantes por
    académico» superar es tener menos.

  * **La ausencia es cero donde la fuente solo publica lo que existe.** El SIES
    no publica una fila de «académicos extranjeros» si no hay ninguno, ni la ANID
    una de fondos si no se adjudicó nada. En esas variables, la falta de dato es
    un cero. En las demás —matrícula, jornadas, publicaciones— la falta de dato
    deja a la universidad fuera del año, porque rellenarla sería inventar.

  * **Elegibilidad.** Datos del SIES en el año, al menos 1.000 estudiantes y 20
    académicos JCE, y registro en OpenAlex. Con denominadores más chicos una sola
    persona mueve un porcentaje varios puntos, y las universidades en cierre
    —que titulan a sus últimas cohortes con casi nadie matriculado— producirían
    razones absurdas.

Uso:
    python tools/recoleccion/cargar_ranking_kai.py                  # calcula y resume
    python tools/recoleccion/cargar_ranking_kai.py --escribir       # además carga en la base
    python tools/recoleccion/cargar_ranking_kai.py --url postgresql://...  --escribir
    python tools/recoleccion/cargar_ranking_kai.py --sql ranking_kai.sql   # SQL para aplicar a mano
"""
from __future__ import annotations

import argparse
import csv
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

sys.path.insert(0, str(Path(__file__).resolve().parent))
import navegador as nav  # noqa: E402

RAIZ_REPO = Path(__file__).resolve().parents[2]
NOMBRE_RANKING = "Ranking KAI"
SALIDA_CSV = nav.RAIZ / "ranking_kai.csv"

ANIO_DESDE, ANIO_HASTA = 2017, 2025

# Elegibilidad: por debajo de esto, una persona mueve un porcentaje varios puntos.
MIN_ESTUDIANTES = 1000
MIN_JCE = 20

# Variables en las que la fuente solo publica lo que existe: su ausencia es cero.
CERO_SI_FALTA = {
    "academicos_jce_doctorado", "academicos_jce_extranjeros", "graduados_doctorado",
    "estudiantes_posgrado", "montos_anid_adjudicados", "montos_anid_con_industria",
}


@dataclass(frozen=True)
class MetricaKai:
    nombre: str          # exactamente como en la migración 009
    unidad: str
    sentido: str         # 'mayor' | 'menor'
    formula: str
    fuentes: str
    calcular: Callable   # (Contexto) -> float
    # Flujo anual —algo que ocurre en el año, como adjudicar fondos o titular
    # doctores— y no un stock. Los flujos se promedian en tres años: una cohorte
    # que se titula de una vez, o un centro plurianual adjudicado en un solo
    # fallo, harían saltar a una universidad un año y caer al siguiente.
    trienal: bool = False


class Contexto:
    """Acceso a los datos de una universidad en un año, con las reglas de arriba."""

    def __init__(self, anual: dict, ventana: dict, universidad: str, anio: int):
        self.anual, self.ventana = anual, ventana
        self.u, self.anio = universidad, anio

    def sies(self, variable: str, anio: int | None = None) -> float | None:
        valor = self.anual.get((self.u, variable), {}).get(self.anio if anio is None else anio)
        if valor is None and variable in CERO_SI_FALTA:
            return 0.0
        return valor

    def bib(self, variable: str) -> float | None:
        clave = f"{self.anio - 4}-{self.anio}"
        return self.ventana.get((self.u, variable), {}).get(clave)

    def trienio(self, variable: str) -> float:
        """Promedio anual de los tres últimos años, contando como cero el que falte."""
        return sum(self.sies(variable, a) or 0.0 for a in range(self.anio - 2, self.anio + 1)) / 3

    @property
    def jce(self) -> float:
        return self.sies("academicos_jce") or 0.0


def _pubs(c: Contexto) -> float:
    return c.bib("publicaciones_openalex") or 0.0


METRICAS: list[MetricaKai] = [
    MetricaKai("Estudiantes por académico", "estudiantes por académico JCE", "menor",
               "estudiantes_total / academicos_jce", "SIES",
               lambda c: c.sies("estudiantes_total") / c.jce),
    MetricaKai("Académicos con doctorado", "% de las jornadas académicas", "mayor",
               "100 · academicos_jce_doctorado / academicos_jce", "SIES",
               lambda c: 100 * c.sies("academicos_jce_doctorado") / c.jce),
    MetricaKai("Doctorados otorgados", "graduados de doctorado por 100 académicos JCE al año", "mayor",
               "100 · promedio(graduados_doctorado, 3 años) / academicos_jce", "SIES",
               lambda c: 100 * c.trienio("graduados_doctorado") / c.jce, trienal=True),
    MetricaKai("Matrícula de posgrado", "% de la matrícula", "mayor",
               "100 · estudiantes_posgrado / estudiantes_total", "SIES",
               lambda c: 100 * c.sies("estudiantes_posgrado") / c.sies("estudiantes_total")),
    MetricaKai("Productividad científica", "publicaciones por académico JCE al año", "mayor",
               "publicaciones_openalex(ventana de 5 años) / 5 / academicos_jce", "OpenAlex, SIES",
               lambda c: _pubs(c) / 5 / c.jce),
    MetricaKai("Citas por publicación", "citas por publicación", "mayor",
               "citas_por_documento_openalex(ventana de 5 años)", "OpenAlex",
               lambda c: (c.bib("citas_por_documento_openalex") or 0.0) if _pubs(c) else 0.0),
    MetricaKai("Colaboración internacional", "% de las publicaciones", "mayor",
               "pct_colaboracion_internacional(ventana de 5 años)", "OpenAlex",
               lambda c: (c.bib("pct_colaboracion_internacional") or 0.0) if _pubs(c) else 0.0),
    MetricaKai("Fondos de investigación", "pesos por académico JCE al año", "mayor",
               "promedio(montos_anid_adjudicados, 3 años) / academicos_jce", "ANID, SIES",
               lambda c: c.trienio("montos_anid_adjudicados") / c.jce, trienal=True),
    MetricaKai("Fondos con la industria", "pesos por académico JCE al año", "mayor",
               "promedio(montos_anid_con_industria, 3 años) / academicos_jce", "ANID, SIES",
               lambda c: c.trienio("montos_anid_con_industria") / c.jce, trienal=True),
    MetricaKai("Académicos extranjeros", "% de las jornadas académicas", "mayor",
               "100 · academicos_jce_extranjeros / academicos_jce", "SIES",
               lambda c: 100 * c.sies("academicos_jce_extranjeros") / c.jce),
]


# --------------------------------------------------------------------------- #
def cargar_consolidado() -> tuple[dict, dict]:
    ruta = nav.RAIZ / "valores_reales_chile.csv"
    if not ruta.exists():
        raise SystemExit(f"Falta {ruta}. Ejecuta antes consolidar.py.")
    anual: dict = defaultdict(dict)
    ventana: dict = defaultdict(dict)
    with ruta.open(encoding="utf-8-sig", newline="") as f:
        for fila in csv.DictReader(f):
            if fila["fuente"] not in ("sies", "anid", "openalex"):
                continue
            try:
                valor = float(fila["valor"])
            except (TypeError, ValueError):
                continue
            clave = (fila["universidad"], fila["variable"])
            if fila.get("ventana"):
                ventana[clave][fila["ventana"]] = valor
            else:
                anual[clave][int(fila["anio_dato"])] = valor
    return anual, ventana


def elegible(c: Contexto) -> str | None:
    """None si entra; si no, el motivo."""
    estudiantes = c.anual.get((c.u, "estudiantes_total"), {}).get(c.anio)
    jce = c.anual.get((c.u, "academicos_jce"), {}).get(c.anio)
    if estudiantes is None or jce is None:
        return "sin datos del SIES en el año"
    if estudiantes < MIN_ESTUDIANTES:
        return f"{estudiantes:.0f} estudiantes (mínimo {MIN_ESTUDIANTES})"
    if jce < MIN_JCE:
        return f"{jce:.1f} académicos JCE (mínimo {MIN_JCE})"
    if c.bib("publicaciones_openalex") is None:
        return "sin registro en OpenAlex para la ventana"
    return None


def percentiles(valores: dict[str, float], sentido: str) -> dict[str, float]:
    """100 · (universidades superadas) / (n − 1). Superar es tener más, o menos."""
    n = len(valores)
    if n == 1:
        return {u: 100.0 for u in valores}
    todos = list(valores.values())
    salida = {}
    for u, x in valores.items():
        superadas = sum(1 for y in todos if (y < x if sentido == "mayor" else y > x))
        salida[u] = 100.0 * superadas / (n - 1)
    return salida


def origen(m: MetricaKai, anio: int) -> str:
    """De qué años salió cada insumo de la métrica."""
    partes = []
    if "SIES" in m.fuentes:
        # Las jornadas son siempre del año; el numerador, si es flujo, del trienio.
        partes.append(f"SIES {anio - 2}-{anio}" if m.trienal and m.fuentes == "SIES" else f"SIES {anio}")
    if "ANID" in m.fuentes:
        partes.append(f"ANID {anio - 2}-{anio}")
    if "OpenAlex" in m.fuentes:
        partes.append(f"OpenAlex {anio - 4}-{anio}")
    return "; ".join(partes)


def calcular() -> tuple[list[dict], dict]:
    """Filas (universidad, año, métrica, valor, puntaje) y los excluidos por año."""
    anual, ventana = cargar_consolidado()
    universidades = sorted({u for (u, _v) in anual})
    filas: list[dict] = []
    excluidas: dict[int, list[tuple[str, str]]] = defaultdict(list)

    for anio in range(ANIO_DESDE, ANIO_HASTA + 1):
        contextos = {}
        for u in universidades:
            c = Contexto(anual, ventana, u, anio)
            motivo = elegible(c)
            if motivo:
                # Solo interesa informar de las que tuvieron presencia ese año.
                if anual.get((u, "estudiantes_total"), {}).get(anio) is not None:
                    excluidas[anio].append((u, motivo))
                continue
            contextos[u] = c

        for m in METRICAS:
            valores = {u: m.calcular(c) for u, c in contextos.items()}
            puntajes = percentiles(valores, m.sentido)
            for u in contextos:
                filas.append({
                    "universidad": u, "anio": anio, "metrica": m.nombre,
                    "valor": valores[u], "puntaje": puntajes[u],
                    "unidad": m.unidad, "formula": m.formula, "fuentes": m.fuentes,
                    "anios_origen": origen(m, anio),
                })
    return filas, excluidas


# --------------------------------------------------------------------------- #
def escribir_csv(filas: list[dict]) -> None:
    """Una fila por universidad y año, con el valor y el percentil de cada métrica."""
    por_clave: dict = defaultdict(dict)
    for f in filas:
        por_clave[(f["universidad"], f["anio"])][f["metrica"]] = (f["valor"], f["puntaje"])
    columnas = ["universidad", "anio", "puntaje_kai"]
    for m in METRICAS:
        columnas += [f"{m.nombre} (valor)", f"{m.nombre} (percentil)"]
    with SALIDA_CSV.open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(columnas)
        for (u, anio), met in sorted(por_clave.items(), key=lambda kv: (kv[0][1], kv[0][0])):
            total = sum(p for _, p in met.values()) / len(met)
            fila = [u, anio, round(total, 2)]
            for m in METRICAS:
                v, p = met[m.nombre]
                fila += [round(v, 4), round(p, 2)]
            w.writerow(fila)


def _url(args) -> str:
    if args.url:
        return args.url
    from dotenv import dotenv_values
    url = dotenv_values(RAIZ_REPO / "backend" / ".env").get("DATABASE_URL")
    if not url:
        raise SystemExit("Sin DATABASE_URL en backend/.env; pásala con --url.")
    return url


def resolver_ids(conexion, filas: list[dict]) -> tuple[dict, dict]:
    from sqlalchemy import text
    metricas = {r[1]: r[0] for r in conexion.execute(text("""
        SELECT m.id_metrica, m.nombre_metrica FROM metrica m
        JOIN ranking r ON r.id_ranking = m.id_ranking
        WHERE r.nombre_ranking = :n"""), {"n": NOMBRE_RANKING})}
    if not metricas:
        raise SystemExit("La base no tiene el Ranking KAI. Aplica antes la migración 009.")
    faltan = sorted({m.nombre for m in METRICAS} - set(metricas))
    sobran = sorted(set(metricas) - {m.nombre for m in METRICAS})
    if faltan or sobran:
        raise SystemExit(f"Las métricas de la base no coinciden con las del guion.\n"
                         f"  faltan en la base: {faltan}\n  sobran en la base: {sobran}")
    universidades = {r[1]: r[0] for r in conexion.execute(text(
        "SELECT id_universidad, nombre_universidad FROM universidad"))}
    sin_id = sorted({f["universidad"] for f in filas} - set(universidades))
    if sin_id:
        raise SystemExit(f"Universidades que la base no tiene: {sin_id}")
    return metricas, universidades


def escribir_en_base(url: str, filas: list[dict]) -> None:
    """Reemplaza, en una sola transacción, todo lo que el Ranking KAI tenía cargado."""
    from sqlalchemy import create_engine, text
    motor = create_engine(url)
    with motor.begin() as c:
        metricas, universidades = resolver_ids(c, filas)
        ids = list(metricas.values())
        c.execute(text("DELETE FROM metrica_universidad WHERE id_metrica = ANY(:ids)"), {"ids": ids})
        c.execute(text("DELETE FROM valor_real_universidad WHERE id_metrica = ANY(:ids)"), {"ids": ids})
        puntajes = [{"m": metricas[f["metrica"]], "u": universidades[f["universidad"]],
                     "a": f["anio"], "v": round(f["puntaje"], 4)} for f in filas]
        c.execute(text("""INSERT INTO metrica_universidad
                          (id_metrica, id_universidad, valor_metrica, anio_metrica)
                          VALUES (:m, :u, :v, :a)"""), puntajes)
        reales = [{"m": metricas[f["metrica"]], "u": universidades[f["universidad"]],
                   "a": f["anio"], "v": f["valor"], "un": f["unidad"], "fo": f["formula"],
                   "ao": f["anios_origen"], "fu": f["fuentes"]} for f in filas]
        c.execute(text("""INSERT INTO valor_real_universidad
                          (id_metrica, id_universidad, anio_edicion, valor, unidad, calidad,
                           formula, anios_origen, fuentes)
                          VALUES (:m, :u, :a, :v, :un, 'directa', :fo, :ao, :fu)"""), reales)
    print(f"  cargadas {len(filas):,} filas en cada tabla".replace(",", "."))


def escribir_sql(ruta: Path, filas: list[dict]) -> None:
    """SQL autocontenido: resuelve los ids por nombre, así sirve en cualquier base."""
    def q(s: str) -> str:
        return "'" + str(s).replace("'", "''") + "'"

    lineas = [
        "-- Datos del Ranking KAI, generado por tools/recoleccion/cargar_ranking_kai.py.",
        "-- Requiere las migraciones 008 y 009. Reemplaza lo que hubiera cargado.",
        "BEGIN;",
        "CREATE TEMP TABLE kai_carga (universidad TEXT, metrica TEXT, anio INT, puntaje DOUBLE PRECISION,",
        "  valor DOUBLE PRECISION, unidad TEXT, formula TEXT, anios_origen TEXT, fuentes TEXT) ON COMMIT DROP;",
        "INSERT INTO kai_carga VALUES",
    ]
    valores = [f"({q(f['universidad'])}, {q(f['metrica'])}, {f['anio']}, {f['puntaje']:.4f}, "
               f"{f['valor']!r}, {q(f['unidad'])}, {q(f['formula'])}, {q(f['anios_origen'])}, "
               f"{q(f['fuentes'])})" for f in filas]
    lineas.append(",\n".join(valores) + ";")
    lineas += [
        "DELETE FROM metrica_universidad WHERE id_metrica IN (SELECT m.id_metrica FROM metrica m",
        f"  JOIN ranking r USING (id_ranking) WHERE r.nombre_ranking = {q(NOMBRE_RANKING)});",
        "DELETE FROM valor_real_universidad WHERE id_metrica IN (SELECT m.id_metrica FROM metrica m",
        f"  JOIN ranking r USING (id_ranking) WHERE r.nombre_ranking = {q(NOMBRE_RANKING)});",
        "INSERT INTO metrica_universidad (id_metrica, id_universidad, valor_metrica, anio_metrica)",
        "SELECT m.id_metrica, u.id_universidad, k.puntaje, k.anio FROM kai_carga k",
        "  JOIN universidad u ON u.nombre_universidad = k.universidad",
        "  JOIN metrica m ON m.nombre_metrica = k.metrica",
        f"  JOIN ranking r ON r.id_ranking = m.id_ranking AND r.nombre_ranking = {q(NOMBRE_RANKING)};",
        "INSERT INTO valor_real_universidad (id_metrica, id_universidad, anio_edicion, valor, unidad,",
        "  calidad, formula, anios_origen, fuentes)",
        "SELECT m.id_metrica, u.id_universidad, k.anio, k.valor, k.unidad, 'directa', k.formula,",
        "  k.anios_origen, k.fuentes FROM kai_carga k",
        "  JOIN universidad u ON u.nombre_universidad = k.universidad",
        "  JOIN metrica m ON m.nombre_metrica = k.metrica",
        f"  JOIN ranking r ON r.id_ranking = m.id_ranking AND r.nombre_ranking = {q(NOMBRE_RANKING)};",
        "DO $$ BEGIN",
        "  IF (SELECT count(*) FROM kai_carga) <> (SELECT count(*) FROM metrica_universidad mu",
        "      JOIN metrica m USING (id_metrica) JOIN ranking r USING (id_ranking)",
        f"      WHERE r.nombre_ranking = {q(NOMBRE_RANKING)}) THEN",
        "    RAISE EXCEPTION 'No todas las filas del Ranking KAI encontraron su universidad o métrica';",
        "  END IF;",
        "END $$;",
        "COMMIT;",
    ]
    ruta.write_text("\n".join(lineas) + "\n", encoding="utf-8")
    print(f"  -> {ruta} ({len(filas):,} filas)".replace(",", "."))


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--escribir", action="store_true",
                   help="reemplaza en la base lo cargado del Ranking KAI")
    p.add_argument("--url", help="base de destino (por defecto, la de backend/.env)")
    p.add_argument("--sql", type=Path, help="escribe un SQL con los datos en vez de conectarse")
    args = p.parse_args()

    filas, excluidas = calcular()
    escribir_csv(filas)

    por_anio = defaultdict(set)
    for f in filas:
        por_anio[f["anio"]].add(f["universidad"])
    print(f"Ranking KAI · {len(METRICAS)} métricas · {ANIO_DESDE}-{ANIO_HASTA}\n")
    print("  año  universidades  excluidas")
    for anio in range(ANIO_DESDE, ANIO_HASTA + 1):
        print(f"  {anio}  {len(por_anio[anio]):>13}  {len(excluidas[anio]):>9}")

    ultimo = max((a for a, us in por_anio.items() if us), default=ANIO_HASTA)
    print(f"\n  Excluidas en {ultimo}:")
    for u, motivo in sorted(excluidas[ultimo]):
        print(f"    {u[:44]:46} {motivo}")

    totales = defaultdict(list)
    for f in filas:
        if f["anio"] == ultimo:
            totales[f["universidad"]].append(f["puntaje"])
    orden = sorted(((sum(v) / len(v), u) for u, v in totales.items()), reverse=True)
    print(f"\n  Ranking KAI {ultimo}, pesos parejos (diez primeras):")
    for i, (s, u) in enumerate(orden[:10], start=1):
        print(f"    {i:>2}. {u[:46]:48} {s:>5.1f}")
    print(f"\n  {len(filas):,} valores -> {SALIDA_CSV.name}".replace(",", "."))

    if args.sql:
        escribir_sql(args.sql, filas)
    if args.escribir:
        escribir_en_base(_url(args), filas)
    elif not args.sql:
        print("\n  (no se tocó ninguna base; usa --escribir para cargar)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
