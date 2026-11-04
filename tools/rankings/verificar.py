# -*- coding: utf-8 -*-
"""Comprobaciones de una instantánea que no necesitan la base.

Las que dependen de la base —que cada métrica exista, que una edición ya cargada
coincida, que el total publicado de QS cuadre con los pesos— están en cargar.py.
"""
from __future__ import annotations

from collections import Counter, defaultdict

from comun import TOTAL, Fila

# Techo de un puntaje: 100 en todos los rankings menos GRAS, cuyos indicadores ya
# vienen ponderados (el de World-Class Output llega a 200) y cuyo total los suma.
TECHO = {"shanghai-gras": 1000.0}


def instantanea(clave: str, edicion: int, filas: list[Fila]) -> list[str]:
    problemas = []
    if not filas:
        return ["no trae ninguna universidad chilena"]
    if any(f.edicion != edicion for f in filas):
        problemas.append("filas de otra edición")

    repetidas = [k for k, n in Counter((f.disciplina, f.universidad, f.metrica) for f in filas).items() if n > 1]
    if repetidas:
        problemas.append(f"{len(repetidas)} cifras repetidas, p. ej. {repetidas[0]}: dos filas de la fuente "
                         "se tradujeron a la misma universidad (alias mal puesto)")

    techo = TECHO.get(clave, 100.0)
    fuera = [f for f in filas if not 0 <= f.valor <= techo + 1e-9]
    if fuera:
        problemas.append(f"{len(fuera)} cifras fuera de 0-{techo:g}, p. ej. {fuera[0]}")

    # Cada universidad trae sus componentes; un total sin componentes es una fila
    # mal leída.
    por_universidad = defaultdict(set)
    for f in filas:
        por_universidad[(f.disciplina, f.universidad)].add(f.metrica)
    solo_total = [k for k, ms in por_universidad.items() if ms == {TOTAL}]
    if solo_total:
        problemas.append(f"{len(solo_total)} universidades con total y sin componentes, p. ej. {solo_total[0]}")

    calculados = [f for f in filas if f.origen not in ("publicado", "calculado")]
    if calculados:
        problemas.append(f"origen desconocido en {len(calculados)} filas")
    return problemas
