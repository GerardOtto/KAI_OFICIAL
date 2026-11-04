# -*- coding: utf-8 -*-
"""ShanghaiRanking: ARWU y GRAS, desde su API pública.

    /api/pub/v1/arwu/rank?version=AAAA
    /api/pub/v1/gras/subj?version=AAAA                     materias de la edición
    /api/pub/v1/gras/rank?version=AAAA&subj_code=XXNNNN

Es la misma API que usa shanghairanking.com para dibujar sus tablas; el sitio no
publica `robots.txt`. Una edición que todavía no sale responde
`{"code": -1, "msg": "Parameter error"}`.

El puntaje total:

  * **ARWU** lo publica solo para las 100 primeras. Es la suma ponderada de los
    seis indicadores como porcentaje de la de la primera del mundo (que recibe
    100); el mismo cálculo se aplica a las demás y se comprueba contra las 100
    publicadas.
  * **GRAS** lo publica para las 50 primeras de cada materia, y es la suma de los
    puntajes de sus indicadores, que ya vienen ponderados. Se comprueba igual.
"""
from __future__ import annotations

import json

from comun import TOTAL, ErrorDeFuente, Fila, descargar, resolvedor, sha256, ahora, numero

API = "https://www.shanghairanking.com/api/pub/v1"
PRIMERA_ARWU = 2003
PRIMERA_GRAS = 2017

# Pesos de ARWU desde 2004 (la edición 2003 usó otra metodología). Los nombres son
# los de la API y, a la vez, los de la tabla `metrica`.
PESOS_ARWU = {"Alumni": 10, "Award": 20, "HiCi": 20, "N&S": 20, "PUB": 20, "PCP": 10}

# Las materias de GRAS cuyo nombre en la base es más corto que en la API.
MATERIA_EN_BASE = {
    "Automation & Control": "Automation",
    "Computer Science & Engineering": "Computer Science",
    "Dentistry & Oral Sciences": "Dentistry",
    "Electrical & Electronic Engineering": "Electrical Engineering",
    "Energy Science & Engineering": "Energy",
    "Environmental Science & Engineering": "Environmental Science",
    "Food Science & Technology": "Food Science",
    "Instruments Science & Technology": "Instrumentation",
    "Marine/Ocean Engineering": "Marine Engineering",
    "Materials Science & Engineering": "Materials Science",
    "Mining & Mineral Engineering": "Mining Engineering",
    "Nanoscience & Nanotechnology": "Nanoscience",
    "Pharmacy & Pharmaceutical Sciences": "Pharmacy",
    "Robotic Science & Engineering": "Robotics",
    "Textile Science & Engineering": "Textile Engineering",
    "Transportation Science & Technology": "Transportation",
}

# Indicadores de GRAS: nombre en la API -> nombre en la base. Desde 2024 la API
# los llama por su categoría; la base conserva las siglas de antes.
INDICADOR_EN_BASE = {
    "PUB": "PUB", "CNCI": "CNCI", "IC": "IC", "TOP": "TOP", "Q1": "Q1",
    "World-Class Faculty": "World-Class Faculty", "World-Class Output": "World-Class Output",
    "High Quality Research": "Q1", "Research Impact": "CNCI", "International Collaboration": "IC",
    # El premio de 2017-2023. La base no tiene esa métrica: ninguna chilena lo
    # obtuvo. Si alguna lo tuviera, el cargador lo rechaza en vez de perderlo.
    "AWARD": "AWARD",
}


def _json(url: str, crudo: str) -> dict | None:
    contenido = descargar(url, f"shanghai/{crudo}")
    datos = json.loads(contenido)
    if datos.get("code") == -1:
        return None  # la edición no existe (todavía)
    if datos.get("code") != 200 or "data" not in datos:
        raise ErrorDeFuente(f"{url}: respuesta inesperada {str(datos)[:200]}")
    datos["_sha256"] = sha256(contenido)
    return datos


def existe(ranking: str, edicion: int) -> bool:
    """Si la fuente ya publicó esa edición. Se pregunta sin caché: es la pregunta
    del mes, y una respuesta guardada diría siempre lo mismo."""
    import requests

    from comun import CABECERAS

    url = (f"{API}/arwu/rank?version={edicion}" if ranking == "shanghai-arwu"
           else f"{API}/gras/subj?version={edicion}")
    datos = requests.get(url, headers=CABECERAS, timeout=90).json()
    return datos.get("code") == 200


def _chilenas(rankings: list[dict], resolver, sin_alias: set) -> list[tuple[dict, str]]:
    salida = []
    for r in rankings:
        if r.get("region") != "Chile":
            continue
        universidad = resolver(r["univNameEn"])
        if universidad is None:
            sin_alias.add(r["univNameEn"])
            continue
        salida.append((r, universidad))
    return salida


