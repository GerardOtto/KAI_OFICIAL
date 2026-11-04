# -*- coding: utf-8 -*-
"""Carga en la base las instantáneas de datos/rankings, después de verificarlas.

    python tools/rankings/cargar.py                        # solo compara; no escribe
    python tools/rankings/cargar.py --escribir             # carga las ediciones que faltan
    python tools/rankings/cargar.py shanghai-gras 2026 --escribir
    python tools/rankings/cargar.py the-latam 2026 --escribir --reemplazar
    python tools/rankings/cargar.py --sql ediciones.sql    # SQL de las que faltan, para psql
    python tools/rankings/cargar.py --url postgresql://…   # otra base (por defecto, backend/.env)

Qué se comprueba antes de escribir una edición:

  1. Cada métrica de la instantánea existe en la base, en su disciplina, y se elige
     la de su metodología: GRAS cambió de indicadores en 2020 y en 2024, y la base
     guarda una métrica por época. Una métrica o disciplina nueva detiene la carga:
     hay que crearla con una migración, con su peso.
  2. Cada universidad está en la tabla `universidad`.
  3. El puntaje total cuadra con sus componentes: en THE (desde 2024) a ±0,15 con
     los pesos de la base; en QS, la razón entre el total publicado y la suma
     ponderada es pareja entre universidades (una columna corrida, como la de QS
     Global 2026, la descuadra); en GRAS es la suma de los indicadores.
  4. Si la base ya tiene la edición, la instantánea debe coincidir con ella cifra
     por cifra. Si solo le faltan cifras —típicamente el puntaje total de GRAS
     anterior a 2024, que la migración 020 no puede calcular—, se agregan sin
     tocar las demás. Cualquier otra diferencia detiene la carga, salvo con
     --reemplazar, que exige nombrar el ranking y la edición.

Después de escribir, vuelve a leer lo escrito y lo compara, en la misma
transacción. La instantánea de una edición ya cargada sirve así de prueba de
regresión: la base debe poder reconstruirse desde las fuentes oficiales.

Requiere las migraciones 020 (la métrica «Puntaje total») y 021 (desde qué edición
GRAS publica sus puntajes ya ponderados). El backend cachea el
panorama de datos del asistente: después de cargar, reinícialo.
"""
from __future__ import annotations

import argparse
import statistics
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from comun import RAIZ, RANKINGS, TOTAL, Fila, ediciones_guardadas, forma, leer_instantanea  # noqa: E402
import verificar  # noqa: E402

TOLERANCIA = 0.005


class Rechazo(Exception):
    """La instantánea no se puede cargar tal como está."""


def url_por_defecto() -> str:
    from dotenv import dotenv_values

    url = dotenv_values(RAIZ / "backend" / ".env").get("DATABASE_URL")
    if not url:
        raise SystemExit("Sin DATABASE_URL en backend/.env; pásala con --url.")
    return url


