"""
scopus_scraper_pro.py
======================
Scraper paralelo de perfiles de autor en Scopus. Reemplaza a scopus_hindex_scraper.py:
en vez de abrir un solo navegador y visitar los perfiles uno por uno (~2-4 seg/autor
+ el tiempo de carga de cada página, todo en serie), este script:

  1. Abre UN navegador para que hagas el login institucional manualmente una sola vez.
  2. Copia esa sesión (cookies) a N navegadores worker que corren en paralelo
     (hilos), cada uno procesando autores de una cola compartida.
  3. Extrae todos los datos disponibles en la cabecera del perfil (no solo el
     h-index): documentos, citas, h-index, nombre, afiliación actual, ORCID y
     áreas temáticas.
  4. Escribe cada resultado a un CSV apenas se obtiene (un solo hilo "writer"
     centraliza la escritura, así no hay condiciones de carrera ni riesgo de
     corromper el archivo si se corta la ejecución a mitad de camino).
  5. Al terminar (o si lo interrumpes con Ctrl+C), genera además un .xlsx a
     partir del CSV para compartir/abrir directamente en Excel.
  6. Es reanudable: si vuelves a correrlo, autores que ya están en el CSV de
     salida se saltan automáticamente.

REQUISITOS
----------
    pip install -r requirements.txt   (selenium, openpyxl)

    Selenium 4 resuelve el chromedriver automáticamente (Selenium Manager),
    ya no hace falta descargarlo ni apuntar una ruta a mano. Por defecto usa
    Google Chrome; si quieres usar OperaGX u otro navegador basado en Chromium,
    pasa su ejecutable con --browser-binary.

USO
---
    python scopus_scraper_pro.py --input autores.xlsx --output resultados.csv

    Columnas esperadas en el archivo de entrada (xlsx o csv): una columna con
    el Scopus Author ID (por defecto autodetecta una columna llamada
    "Auth-ID" / "author_id" / "id", o usa --id-column para indicarla a mano)
    y opcionalmente una columna "nombre" / "name" / "author_name".

    Otras opciones útiles:
      --workers 6          número de navegadores en paralelo (default 4)
      --headless            corre los workers sin ventana visible (más rápido)
      --delay-min / --delay-max   pausa aleatoria entre requests por worker
      --debug-author 12345  guarda el HTML completo de un perfil para poder
                             ajustar los selectores si Scopus cambia su UI

El script guarda progreso constantemente: si se interrumpe (Ctrl+C, corte de
sesión, etc.) puedes volver a correr el mismo comando y sigue donde quedó.
"""

from __future__ import annotations

import argparse
import csv
import random
import re
import sys
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from queue import Empty, Queue
from typing import Optional

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import TimeoutException, WebDriverException, NoSuchWindowException
except ImportError:
    sys.exit("Instala selenium primero:  pip install -r requirements.txt")

try:
    import openpyxl
except ImportError:
    sys.exit("Instala openpyxl primero:  pip install -r requirements.txt")


BASE_URL = "https://www.scopus.com/authid/detail.uri?authorId={}"
DOMAIN_URL = "https://www.scopus.com"
PAGE_TIMEOUT = 30
MAX_RETRIES = 3

# El <h1> de la página de perfil de Scopus a veces es un encabezado de sección
# genérico ("Author details") en vez del nombre real del autor. Cualquier
# texto que caiga en esta lista se descarta como si no se hubiera encontrado
# nombre, en vez de aceptarlo como si fuera válido.
NAME_BLOCKLIST = {"author details", "author profile", "authors", "scopus preview", "scopus"}

CSV_FIELDS = [
    "author_id",
    "author_name",
    "afiliacion_actual",
    "orcid",
    "areas_tematicas",
    "topicos_json",
    "documentos",
    "citas",
    "h_index",
    "metricas_extra_json",
    "status",
    "error",
    "scraped_at",
]


# ──────────────────────────────────────────────
# MODELO DE RESULTADO
# ──────────────────────────────────────────────