def arwu(edicion: int) -> tuple[list[Fila], dict]:
    url = f"{API}/arwu/rank?version={edicion}"
    datos = _json(url, f"arwu_{edicion}.json")
    if datos is None:
        raise ErrorDeFuente(f"ARWU {edicion} no está publicado")
    d = datos["data"]
    codigo = {i["code"]: i["nameEn"] for i in d["indicators"]}
    # La edición 2003 no tenía Alumni: se aceptan menos indicadores, nunca otros.
    if not set(codigo.values()) <= set(PESOS_ARWU):
        raise ErrorDeFuente(f"ARWU {edicion} trae indicadores nuevos: {sorted(set(codigo.values()) - set(PESOS_ARWU))}")

    def suma(r):
        return sum((numero(r["indData"].get(c)) or 0) * PESOS_ARWU[n] / 100 for c, n in codigo.items())

    primera = d["rankings"][0]
    suma_primera = suma(primera)
    # El método se comprueba con las cien que ARWU sí publica.
    errores = [abs(100 * suma(r) / suma_primera - float(r["score"]))
               for r in d["rankings"] if numero(r.get("score")) is not None]
    error_max = max(errores) if errores else None
    calcula = edicion >= 2004 and error_max is not None and error_max <= 0.15

    resolver, sin_alias, filas = resolvedor(), set(), []
    for r, universidad in _chilenas(d["rankings"], resolver, sin_alias):
        for c, nombre in codigo.items():
            v = numero(r["indData"].get(c))
            if v is not None:
                filas.append(Fila("Shanghai ARWU", edicion, "General", universidad, r["univNameEn"],
                                  r["ranking"], nombre, v))
        publicado = numero(r.get("score"))
        if publicado is not None:
            filas.append(Fila("Shanghai ARWU", edicion, "General", universidad, r["univNameEn"],
                              r["ranking"], TOTAL, publicado))
        elif calcula:
            filas.append(Fila("Shanghai ARWU", edicion, "General", universidad, r["univNameEn"],
                              r["ranking"], TOTAL, round(100 * suma(r) / suma_primera, 1), "calculado"))
    if sin_alias:
        raise ErrorDeFuente(f"ARWU {edicion}: universidades chilenas sin alias {sorted(sin_alias)}")
    meta = {"fuente": url, "descargado": ahora(), "sha256": datos["_sha256"],
            "total": ("100 × suma ponderada / la de la primera del mundo" if calcula
                      else "sin total calculado: la metodología no reproduce los publicados"),
            "suma_primera": round(suma_primera, 3),
            "error_max_contra_publicados": round(error_max, 3) if error_max is not None else None}
    return filas, meta


# Desde 2024 GRAS publica cada indicador ya ponderado (el de World-Class Output
# llega a 200) y su total es la suma. Hasta 2023 los publicaba en una escala de
# 0 a 100 y el total era Σ puntaje × peso / 100, con pesos propios de cada materia
# y edición (Matemáticas: CNCI 100 en 2017, 20 en 2023). La API no trae esos
# pesos y las páginas de metodología anteriores a 2023 ya no existen: se deducen
# de los totales que GRAS publica para las 50 primeras de cada materia.
PRIMERA_PONDERADA = 2024
PASO_PESO = 0.05      # los pesos de GRAS son múltiplos de 5 puntos sobre 100
# GRAS redondea a un decimal cada indicador y el total: el error admisible es el
# de ese redondeo, ±0,05 por indicador según su peso y ±0,05 del total, con un
# pequeño margen.


def _tolerancia(pesos: list[float]) -> float:
    return 0.06 * (1 + sum(abs(p) for p in pesos))


def _pesos(rankings: list[dict], codigos: list[str]) -> tuple[dict | None, float | None]:
    """Pesos (sobre 1) de cada indicador, deducidos de los totales publicados.

    Se ajustan por mínimos cuadrados, se redondean al múltiplo de 5 puntos y se
    exige que reproduzcan cada total publicado dentro del redondeo. Un indicador que vale 0 en
    todas las publicadas no se puede deducir: queda sin peso (None)."""
    publicadas = [r for r in rankings if numero(r.get("score")) is not None]
    if len(publicadas) < len(codigos) + 3:
        return None, None
    X = [[numero(r["indData"].get(c)) or 0 for c in codigos] for r in publicadas]
    y = [numero(r["score"]) for r in publicadas]
    activas = [j for j in range(len(codigos)) if any(fila[j] for fila in X)]
    w = _minimos_cuadrados([[fila[j] for j in activas] for fila in X], y)
    if w is None:
        return None, None
    w = [round(p / PASO_PESO) * PASO_PESO for p in w]
    error = max(abs(sum(fila[j] * p for j, p in zip(activas, w)) - t) for fila, t in zip(X, y))
    if error > _tolerancia(w):
        return None, error
    pesos = {c: None for c in codigos}
    for j, peso in zip(activas, w):
        pesos[codigos[j]] = round(peso, 2)
    return pesos, error


