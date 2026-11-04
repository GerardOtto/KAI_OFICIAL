# -*- coding: utf-8 -*-
"""Piezas comunes del cargador de rankings externos.

Una **instantánea** es una edición de un ranking tal como la publicó su fuente,
reducida a las universidades chilenas y escrita en el vocabulario de la base: el
nombre de la universidad es el de la tabla `universidad`, la métrica es la de la
tabla `metrica` y el puntaje total se llama «Puntaje total». Vive en

    datos/rankings/<ranking>/<edición>.csv    una fila por universidad y métrica
    datos/rankings/<ranking>/<edición>.json   de dónde salió y qué se comprobó

y se versiona: es lo que se revisa en el PR mensual y lo que el cargador escribe en
la base. Así la base se puede reconstruir sin volver a la red, y cada cifra tiene
un origen que se puede auditar.
"""
from __future__ import annotations

import csv
import hashlib
import json
import random
import sys
import time
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
INSTANTANEAS = RAIZ / "datos" / "rankings"
# Lo descargado, tal cual: no se versiona (lo ignora `KAI/Datos reales/*/raw/`).
CRUDOS = RAIZ / "KAI" / "Datos reales" / "rankings" / "raw"

sys.path.append(str(RAIZ / "tools" / "recoleccion"))
import navegador  # noqa: E402  (alias de universidades, compartidos con la recolección)

TOTAL = "Puntaje total"
COLUMNAS = ["ranking", "edicion", "disciplina", "universidad", "nombre_fuente", "posicion",
            "metrica", "valor", "origen"]

# Cada ranking que el cargador conoce: carpeta de sus instantáneas y nombre en la base.
RANKINGS = {
    "the-latam": "THE Latam",
    "qs-latam": "QS Latam",
    "qs-global": "QS Global",
    "shanghai-arwu": "Shanghai ARWU",
    "shanghai-gras": "Shanghai GRAS",
}

# Un navegador real: algunas fuentes responden 403 a un cliente que se anuncia como
# guion. No se usa para esquivar protecciones: QS y SCImago Institutions Rankings
# están detrás de un desafío de Cloudflare y el cargador no intenta pasarlo.
CABECERAS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"),
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
}


@dataclass(frozen=True)
class Fila:
    ranking: str
    edicion: int
    disciplina: str
    universidad: str
    nombre_fuente: str
    posicion: str
    metrica: str
    valor: float
    # «publicado»: la cifra tal como la da la fuente. «calculado»: el puntaje total
    # que la fuente no publica para esa universidad y que se obtuvo con su método.
    origen: str = "publicado"


class ErrorDeFuente(Exception):
    """La fuente no entregó lo esperado: se informa y no se escribe nada."""


def ahora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def numero(valor) -> float | None:
    """Un número de la fuente, o None si es un hueco («-», «n/a», vacío)."""
    if valor is None:
        return None
    texto = str(valor).strip().replace(",", "").replace("%", "").replace("=", "")
    if not texto or texto.lower() in {"-", "—", "n/a", "na", "null", "none"}:
        return None
    try:
        return float(texto)
    except ValueError:
        return None


def forma(texto: str) -> str:
    """Forma comparable de un rótulo: sin tildes, sin puntuación, en minúsculas."""
    plano = "".join(c for c in unicodedata.normalize("NFD", str(texto or ""))
                    if unicodedata.category(c) != "Mn")
    return " ".join("".join(ch if ch.isalnum() else " " for ch in plano.lower()).split())


def resolvedor():
    """Nombre de la fuente -> nombre de la tabla `universidad`, o None."""
    return navegador.resolvedor()


# --- Red ---------------------------------------------------------------------

def descargar(url: str, destino: Path, pausa: float = 1.0, permitir_404: bool = False) -> bytes | None:
    """Descarga con caché en `CRUDOS`. Devuelve el contenido, o None si la fuente
    respondió 404 y `permitir_404` (una edición que todavía no se publica)."""
    import requests

    destino = CRUDOS / destino
    if destino.exists() and destino.stat().st_size > 0:
        return destino.read_bytes()
    destino.parent.mkdir(parents=True, exist_ok=True)
    # Tres intentos con espera creciente: una conexión cortada a la mitad de las
    # 570 materias de GRAS no debe tirar la revisión entera.
    for intento in range(3):
        time.sleep(pausa * (3 ** intento) + random.uniform(0, pausa / 2))
        try:
            respuesta = requests.get(url, headers=CABECERAS, timeout=90)
        except (requests.ConnectionError, requests.Timeout) as e:
            ultimo = f"sin respuesta ({type(e).__name__})"
            continue
        if respuesta.status_code == 404 and permitir_404:
            return None
        if respuesta.status_code >= 500:
            ultimo = f"respondió {respuesta.status_code}"
            continue
        if respuesta.status_code != 200:
            raise ErrorDeFuente(f"{url} respondió {respuesta.status_code}")
        # Se escribe aparte y se renombra: un archivo a medio escribir en la caché
        # se leería después como si fuera la respuesta completa.
        temporal = destino.with_suffix(destino.suffix + ".parcial")
        temporal.write_bytes(respuesta.content)
        temporal.replace(destino)
        return respuesta.content
    raise ErrorDeFuente(f"{url} {ultimo} tras tres intentos")


def sha256(contenido: bytes) -> str:
    return hashlib.sha256(contenido).hexdigest()


# --- Instantáneas ------------------------------------------------------------

def ruta_instantanea(clave: str, edicion: int) -> Path:
    return INSTANTANEAS / clave / f"{edicion}.csv"


def ediciones_guardadas(clave: str) -> list[int]:
    carpeta = INSTANTANEAS / clave
    return sorted(int(p.stem) for p in carpeta.glob("*.csv") if p.stem.isdigit())


def _orden(f: Fila):
    # Orden estable, para que el diff de una instantánea nueva se lea fila a fila.
    return (f.disciplina, f.universidad, f.metrica != TOTAL, f.metrica)


def escribir_instantanea(clave: str, edicion: int, filas: list[Fila], meta: dict) -> Path:
    ruta = ruta_instantanea(clave, edicion)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with ruta.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(COLUMNAS)
        for fila in sorted(filas, key=_orden):
            w.writerow([fila.ranking, fila.edicion, fila.disciplina, fila.universidad,
                        fila.nombre_fuente, fila.posicion, fila.metrica,
                        f"{fila.valor:.4f}".rstrip("0").rstrip("."), fila.origen])
    ruta.with_suffix(".json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return ruta


def leer_instantanea(clave: str, edicion: int) -> tuple[list[Fila], dict]:
    ruta = ruta_instantanea(clave, edicion)
    filas = []
    with ruta.open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            filas.append(Fila(r["ranking"], int(r["edicion"]), r["disciplina"], r["universidad"],
                              r["nombre_fuente"], r["posicion"], r["metrica"], float(r["valor"]),
                              r["origen"]))
    meta_ruta = ruta.with_suffix(".json")
    meta = json.loads(meta_ruta.read_text(encoding="utf-8")) if meta_ruta.exists() else {}
    return filas, meta