@dataclass
class ScrapeResult:
    author_id: str
    author_name: str = ""
    afiliacion_actual: str = ""
    orcid: str = ""
    areas_tematicas: str = ""
    topicos_json: str = "[]"
    documentos: Optional[str] = None
    citas: Optional[str] = None
    h_index: Optional[str] = None
    metricas_extra_json: str = "{}"
    status: str = "ok"          # ok | not_found | session_expired | error
    error: str = ""
    scraped_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def as_row(self) -> dict:
        return {k: getattr(self, k) for k in CSV_FIELDS}


# ──────────────────────────────────────────────
# NAVEGADOR
# ──────────────────────────────────────────────

def build_driver(browser_binary: Optional[str], headless: bool) -> webdriver.Chrome:
    opts = Options()
    if browser_binary:
        opts.binary_location = browser_binary
    if headless:
        opts.add_argument("--headless=new")

    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1280,900")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)

    # Selenium 4 Manager resuelve el driver correcto automáticamente.
    driver = webdriver.Chrome(options=opts)
    driver.execute_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    )
    return driver


def inject_cookies(driver: webdriver.Chrome, cookies: list[dict]) -> tuple[int, int]:
    """Copia la sesión autenticada de un navegador a otro.

    Scopus reparte las cookies de sesión entre varios dominios (scopus.com,
    elsevier.com, dominios de SSO institucional). El `add_cookie()` estándar
    de Selenium exige estar navegando exactamente en el dominio de cada
    cookie para poder añadirla, lo que descarta en silencio cualquier cookie
    de un dominio distinto al que se visitó. Por eso usamos el protocolo CDP
    de Chrome (Network.setCookie), que puede fijar una cookie para cualquier
    dominio sin tener que navegar ahí primero.
    """
    driver.get(DOMAIN_URL)
    try:
        driver.execute_cdp_cmd("Network.enable", {})
    except WebDriverException:
        pass

    applied = 0
    for cookie in cookies:
        if not cookie.get("domain") or not cookie.get("name"):
            continue
        cdp_cookie = {
            "name": cookie["name"],
            "value": cookie.get("value", ""),
            "domain": cookie["domain"],
            "path": cookie.get("path", "/"),
            "secure": bool(cookie.get("secure", False)),
            "httpOnly": bool(cookie.get("httpOnly", False)),
        }
        if cookie.get("expiry"):
            cdp_cookie["expires"] = cookie["expiry"]
        if cookie.get("sameSite") in ("Strict", "Lax", "None"):
            cdp_cookie["sameSite"] = cookie["sameSite"]
        try:
            driver.execute_cdp_cmd("Network.setCookie", cdp_cookie)
            applied += 1
        except WebDriverException:
            continue

    driver.get(DOMAIN_URL)
    return applied, len(cookies)


def capture_all_cookies(driver: webdriver.Chrome) -> list[dict]:
    """El `get_cookies()` estándar de Selenium solo devuelve las cookies del
    dominio en el que el navegador está parado en ese momento — no las de
    todo el perfil. Como el login de Scopus reparte la sesión entre varios
    dominios (scopus.com, elsevier.com, SSO institucional), hay que capturar
    con CDP (Network.getAllCookies), que sí trae las cookies de todos los
    dominios visitados durante el login, sin importar en cuál quedamos parados."""
    try:
        driver.execute_cdp_cmd("Network.enable", {})
        result = driver.execute_cdp_cmd("Network.getAllCookies", {})
        return result.get("cookies", [])
    except WebDriverException:
        return driver.get_cookies()  # fallback best-effort si CDP no está disponible


def verify_authenticated(driver: webdriver.Chrome) -> bool:
    """Comprueba que la sesión inyectada realmente quedó autenticada,
    en vez de asumirlo y descubrirlo recién 1000 autores después."""
    driver.get(DOMAIN_URL)
    time.sleep(1.5)
    return not looks_like_login_redirect(driver)


# ──────────────────────────────────────────────
# EXTRACCIÓN
# ──────────────────────────────────────────────