class Base:
    """Lo que el cargador necesita saber de la base, leído una sola vez."""

    def __init__(self, conexion):
        from sqlalchemy import text

        self.c = conexion
        self.text = text
        self.rankings = {r.nombre_ranking: r for r in conexion.execute(text("""
            SELECT id_ranking, nombre_ranking,
                   COALESCE((to_jsonb(r) ->> 'puntajes_ponderados_desde')::int, 9999) AS ponderados_desde
            FROM ranking r"""))}
        self.metricas = defaultdict(list)
        for m in conexion.execute(text("""
                SELECT m.id_metrica, m.id_ranking, m.disciplina, m.nombre_metrica, m.tipo_metrica,
                       m.pondera, m.peso_metrica,
                       COALESCE(array_agg(DISTINCT mu.anio_metrica)
                                FILTER (WHERE mu.anio_metrica IS NOT NULL), '{}') AS anios
                FROM metrica m LEFT JOIN metrica_universidad mu ON mu.id_metrica = m.id_metrica
                GROUP BY m.id_metrica""")):
            self.metricas[m.id_ranking].append(m)
        self.universidades = dict(conexion.execute(text(
            "SELECT nombre_universidad, id_universidad FROM universidad")).fetchall())
        if not any(m.tipo_metrica == "Puntaje" for ms in self.metricas.values() for m in ms
                   if m.nombre_metrica == TOTAL):
            raise SystemExit("La base no tiene la métrica «Puntaje total»: aplica antes "
                             "backend/migraciones/020_puntaje_total.sql.")
        if not conexion.execute(text("""SELECT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'ranking' AND column_name = 'puntajes_ponderados_desde')""")).scalar():
            raise SystemExit("La base no tiene ranking.puntajes_ponderados_desde: aplica antes "
                             "backend/migraciones/021_gras_por_edicion.sql.")

    def metrica(self, id_ranking: int, disciplina: str, nombre: str, edicion: int):
        es_total = nombre == TOTAL
        candidatas = [m for m in self.metricas[id_ranking]
                      if m.disciplina == disciplina and forma(m.nombre_metrica) == forma(nombre)
                      and (m.tipo_metrica == "Puntaje") == es_total and (m.pondera or es_total)]
        if len(candidatas) > 1:
            # Varias épocas de la misma métrica (GRAS): la que ya tiene esa edición
            # o, si es nueva, la de la época más reciente.
            con_edicion = [m for m in candidatas if edicion in m.anios]
            if con_edicion:
                candidatas = con_edicion
            else:
                ultima = max(max(m.anios, default=0) for m in candidatas)
                candidatas = [m for m in candidatas if max(m.anios, default=0) == ultima]
        if len(candidatas) != 1:
            raise Rechazo(f"la métrica «{nombre}» ({disciplina}) "
                          + ("no existe en la base: requiere una migración que la cree con su peso"
                             if not candidatas else f"es ambigua: {[m.id_metrica for m in candidatas]}"))
        return candidatas[0]

    def cargadas(self, id_ranking: int, edicion: int) -> dict:
        """(id_metrica, id_universidad) -> valor, de todo el ranking en esa edición."""
        filas = self.c.execute(self.text("""
            SELECT mu.id_metrica, mu.id_universidad, mu.valor_metrica
            FROM metrica_universidad mu JOIN metrica m ON m.id_metrica = mu.id_metrica
            WHERE m.id_ranking = :r AND mu.anio_metrica = :a"""), {"r": id_ranking, "a": edicion})
        return {(f.id_metrica, f.id_universidad): (None if f.valor_metrica is None else float(f.valor_metrica))
                for f in filas}


def traducir(base: Base, clave: str, edicion: int, filas: list[Fila]) -> tuple[dict, dict]:
    """Instantánea -> {(id_metrica, id_universidad): valor} y las métricas usadas."""
    ranking = base.rankings.get(RANKINGS[clave])
    if ranking is None:
        raise Rechazo(f"la base no tiene el ranking {RANKINGS[clave]}")
    valores, metricas, sin_universidad = {}, {}, set()
    for f in filas:
        m = base.metrica(ranking.id_ranking, f.disciplina, f.metrica, edicion)
        uid = base.universidades.get(f.universidad)
        if uid is None:
            sin_universidad.add(f.universidad)
            continue
        valores[(m.id_metrica, uid)] = f.valor
        metricas[m.id_metrica] = m
    if sin_universidad:
        raise Rechazo(f"universidades que la tabla `universidad` no tiene: {sorted(sin_universidad)}")
    return valores, metricas


def coherencia(base: Base, clave: str, edicion: int, valores: dict, metricas: dict) -> list[str]:
    """El total publicado frente a sus componentes, con los pesos de la base."""
    ranking = base.rankings[RANKINGS[clave]]
    por_univ = defaultdict(dict)
    for (mid, uid), v in valores.items():
        m = metricas[mid]
        por_univ[(m.disciplina, uid)][mid] = v
    pares = []
    for (_, uid), vals in por_univ.items():
        total = next((v for mid, v in vals.items() if metricas[mid].tipo_metrica == "Puntaje"), None)
        if total is None:
            continue
        factor = (lambda m: 1.0) if edicion >= ranking.ponderados_desde else (lambda m: float(m.peso_metrica or 0) / 100)
        suma = sum(v * factor(metricas[mid]) for mid, v in vals.items() if metricas[mid].tipo_metrica != "Puntaje")
        pares.append((total, suma))
    problemas = []
    if clave == "the-latam" and edicion >= 2024:
        peor = max((abs(t - s) for t, s in pares), default=0)
        if peor > 0.15:
            problemas.append(f"el total no cuadra con los pilares y sus pesos (diferencia de hasta {peor:.2f})")
    elif clave in ("qs-latam", "qs-global"):
        razones = [t / s for t, s in pares if s > 0]
        if len(razones) >= 3:
            mediana = statistics.median(razones)
            fuera = [r for r in razones if abs(r / mediana - 1) > 0.12]
            if fuera:
                problemas.append(f"en {len(fuera)} universidades el total publicado no guarda proporción con "
                                 f"sus componentes (razón {min(razones):.2f}–{max(razones):.2f}, mediana "
                                 f"{mediana:.2f}): ¿columnas corridas?")
    elif clave == "shanghai-gras" and edicion >= ranking.ponderados_desde:
        # Antes de 2024 el total usa los pesos de cada materia y edición, que la
        # base no guarda: la fuente ya lo comprobó contra los publicados.
        peor = max((abs(t - s) for t, s in pares), default=0)
        if peor > 0.25:
            problemas.append(f"el total no es la suma de los indicadores (diferencia de hasta {peor:.2f})")
    return problemas


