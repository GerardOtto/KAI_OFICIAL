# Scopus Scraper Pro

Versión optimizada de `scopus_hindex_scraper.py`. Herramienta de recolección de
datos independiente de la app (no se despliega ni se importa desde `backend/`),
por eso vive en `tools/` con su propio `requirements.txt`.

## Qué cambia respecto al script original

| | Original | Pro |
|---|---|---|
| Navegadores | 1, secuencial | N en paralelo (hilos), configurable con `--workers` |
| Datos extraídos | solo h-index | h-index, documentos, citas, nombre, afiliación, ORCID, áreas temáticas, y cualquier métrica extra que aparezca |
| Driver | ChromeDriver 147 fijado a mano + ruta de OperaGX hardcodeada | Selenium Manager resuelve el driver solo; navegador configurable con `--browser-binary` |
| Guardado | reescribe el .xlsx completo después de cada autor | escribe a un .csv de forma incremental (un solo hilo escritor, sin condiciones de carrera); genera el .xlsx final al terminar |
| Reanudación | salta filas con h-index ya lleno en el mismo Excel | salta autores ya presentes con `status=ok` en el CSV de salida |
| Sesión expirada | sigue reintentando a ciegas | la detecta, corta la corrida limpiamente y te avisa que vuelvas a loguear |

## Instalación

```bash
pip install -r requirements.txt
```

Necesitas Google Chrome instalado (o cualquier navegador basado en Chromium,
pasando su ejecutable con `--browser-binary`, p. ej. OperaGX).

## Uso

```bash
python scopus_scraper_pro.py --input autores.xlsx --output resultados.csv
```

1. Se abre un navegador. Haz el login institucional a Scopus ahí manualmente.
2. Presiona ENTER en la terminal cuando estés logueado.
3. El script lanza los workers en paralelo, reutilizando esa sesión, y va
   imprimiendo el progreso de cada uno.
4. Al terminar, tendrás `resultados.csv` y `resultados.xlsx`.

Si lo interrumpes (Ctrl+C) o la sesión expira a mitad de camino, todo lo ya
scrapeado queda guardado en el CSV. Vuelve a correr el mismo comando: retoma
automáticamente desde donde quedó.

### Opciones principales

- `--workers N` — navegadores en paralelo (default 4). Cada uno consume
  ~300-500 MB de RAM; súbelo con cuidado según los recursos de tu máquina.
  Más workers también significa más requests/segundo contra Scopus, lo que
  puede aumentar el riesgo de bloqueo por rate-limiting.
- `--headless` — corre los workers sin ventana visible (más rápido, menos RAM
  de renderizado). El navegador de login siempre es visible porque necesitas
  interactuar con él.
- `--delay-min` / `--delay-max` — pausa aleatoria (segundos) entre autores por
  worker, para no golpear Scopus de forma perfectamente regular.
- `--id-column` / `--name-column` — si tu archivo de entrada no usa nombres de
  columna estándar (`Auth-ID`/`author_id`/`id`, `nombre`/`name`), indícalos.
- `--debug-author <id>` — en vez de correr todo, abre un solo perfil, guarda
  su HTML y una captura de pantalla en `debug_output/`. Útil si Scopus cambia
  su interfaz y hay que reajustar los selectores del script.

## Columnas del CSV/XLSX de salida

`author_id, author_name, afiliacion_actual, orcid, areas_tematicas,
documentos, citas, h_index, metricas_extra_json, status, error, scraped_at`

`status` puede ser `ok`, `not_found` (perfil sin datos públicos),
`session_expired` (hay que volver a loguear y re-correr) o `error`.

## Nota sobre los selectores de "afiliación actual" y "áreas temáticas"

El h-index/documentos/citas usan el selector `[data-testid='unclickable-count']`,
que es el que el equipo ya validó funcionando en el script original. Los
selectores de afiliación y áreas temáticas son best-effort: si Scopus cambió
su HTML y esos campos salen vacíos, usa `--debug-author` en un autor de
prueba, revisa el HTML guardado y ajusta los selectores correspondientes en
`scrape_author()` dentro de `scopus_scraper_pro.py`.