def _text_or_none(driver, by, selector) -> Optional[str]:
    try:
        return driver.find_element(by, selector).text.strip() or None
    except Exception:
        return None


def ensure_valid_window(driver: webdriver.Chrome) -> None:
    """Muchos logins institucionales (SSO/Shibboleth) abren la autenticación en
    una ventana/pestaña nueva y cierran la original al terminar. Si eso pasa,
    Selenium queda apuntando a un handle de ventana que ya no existe aunque
    visualmente siga habiendo una ventana de Chrome abierta con Scopus. Este
    helper detecta esa situación y cambia el foco a la ventana viva."""
    try:
        _ = driver.current_window_handle
        return
    except (NoSuchWindowException, WebDriverException):
        pass

    handles = driver.window_handles
    if not handles:
        raise NoSuchWindowException("El navegador no tiene ninguna ventana abierta.")
    driver.switch_to.window(handles[-1])


def looks_like_login_redirect(driver: webdriver.Chrome) -> bool:
    url = driver.current_url.lower()
    return "signin" in url or "login" in url or "auth.elsevier" in url


def scrape_author(driver: webdriver.Chrome, author_id: str) -> ScrapeResult:
    result = ScrapeResult(author_id=author_id)
    url = BASE_URL.format(author_id.strip())
    driver.get(url)

    if looks_like_login_redirect(driver):
        result.status = "session_expired"
        result.error = "Redirigido a login: la sesión expiró o requiere reautenticación."
        return result

    wait = WebDriverWait(driver, PAGE_TIMEOUT)
    try:
        wait.until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, "span[data-testid='unclickable-count']"))
        )
        time.sleep(1.5)  # render dinámico de React
    except TimeoutException:
        result.status = "not_found"
        result.error = "Timeout esperando métricas (perfil vacío, privado o inexistente)."
        return result

    # ── Métricas de cabecera: Documentos, Citas, h-index (orden validado en
    # el perfil real de Scopus). Se guardan las 3 posiciones conocidas y,
    # además, cualquier métrica adicional que Scopus muestre se guarda en
    # metricas_extra_json para no perder datos si agregan una cuarta métrica.
    counts = driver.find_elements(By.CSS_SELECTOR, "span[data-testid='unclickable-count']")
    values = [c.text.strip() for c in counts]

    labels_conocidos = ["citas", "documentos", "h_index"]
    extra = {}
    for i, val in enumerate(values):
        if not re.match(r"^[\d.,]+$", val or ""):
            continue
        if i < len(labels_conocidos):
            setattr(result, labels_conocidos[i], val)
        else:
            extra[f"metrica_{i}"] = val
    if extra:
        import json as _json
        result.metricas_extra_json = _json.dumps(extra, ensure_ascii=False)

    # ── Nombre del autor. La página tiene DOS <h1>: uno oculto genérico
    # ("Author details") y, más abajo, el nombre real bajo
    # data-testid='author-profile-name'. Confirmado con debug-author contra
    # una página real (Scopus Preview, sin login).
    candidate = (
        _text_or_none(driver, By.CSS_SELECTOR, "[data-testid='author-profile-name']")
        or _text_or_none(driver, By.CSS_SELECTOR, "h1")
    )
    if candidate and candidate.strip().lower() not in NAME_BLOCKLIST:
        result.author_name = candidate
    else:
        result.author_name = ""

    # ── Afiliación actual. data-testid='authorInstitution' confirmado con
    # debug-author, pero su texto completo trae ruido de accesibilidad
    # ("The institution will open in a new tab"). El nombre real está en el
    # primer <span> dentro del link (a span:first-of-type); la ciudad/país
    # está en un <span> hijo directo del contenedor (hermano del link, no
    # anidado en él), lo que evita depender de nombres de clase con hash.
    institucion = _text_or_none(driver, By.CSS_SELECTOR, "[data-testid='authorInstitution'] a span:first-of-type")
    ubicacion = _text_or_none(driver, By.CSS_SELECTOR, "[data-testid='authorInstitution'] > span") or ""
    result.afiliacion_actual = (institucion + ubicacion) if institucion else (
        _text_or_none(driver, By.CSS_SELECTOR, "[data-testid='authorInstitution']") or ""
    )

    # ── ORCID (link con orcid.org en el href)
    try:
        orcid_el = driver.find_element(By.CSS_SELECTOR, "a[href*='orcid.org']")
        result.orcid = orcid_el.get_attribute("href") or ""
    except Exception:
        pass

    # ── Áreas temáticas: pestaña "Topics" (id="topics"), tabla de 3 columnas
    # (Topic, Author documents, Topic FWCI). Selector confirmado con
    # debug-author contra una sesión autenticada real: no hay data-testid
    # estable en las filas (solo hashes de CSS modules), así que nos
    # apoyamos en la estructura (tabla > fila > celdas) en vez de nombres de
    # clase, que sí pueden cambiar entre builds de Scopus.
    # Se guarda tanto un resumen legible (areas_tematicas) como el detalle
    # completo por topic (topicos_json) para no perder los sub-datos, que
    # son los que alimentan una tabla normalizada tipo cientifico_topico.
    try:
        tab = driver.find_element(By.ID, "topics")
        tab.click()
        panel = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "topics-panel"))
        )
        time.sleep(1.5)
        rows = panel.find_elements(By.CSS_SELECTOR, "table tbody tr")
        topics = []
        topic_details = []
        for row in rows:
            cells = row.find_elements(By.TAG_NAME, "td")
            if not cells:
                continue
            name = cells[0].text.strip()
            if not name:
                continue
            topics.append(name)
            detail = {"topico": name}
            if len(cells) > 1 and cells[1].text.strip().replace(",", "").isdigit():
                detail["autor_documentos"] = int(cells[1].text.strip().replace(",", ""))
            if len(cells) > 2:
                try:
                    detail["topico_fwci"] = float(cells[2].text.strip())
                except ValueError:
                    pass
            topic_details.append(detail)
        result.areas_tematicas = "; ".join(topics)
        if topic_details:
            import json as _json
            result.topicos_json = _json.dumps(topic_details, ensure_ascii=False)
    except Exception:
        pass  # el autor puede no tener pestaña de topics (perfil chico o sin datos de SciVal)

    if not result.h_index and not result.documentos and not result.citas:
        result.status = "not_found"
        result.error = "No se encontraron métricas en la página (perfil sin datos públicos)."

    return result