def comparar(nuevos: dict, metricas: dict, cargados: dict) -> list[str]:
    """Diferencias entre la instantánea y lo que la base tiene de esa edición."""
    diferencias = []
    for clave, v in nuevos.items():
        actual = cargados.get(clave, "falta")
        if actual == "falta":
            diferencias.append(f"falta en la base: métrica {clave[0]}, universidad {clave[1]} = {v}")
        elif actual is None or abs(actual - v) > TOLERANCIA:
            diferencias.append(f"distinta: métrica {clave[0]}, universidad {clave[1]}: base {actual}, fuente {v}")
    for clave, actual in cargados.items():
        if clave[0] in metricas and clave not in nuevos:
            # QS deja vacía la celda de un indicador que no informa, y la carga
            # original la guardó como 0: no es una diferencia de fondo.
            if actual == 0 and metricas[clave[0]].tipo_metrica != "Puntaje":
                continue
            diferencias.append(f"sobra en la base: métrica {clave[0]}, universidad {clave[1]} = {actual}")
    return diferencias


def completar(base: Base, edicion: int, faltan: dict) -> None:
    """Agrega cifras que la base no tiene, sin borrar ni cambiar las que tiene."""
    base.c.execute(base.text("""
        INSERT INTO metrica_universidad (id_metrica, id_universidad, valor_metrica, anio_metrica)
        VALUES (:m, :u, :v, :a)"""),
        [{"m": m, "u": u, "v": v, "a": edicion} for (m, u), v in faltan.items()])


def escribir(base: Base, edicion: int, valores: dict, metricas: dict) -> None:
    base.c.execute(base.text("""
        DELETE FROM metrica_universidad WHERE anio_metrica = :a AND id_metrica = ANY(:m)"""),
        {"a": edicion, "m": list(metricas)})
    base.c.execute(base.text("""
        INSERT INTO metrica_universidad (id_metrica, id_universidad, valor_metrica, anio_metrica)
        VALUES (:m, :u, :v, :a)"""),
        [{"m": m, "u": u, "v": v, "a": edicion} for (m, u), v in valores.items()])