def _minimos_cuadrados(X: list[list[float]], y: list[float]) -> list[float] | None:
    """Ecuaciones normales (XᵀX) w = Xᵀy por eliminación de Gauss: son cinco
    incógnitas, y así la revisión mensual no necesita numpy."""
    n = len(X[0]) if X else 0
    A = [[sum(f[i] * f[j] for f in X) for j in range(n)] + [sum(f[i] * t for f, t in zip(X, y))]
         for i in range(n)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(A[r][col]))
        if abs(A[piv][col]) < 1e-9:
            return None
        A[col], A[piv] = A[piv], A[col]
        for r in range(n):
            if r != col:
                k = A[r][col] / A[col][col]
                A[r] = [a - k * b for a, b in zip(A[r], A[col])]
    return [A[i][n] / A[i][i] for i in range(n)]


def gras(edicion: int) -> tuple[list[Fila], dict]:
    url_materias = f"{API}/gras/subj?version={edicion}"
    lista = _json(url_materias, f"gras_{edicion}_materias.json")
    if lista is None:
        raise ErrorDeFuente(f"GRAS {edicion} no está publicado")
    materias = [s for cat in lista["data"] for s in cat["detail"]
                if str(edicion) in str(s.get("versions", "")).split(",")]
    if not materias:
        raise ErrorDeFuente(f"GRAS {edicion}: la lista de materias viene vacía")

    ponderada = edicion >= PRIMERA_PONDERADA
    resolver, sin_alias, filas = resolvedor(), set(), []
    errores, sin_indicador, sin_total, pesos_por_materia = [], set(), [], {}
    for s in materias:
        datos = _json(f"{API}/gras/rank?version={edicion}&subj_code={s['code']}",
                      f"gras_{edicion}_{s['code']}.json")
        if datos is None:
            raise ErrorDeFuente(f"GRAS {edicion}: falta la materia {s['nameEn']}")
        d = datos["data"]
        codigo = {i["code"]: i["nameEn"] for i in d["indicators"]}
        desconocidos = set(codigo.values()) - set(INDICADOR_EN_BASE)
        if desconocidos:
            raise ErrorDeFuente(f"GRAS {edicion} {s['nameEn']}: indicadores nuevos {sorted(desconocidos)}")
        if ponderada:
            pesos = {c: 1.0 for c in codigo}
            for r in d["rankings"]:
                publicado = numero(r.get("score"))
                if publicado is not None:
                    errores.append(abs(sum(numero(v) or 0 for v in r["indData"].values()) - publicado))
        else:
            pesos, error = _pesos(d["rankings"], list(codigo))
            if pesos is not None:
                errores.append(error)
                pesos_por_materia[s["nameEn"]] = {codigo[c]: p for c, p in pesos.items()}
        disciplina = MATERIA_EN_BASE.get(s["nameEn"], s["nameEn"])
        for r, universidad in _chilenas(d["rankings"], resolver, sin_alias):
            for c, v in r["indData"].items():
                v = numero(v)
                nombre = INDICADOR_EN_BASE[codigo[c]]
                if v is None:
                    continue
                if nombre == "AWARD":
                    if v:
                        sin_indicador.add(f"{s['nameEn']}: {universidad}")
                    continue
                filas.append(Fila("Shanghai GRAS", edicion, disciplina, universidad, r["univNameEn"],
                                  r["ranking"], nombre, v))
            publicado = numero(r.get("score"))
            if publicado is not None:
                filas.append(Fila("Shanghai GRAS", edicion, disciplina, universidad, r["univNameEn"],
                                  r["ranking"], TOTAL, publicado))
                continue
            valores = {c: numero(v) or 0 for c, v in r["indData"].items()}
            # Sin pesos, o con un indicador sin peso deducible que esta universidad
            # sí tiene, el total no se puede calcular: se deja sin él.
            if pesos is None or any(v and pesos.get(c) is None for c, v in valores.items()):
                sin_total.append(f"{s['nameEn']}: {universidad}")
                continue
            total = sum(v * (pesos.get(c) or 0) for c, v in valores.items())
            filas.append(Fila("Shanghai GRAS", edicion, disciplina, universidad, r["univNameEn"],
                              r["ranking"], TOTAL, round(total, 1), "calculado"))
    if sin_alias:
        raise ErrorDeFuente(f"GRAS {edicion}: universidades chilenas sin alias {sorted(sin_alias)}")
    if sin_indicador:
        raise ErrorDeFuente(f"GRAS {edicion}: AWARD distinto de cero sin métrica en la base: "
                            f"{sorted(sin_indicador)}")
    error_max = max(errores) if errores else None
    if ponderada and error_max is not None and error_max > 0.25:
        raise ErrorDeFuente(f"GRAS {edicion}: el total ya no es la suma de los indicadores "
                            f"(error máximo {error_max:.2f})")
    meta = {"fuente": url_materias, "descargado": ahora(), "materias": len(materias),
            "total": ("suma de los indicadores, que GRAS publica ya ponderados" if ponderada else
                      "Σ indicador × peso de la materia; pesos deducidos de los totales publicados "
                      "del top 50, que los reproducen dentro del redondeo de GRAS"),
            "error_max_contra_publicados": round(error_max, 3) if error_max is not None else None,
            "sin_total": sin_total}
    if not ponderada:
        meta["pesos_deducidos"] = pesos_por_materia
    return filas, meta