def dump_debug_html(driver: webdriver.Chrome, author_id: str, out_dir: Path) -> None:
    """Guarda el HTML completo de un perfil (y, si existe, de la pestaña
    'Topics' tras hacerle clic) para poder ajustar selectores manualmente
    si Scopus cambió su interfaz."""
    driver.get(BASE_URL.format(author_id))
    time.sleep(3)
    out_dir.mkdir(parents=True, exist_ok=True)
    html_path = out_dir / f"debug_{author_id}.html"
    html_path.write_text(driver.page_source, encoding="utf-8")
    png_path = out_dir / f"debug_{author_id}.png"
    driver.save_screenshot(str(png_path))
    print(f"Guardado:\n  {html_path}\n  {png_path}")

    try:
        topics_tab = driver.find_element(By.ID, "topics")
        topics_tab.click()
        time.sleep(3)
        topics_html_path = out_dir / f"debug_{author_id}_topics.html"
        topics_html_path.write_text(driver.page_source, encoding="utf-8")
        topics_png_path = out_dir / f"debug_{author_id}_topics.png"
        driver.save_screenshot(str(topics_png_path))
        print(f"  {topics_html_path}\n  {topics_png_path}")
    except Exception as e:
        print(f"  (no se encontró/pudo hacer clic en la pestaña 'Topics': {e})")


# ──────────────────────────────────────────────
# ENTRADA / SALIDA
# ──────────────────────────────────────────────

