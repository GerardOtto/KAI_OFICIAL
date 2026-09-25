# -*- coding: utf-8 -*-
"""Utilidades compartidas por los recolectores de datos reales.

Tres cosas que todos necesitan y que no conviene repetir en cada guion:

  * **Descarga con caché y manifiesto.** Un archivo que ya está en `raw/` no se
    vuelve a pedir, y de cada descarga queda constancia —URL, fecha, sha256— para
    poder reprocesar sin volver a la red y para saber de dónde salió cada cifra.

  * **Escritura del formato largo.** Todas las fuentes escriben el mismo
    `procesado.csv`, con una fila por dato, de modo que consolidarlas después sea
    concatenar y no traducir.

  * **Navegador con registro de red.** Solo hace falta cuando la página arma sus
    datos con JavaScript; el patrón es el del scraper de Scopus, del que se
    reutiliza la idea de capturar el tráfico y quedarse con el endpoint JSON.

Selenium se importa dentro de las funciones que lo usan: la mayoría de los
recolectores trabaja con `requests` y no tiene por qué exigir un navegador
instalado para ejecutarse.
"""
from __future__ import annotations

import csv
import hashlib
import json
import random
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

# Raíz de los datos recolectados. Las rutas llevan espacios y tildes: se manejan
# con pathlib y nunca por concatenación de cadenas.
RAIZ = Path(__file__).resolve().parents[2] / "KAI" / "Datos reales"

# Un navegador real. Varios de estos sitios responden 403 a un cliente que se
# anuncia como script.
CABECERAS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"),
    "Accept": "application/json, text/plain, text/html, */*",
    "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
}

# Cortesía con el servidor: pausa aleatoria entre peticiones.
PAUSA = (1.0, 3.0)

COLUMNAS = ["fuente", "universidad", "anio_dato", "ventana", "variable", "valor",
            "unidad", "definicion", "url", "fecha_descarga", "metodo"]


def ahora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def carpeta(fuente: str) -> Path:
    """Crea y devuelve `KAI/Datos reales/<fuente>/` con sus subcarpetas."""
    base = RAIZ / fuente
    for sub in ("raw", "debug"):
        (base / sub).mkdir(parents=True, exist_ok=True)
    return base


def esperar() -> None:
    time.sleep(random.uniform(*PAUSA))


# --- Manifiesto --------------------------------------------------------------

def _manifiesto(base: Path) -> Path:
    return base / "manifiesto.json"


def leer_manifiesto(fuente: str) -> list[dict]:
    ruta = _manifiesto(carpeta(fuente))
    if not ruta.exists():
        return []
    return json.loads(ruta.read_text(encoding="utf-8"))


def anotar(fuente: str, entrada: dict) -> None:
    """Añade una entrada al manifiesto, sustituyendo la del mismo archivo."""
    base = carpeta(fuente)
    registro = [e for e in leer_manifiesto(fuente) if e.get("archivo") != entrada.get("archivo")]
    registro.append(entrada)
    registro.sort(key=lambda e: e.get("archivo", ""))
    _manifiesto(base).write_text(json.dumps(registro, ensure_ascii=False, indent=2),
                                 encoding="utf-8")


def sha256(ruta: Path) -> str:
    h = hashlib.sha256()
    with ruta.open("rb") as f:
        for bloque in iter(lambda: f.read(1 << 16), b""):
            h.update(bloque)
    return h.hexdigest()


# --- Descarga ----------------------------------------------------------------