def sql_de(clave: str, edicion: int, ranking_id: int, valores: dict, metricas: dict, nombres: dict) -> str:
    """SQL autocontenido de una edición nueva: comprueba que las métricas sean las
    mismas que en la base de origen y que la edición no esté ya cargada."""
    q = lambda s: "'" + str(s).replace("'", "''") + "'"  # noqa: E731
    lineas = [f"-- {RANKINGS[clave]} {edicion}: generado por tools/rankings/cargar.py", "DO $$ BEGIN"]
    esperadas = ", ".join(f"({m.id_metrica}, {q(m.nombre_metrica)}, {q(m.disciplina)})" for m in metricas.values())
    lineas += [f"  IF (SELECT count(*) FROM metrica WHERE (id_metrica, nombre_metrica, disciplina) IN ({esperadas})) <> {len(metricas)} THEN",
               f"    RAISE EXCEPTION 'Las métricas de {RANKINGS[clave]} no tienen los mismos identificadores que en la base de origen';",
               "  END IF;",
               f"  IF EXISTS (SELECT 1 FROM metrica_universidad WHERE anio_metrica = {edicion} AND id_metrica IN ({', '.join(str(m) for m in metricas)})) THEN",
               f"    RAISE EXCEPTION '{RANKINGS[clave]} {edicion} ya está cargada';",
               "  END IF;", "END $$;",
               "INSERT INTO metrica_universidad (id_metrica, id_universidad, valor_metrica, anio_metrica)",
               "SELECT v.m, u.id_universidad, v.valor, " + str(edicion) + " FROM (VALUES"]
    lineas.append(",\n".join(f"  ({m}, {q(nombres[u])}, {v!r})" for (m, u), v in sorted(valores.items())))
    lineas += [") AS v(m, universidad, valor) JOIN universidad u ON u.nombre_universidad = v.universidad;",
               "DO $$ BEGIN",
               f"  IF (SELECT count(*) FROM metrica_universidad WHERE anio_metrica = {edicion} AND id_metrica IN ({', '.join(str(m) for m in metricas)})) <> {len(valores)} THEN",
               f"    RAISE EXCEPTION 'No todas las cifras de {RANKINGS[clave]} {edicion} encontraron su universidad';",
               "  END IF;", "END $$;", ""]
    return "\n".join(lineas)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("ranking", nargs="?", choices=sorted(RANKINGS))
    p.add_argument("ediciones", nargs="*", type=int)
    p.add_argument("--escribir", action="store_true", help="carga en la base las ediciones que faltan")
    p.add_argument("--reemplazar", action="store_true",
                   help="reemplaza una edición ya cargada que difiere (exige ranking y edición)")
    p.add_argument("--sql", type=Path, help="escribe un SQL con las ediciones que faltan, en vez de cargarlas")
    p.add_argument("--url", help="base de destino (por defecto, DATABASE_URL de backend/.env)")
    args = p.parse_args()
    if args.reemplazar and not (args.ranking and args.ediciones):
        p.error("--reemplazar exige nombrar el ranking y la edición")

    from sqlalchemy import create_engine

    pedidas = [(args.ranking, e) for e in (args.ediciones or ediciones_guardadas(args.ranking))] if args.ranking \
        else [(c, e) for c in RANKINGS for e in ediciones_guardadas(c)]
    motor = create_engine(args.url or url_por_defecto())
    resultado = defaultdict(list)
    sql = ["BEGIN;"]
    with motor.connect() as conexion:
        base = Base(conexion)
        # Leer el catálogo abrió una transacción implícita: se cierra para que cada
        # edición tenga la suya y una rechazada no arrastre a las demás.
        conexion.rollback()
        nombres = {v: k for k, v in base.universidades.items()}
        for clave, edicion in pedidas:
            etiqueta = f"{RANKINGS[clave]} {edicion}"
            transaccion = conexion.begin()
            try:
                filas, _ = leer_instantanea(clave, edicion)
                problemas = verificar.instantanea(clave, edicion, filas)
                valores, metricas = traducir(base, clave, edicion, filas)
                problemas += coherencia(base, clave, edicion, valores, metricas)
                if problemas:
                    raise Rechazo("; ".join(problemas))
                cargados = base.cargadas(base.rankings[RANKINGS[clave]].id_ranking, edicion)
                if not cargados:
                    estado = "nueva"
                else:
                    diferencias = comparar(valores, metricas, cargados)
                    if not diferencias:
                        resultado["coincide"].append(etiqueta)
                        transaccion.rollback()
                        continue
                    if all(d.startswith("falta en la base") for d in diferencias) and not args.reemplazar:
                        estado = "completar"
                    elif not args.reemplazar:
                        raise Rechazo(f"difiere de lo cargado en {len(diferencias)} cifras, p. ej. "
                                      + " | ".join(diferencias[:3]))
                    else:
                        estado = "reemplazada"
                if args.sql:
                    if estado == "nueva":
                        sql.append(sql_de(clave, edicion, base.rankings[RANKINGS[clave]].id_ranking,
                                          valores, metricas, nombres))
                        resultado["en el SQL"].append(etiqueta)
                    else:
                        resultado["fuera del SQL: usa --escribir"].append(f"{etiqueta} ({estado})")
                    transaccion.rollback()
                    continue
                if not args.escribir:
                    resultado[{"nueva": "por cargar", "completar": "por completar",
                               "reemplazada": "por reemplazar"}[estado]].append(etiqueta)
                    transaccion.rollback()
                    continue
                if estado == "completar":
                    faltan = {k: v for k, v in valores.items() if k not in cargados}
                    completar(base, edicion, faltan)
                else:
                    escribir(base, edicion, valores, metricas)
                releidos = {k: v for k, v in base.cargadas(base.rankings[RANKINGS[clave]].id_ranking, edicion).items()
                            if k[0] in metricas}
                if comparar(valores, metricas, releidos):
                    raise Rechazo("lo escrito no coincide con la instantánea al releerlo")
                transaccion.commit()
                resultado[{"nueva": "cargada", "completar": "completada", "reemplazada": "reemplazada"}[estado]].append(
                    f"{etiqueta} ({len(faltan) if estado == 'completar' else len(valores)} cifras)")
            except Rechazo as e:
                transaccion.rollback()
                resultado["rechazada"].append(f"{etiqueta}: {e}")

    if args.sql:
        sql.append("COMMIT;")
        args.sql.write_text("\n".join(sql), encoding="utf-8")
    for estado in ("cargada", "completada", "reemplazada", "en el SQL", "por cargar", "por completar",
                   "por reemplazar", "fuera del SQL: usa --escribir", "coincide", "rechazada"):
        if resultado[estado]:
            print(f"\n{estado.upper()} ({len(resultado[estado])})")
            for x in resultado[estado]:
                print(f"  {x}")
    return 1 if resultado["rechazada"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