def load_pending_authors(input_path: Path, id_column: Optional[str], name_column: Optional[str]) -> list[tuple[str, str]]:
    """Devuelve [(author_id, author_name), ...] leyendo xlsx o csv."""
    rows: list[tuple[str, str]] = []

    def pick_column(headers: list[str], explicit: Optional[str], candidates: list[str]) -> Optional[int]:
        if explicit:
            for i, h in enumerate(headers):
                if h.strip().lower() == explicit.strip().lower():
                    return i
            sys.exit(f"No se encontró la columna '{explicit}' en {input_path.name}")
        for i, h in enumerate(headers):
            if h.strip().lower() in candidates:
                return i
        return None

    if input_path.suffix.lower() == ".csv":
        with open(input_path, encoding="utf-8-sig", newline="") as f:
            reader = csv.reader(f)
            headers = next(reader)
            id_idx = pick_column(headers, id_column, ["auth-id", "author_id", "id", "scopus_id"])
            name_idx = pick_column(headers, name_column, ["nombre", "name", "author_name", "author name"])
            if id_idx is None:
                sys.exit(f"No pude detectar la columna de Author ID en {input_path.name}. Usa --id-column.")
            for r in reader:
                if not r or not r[id_idx].strip():
                    continue
                name = r[name_idx].strip() if name_idx is not None and name_idx < len(r) else ""
                rows.append((r[id_idx].strip(), name))
    else:
        wb = openpyxl.load_workbook(input_path, read_only=True, data_only=True)
        ws = wb.active
        header_row = next(ws.iter_rows(min_row=1, max_row=1, values_only=True))
        headers = [str(h) if h else "" for h in header_row]
        id_idx = pick_column(headers, id_column, ["auth-id", "author_id", "id", "scopus_id"])
        name_idx = pick_column(headers, name_column, ["nombre", "name", "author_name", "author name"])
        if id_idx is None:
            sys.exit(f"No pude detectar la columna de Author ID en {input_path.name}. Usa --id-column.")
        for row in ws.iter_rows(min_row=2, values_only=True):
            if id_idx >= len(row) or not row[id_idx]:
                continue
            name = str(row[name_idx]) if name_idx is not None and name_idx < len(row) and row[name_idx] else ""
            rows.append((str(row[id_idx]).strip(), name))

    return rows