def descargar(url: str, destino: Path, fuente: str, session: requests.Session | None = None,
              notas: str = "", forzar: bool = False) -> Path | None:
    """Descarga `url` a `destino` si no está ya, y lo anota en el manifiesto.

    Devuelve la ruta del archivo, o None si la descarga falló. El fallo no es una
    excepción: varias fuentes tienen huecos —un año sin publicar, un perfil que no
    existe— y el recolector debe seguir con el siguiente y dejar constancia.
    """
    destino.parent.mkdir(parents=True, exist_ok=True)
    if destino.exists() and destino.stat().st_size > 0 and not forzar:
        return destino

    cliente = session or requests
    try:
        esperar()
        respuesta = cliente.get(url, headers=CABECERAS, timeout=90)
    except Exception as e:  # noqa: BLE001 - se informa y se sigue
        anotar(fuente, {"archivo": destino.name, "url": url, "fecha_descarga": ahora(),
                        "metodo": "requests", "sha256": None,
                        "notas": f"fallo: {type(e).__name__}: {e}"})
        return None

    if respuesta.status_code != 200 or not respuesta.content:
        anotar(fuente, {"archivo": destino.name, "url": url, "fecha_descarga": ahora(),
                        "metodo": "requests", "sha256": None,
                        "notas": f"HTTP {respuesta.status_code}, {len(respuesta.content)} bytes"})
        return None

    destino.write_bytes(respuesta.content)
    anotar(fuente, {"archivo": destino.name, "url": url, "fecha_descarga": ahora(),
                    "metodo": "requests", "sha256": sha256(destino),
                    "notas": notas or f"{len(respuesta.content)} bytes"})
    return destino


# --- Salida en formato largo -------------------------------------------------

def escribir_procesado(fuente: str, filas: list[dict], nombre: str = "procesado.csv") -> Path:
    """Escribe el formato largo común a todas las fuentes.

    Se usa `utf-8-sig` porque estos archivos se abren en Excel: sin la marca de
    orden de bytes, Excel interpreta los acentos como caracteres sueltos.
    """
    ruta = carpeta(fuente) / nombre
    with ruta.open("w", encoding="utf-8-sig", newline="") as f:
        escritor = csv.DictWriter(f, fieldnames=COLUMNAS, extrasaction="ignore")
        escritor.writeheader()
        for fila in filas:
            escritor.writerow({c: fila.get(c, "") for c in COLUMNAS})
    return ruta


def dato(fuente, universidad, variable, valor, *, anio_dato="", ventana="", unidad="",
         definicion="", url="", metodo="requests") -> dict:
    """Una fila del formato largo, con la fecha puesta."""
    return {"fuente": fuente, "universidad": universidad, "anio_dato": anio_dato,
            "ventana": ventana, "variable": variable, "valor": valor, "unidad": unidad,
            "definicion": definicion, "url": url, "fecha_descarga": ahora(),
            "metodo": metodo}


# --- Nombres de universidad --------------------------------------------------

ALIAS = Path(__file__).with_name("nombres_universidades.csv")


def mapa_de_nombres(fuente: str | None = None) -> dict[str, str]:
    """Alias de cada fuente -> nombre exacto de la tabla `universidad`."""
    if not ALIAS.exists():
        raise SystemExit(f"Falta {ALIAS}. Créalo con construir_nombres.py.")
    mapa = {}
    with ALIAS.open(encoding="utf-8-sig", newline="") as f:
        for fila in csv.DictReader(f):
            if fuente in (None, fila["fuente"]):
                mapa[fila["alias"].strip()] = fila["nombre_universidad"].strip()
    return mapa


def universidades_de_la_base() -> list[str]:
    """Los 58 nombres canónicos, leídos del propio archivo de alias."""
    with ALIAS.open(encoding="utf-8-sig", newline="") as f:
        return sorted({fila["nombre_universidad"].strip() for fila in csv.DictReader(f)})


def _forma(texto: str) -> str:
    """Forma comparable de un nombre: sin tildes, sin puntuación y en minúsculas."""
    import unicodedata
    plano = "".join(c for c in unicodedata.normalize("NFD", str(texto))
                    if unicodedata.category(c) != "Mn")
    return " ".join("".join(ch if ch.isalnum() else " " for ch in plano.lower()).split())