def load_already_scraped(output_path: Path) -> set[str]:
    if not output_path.exists():
        return set()
    done = set()
    with open(output_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("status") == "ok":
                done.add(row["author_id"])
    return done


class CsvWriterThread(threading.Thread):
    """Único hilo que escribe al CSV: evita condiciones de carrera entre
    workers y permite que la escritura sea incremental (append), así el
    progreso nunca se pierde si el proceso se corta a mitad de camino."""

    def __init__(self, output_path: Path, results_queue: "Queue[ScrapeResult | None]"):
        super().__init__(daemon=True)
        self.output_path = output_path
        self.results_queue = results_queue
        self.written = 0
        self._new_file = not output_path.exists()

    def run(self):
        with open(self.output_path, "a", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
            if self._new_file:
                writer.writeheader()
                f.flush()
            while True:
                item = self.results_queue.get()
                if item is None:
                    break
                writer.writerow(item.as_row())
                f.flush()
                self.written += 1
                self.results_queue.task_done()


# ──────────────────────────────────────────────
# WORKER
# ──────────────────────────────────────────────

def worker_loop(
    worker_id: int,
    work_queue: "Queue[tuple[str, str]]",
    results_queue: "Queue[ScrapeResult | None]",
    cookies: list[dict],
    browser_binary: Optional[str],
    headless: bool,
    delay_range: tuple[float, float],
    session_dead: threading.Event,
    print_lock: threading.Lock,
    progress: dict,
    progress_lock: threading.Lock,
):
    driver = None
    try:
        driver = build_driver(browser_binary, headless)
        applied, total = inject_cookies(driver, cookies)

        with print_lock:
            print(f"worker-{worker_id}: {applied}/{total} cookies inyectadas, verificando sesión...")

        if not verify_authenticated(driver):
            with print_lock:
                print(
                    f"worker-{worker_id}: la sesión NO quedó autenticada tras inyectar cookies "
                    f"({applied}/{total} aplicadas). Deteniendo esta corrida."
                )
            session_dead.set()
            return

        while not session_dead.is_set():
            try:
                author_id, author_name = work_queue.get_nowait()
            except Empty:
                break

            result = None
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    result = scrape_author(driver, author_id)
                    break
                except WebDriverException as e:
                    if attempt == MAX_RETRIES:
                        result = ScrapeResult(author_id=author_id, status="error", error=str(e))
                    else:
                        time.sleep(2 * attempt)

            # El nombre del archivo de entrada es la fuente más confiable (viene de
            # datos ya conocidos del equipo); el scrapeado de la página es best-effort
            # y solo queda si no había nombre en el archivo de entrada.
            if author_name:
                result.author_name = author_name

            if result.status == "session_expired":
                session_dead.set()

            results_queue.put(result)

            with progress_lock:
                progress["done"] += 1
                done, total = progress["done"], progress["total"]
            with print_lock:
                estado = {"ok": "OK", "not_found": "sin datos", "session_expired": "SESION EXPIRADA", "error": "ERROR"}[result.status]
                print(f"[{done:>5}/{total}] worker-{worker_id} | {author_id:<12} {author_name[:35]:<35} -> {estado}")

            work_queue.task_done()
            time.sleep(random.uniform(*delay_range))
    finally:
        if driver:
            driver.quit()


# ──────────────────────────────────────────────
# EXPORT FINAL A XLSX
# ──────────────────────────────────────────────

def export_xlsx(csv_path: Path, xlsx_path: Path) -> None:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Scopus"
    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        for row in reader:
            ws.append(row)
    wb.save(xlsx_path)
    print(f"XLSX generado: {xlsx_path.resolve()}")


# ──────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Scraper paralelo de perfiles de autor en Scopus.")
    parser.add_argument("--input", required=True, help="xlsx o csv con los Scopus Author ID a procesar")
    parser.add_argument("--output", default="scopus_resultados.csv", help="CSV de salida (se anexa/reanuda)")
    parser.add_argument("--id-column", default=None, help="Nombre exacto de la columna con el Author ID")
    parser.add_argument("--name-column", default=None, help="Nombre exacto de la columna con el nombre del autor")
    parser.add_argument("--workers", type=int, default=4, help="Navegadores en paralelo (default 4)")
    parser.add_argument("--headless", action="store_true", help="Corre los workers sin ventana visible")
    parser.add_argument("--browser-binary", default=None, help="Ruta a un ejecutable Chromium alternativo (p.ej. OperaGX)")
    parser.add_argument("--delay-min", type=float, default=1.0, help="Pausa mínima entre requests por worker (seg)")
    parser.add_argument("--delay-max", type=float, default=3.0, help="Pausa máxima entre requests por worker (seg)")
    parser.add_argument("--debug-author", default=None, help="Guarda el HTML/screenshot de un solo autor y sale")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    if not input_path.exists():
        sys.exit(f"No se encontró el archivo de entrada: {input_path.resolve()}")

    print("Iniciando navegador para login manual...")
    print("   Si Scopus pide login institucional, hazlo en la ventana y luego presiona ENTER aquí.\n")
    login_driver = build_driver(args.browser_binary, headless=False)
    login_driver.get(DOMAIN_URL)
    input("Presiona ENTER cuando hayas iniciado sesión y veas tu cuenta activa en Scopus... ")

    # El login institucional (SSO/Shibboleth) suele abrir la autenticación en una
    # ventana/pestaña nueva y cerrar la original al terminar. Eso deja a Selenium
    # apuntando a un handle de ventana que ya no existe, aunque visualmente siga
    # habiendo una ventana de Chrome abierta con Scopus. Por eso, antes de cada
    # intento nos aseguramos de estar en una ventana viva (ensure_valid_window)
    # antes de navegar y leer las cookies.
    cookies = None
    last_error = None
    for attempt in range(1, 4):
        try:
            ensure_valid_window(login_driver)
            login_driver.get(DOMAIN_URL)
            time.sleep(1.5)
            cookies = capture_all_cookies(login_driver)
        except (WebDriverException, NoSuchWindowException) as e:
            last_error = e
            print(f"   (intento {attempt}/3) {e.__class__.__name__}, reintentando...")
            time.sleep(1.5)
            continue
        if cookies:
            break
        print(f"   (intento {attempt}/3) no se capturó ninguna cookie todavía, reintentando...")
        time.sleep(1.5)

    if not cookies:
        try:
            login_driver.quit()
        except Exception:
            pass
        detalle = f" Último error: {last_error.__class__.__name__}: {last_error}" if last_error else ""
        sys.exit(
            "No se pudo capturar la sesión de Scopus tras 3 intentos." + detalle + "\n"
            "Si el login abrió una ventana/pestaña nueva y la original se cerró sola, eso ya "
            "está manejado — pero si sigue fallando, probablemente la ventana final quedó en "
            "un dominio distinto a scopus.com (por ejemplo sciencedirect.com u otro dominio de "
            "Elsevier). Verifica en qué URL terminó el login y avísame para ajustar DOMAIN_URL."
        )

    if args.debug_author:
        dump_debug_html(login_driver, args.debug_author, Path("debug_output"))
        try:
            login_driver.quit()
        except Exception:
            pass
        return

    try:
        login_driver.quit()
    except Exception:
        pass
    print(f"Sesión capturada ({len(cookies)} cookies). Cerrando navegador de login y lanzando {args.workers} workers...\n")

    all_authors = load_pending_authors(input_path, args.id_column, args.name_column)
    already_done = load_already_scraped(output_path)
    pending = [(aid, name) for aid, name in all_authors if aid not in already_done]

    print(f"Autores totales:  {len(all_authors)}")
    print(f"Ya procesados:    {len(already_done)}")
    print(f"Por procesar:     {len(pending)}\n")

    if not pending:
        print("No hay autores pendientes. Generando xlsx final igual...")
        export_xlsx(output_path, output_path.with_suffix(".xlsx"))
        return

    work_queue: Queue = Queue()
    for item in pending:
        work_queue.put(item)

    results_queue: Queue = Queue()
    writer_thread = CsvWriterThread(output_path, results_queue)
    writer_thread.start()

    session_dead = threading.Event()
    print_lock = threading.Lock()
    progress_lock = threading.Lock()
    progress = {"done": 0, "total": len(pending)}

    threads = []
    for i in range(args.workers):
        t = threading.Thread(
            target=worker_loop,
            args=(
                i + 1,
                work_queue,
                results_queue,
                cookies,
                args.browser_binary,
                args.headless,
                (args.delay_min, args.delay_max),
                session_dead,
                print_lock,
                progress,
                progress_lock,
            ),
            daemon=True,
        )
        threads.append(t)
        t.start()
        time.sleep(0.5)  # stagger de arranque para no saturar Scopus con N logins simultáneos

    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        print("\nInterrumpido por el usuario. Esperando a que los workers en curso terminen su autor actual...")
        session_dead.set()
        for t in threads:
            t.join()

    results_queue.put(None)
    writer_thread.join()

    print("\n" + "=" * 60)
    print("RESUMEN")
    print("=" * 60)
    print(f"  Filas escritas en esta corrida: {writer_thread.written}")
    if session_dead.is_set():
        print("  La sesión de Scopus no quedó autenticada o expiró durante la corrida.")
        print("  Revisa el login (misma cuenta/ventana abierta) y vuelve a correr el mismo")
        print("  comando: lo ya scrapeado con status=ok queda guardado y no se repite.")
    print(f"\nResultado (CSV, incremental): {output_path.resolve()}")

    export_xlsx(output_path, output_path.with_suffix(".xlsx"))


if __name__ == "__main__":
    main()