def resolvedor(fuente: str | None = None):
    """Devuelve una función nombre -> nombre canónico, tolerante a la forma.

    Las fuentes escriben el mismo nombre de maneras que no conviene enumerar una
    por una: el SIES en mayúsculas, QS con siglas entre paréntesis, THE en inglés.
    Los alias explícitos mandan; si no hay, se compara la forma normalizada, que
    resuelve mayúsculas y tildes sin inventar equivalencias entre nombres
    distintos.
    """
    exactos = mapa_de_nombres(fuente)
    por_forma = {_forma(a): destino for a, destino in exactos.items()}
    for canonico in {v for v in exactos.values()}:
        por_forma.setdefault(_forma(canonico), canonico)

    def resolver(nombre: str) -> str | None:
        limpio = " ".join(str(nombre or "").split())
        return exactos.get(limpio) or por_forma.get(_forma(limpio))

    return resolver


def sin_mapeo(nombres: list[str], fuente: str) -> list[str]:
    """Nombres de la fuente que no tienen equivalencia. Nunca se descartan en
    silencio: el guion debe avisar y el humano decidir si sobran o falta el alias."""
    mapa = mapa_de_nombres(fuente)
    return sorted(n for n in nombres if n not in mapa)


# --- Navegador (solo para las fuentes que lo necesiten) ----------------------

def crear_driver(headless: bool = True, browser_binary: str | None = None,
                 capturar_red: bool = False):
    """Chrome o Chromium con el protocolo de depuración, como en el scraper de Scopus."""
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options

    opts = Options()
    if headless:
        opts.add_argument("--headless=new")
    if browser_binary:
        opts.binary_location = browser_binary
    opts.add_argument("--window-size=1600,1000")
    opts.add_argument(f"--user-agent={CABECERAS['User-Agent']}")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    if capturar_red:
        # El registro de rendimiento es lo que deja ver las peticiones que hace la
        # página: es la vía para descubrir el endpoint JSON que sirve los datos.
        opts.set_capability("goog:loggingPrefs", {"performance": "ALL"})

    driver = webdriver.Chrome(options=opts)
    if capturar_red:
        driver.execute_cdp_cmd("Network.enable", {})
    return driver


def respuestas_json(driver, patron_url: str) -> list[dict]:
    """Respuestas JSON ya recibidas cuya URL contenga `patron_url`."""
    encontradas = []
    for entrada in driver.get_log("performance"):
        try:
            mensaje = json.loads(entrada["message"])["message"]
        except (KeyError, ValueError):
            continue
        if mensaje.get("method") != "Network.responseReceived":
            continue
        respuesta = mensaje["params"]["response"]
        url = respuesta.get("url", "")
        if patron_url not in url:
            continue
        if "json" not in (respuesta.get("mimeType") or ""):
            continue
        try:
            cuerpo = driver.execute_cdp_cmd(
                "Network.getResponseBody", {"requestId": mensaje["params"]["requestId"]})
        except Exception:  # noqa: BLE001 - el cuerpo caduca; se informa con None
            cuerpo = None
        encontradas.append({"url": url, "status": respuesta.get("status"),
                            "body": (cuerpo or {}).get("body")})
    return encontradas


def cookies_a_session(driver) -> requests.Session:
    """Copia el almacén completo de cookies del navegador a una sesión de requests.

    Se usa `Network.getAllCookies` y no la interfaz estándar de Selenium porque
    esta última solo devuelve las del dominio cargado, y varias de estas sesiones
    se establecen atravesando varios dominios.
    """
    sesion = requests.Session()
    sesion.headers.update(CABECERAS)
    for cookie in driver.execute_cdp_cmd("Network.getAllCookies", {}).get("cookies", []):
        sesion.cookies.set(cookie["name"], cookie["value"],
                           domain=cookie.get("domain"), path=cookie.get("path", "/"))
    return sesion


def guardar_debug(driver, fuente: str, nombre: str) -> None:
    """HTML y captura de un intento fallido, para poder mirarlo después."""
    base = carpeta(fuente) / "debug"
    (base / f"{nombre}.html").write_text(driver.page_source, encoding="utf-8")
    driver.save_screenshot(str(base / f"{nombre}.png"))
