# Plan de desarrollo para Claude Code: recolección de datos reales para revertir métricas

> **Destinatario: Claude Code** (extensión de VS Code, corriendo en el equipo local
> del equipo KAI). No es un documento para humanos. Síguelo en orden, fase por fase.
> Cada tarea tiene objetivo, fuente, método, salida y criterio de término. Cuando
> una tarea diga **PREGUNTAR**, detente y consulta al usuario antes de seguir.

---

## 0. Contexto que debes cargar antes de empezar

1. Lee completo `docs/estudio-desnormalizacion-rankings.md`. Es el estudio previo.
   Las §5 ("Qué falta") y §6 ("Enfoque realista") definen qué datos buscamos y por qué.
2. Lee `tools/desnormalizacion/estimar_valores_pucv.py` y ejecútalo para ver la línea base:
   `python tools/desnormalizacion/estimar_valores_pucv.py`.
3. Lee estos scrapers existentes. **Reutiliza sus patrones; no los reescribas desde cero:**
   - `tools/scopus_scraper/scopus_scraper_pro.py`: Selenium con login manual,
     cookies copiadas entre ventanas vía CDP (`Network.getAllCookies` / `Network.setCookie`),
     trabajadores en paralelo, CSV incremental reanudable y `--debug-author`.
   - `KAI/THE/Código y outputs/the_university_rankings_full_Chile.py`: endpoint JSON de THE
     `https://www.timeshighereducation.com/json/ranking_tables/world_university_rankings/{year}`
     y `/{year}/key_statistics`.
   - `KAI/Scimago/Scimago_completo.ipynb`: scraping de `https://www.scimagoiber.com/institution.php?id={i}`
     leyendo la línea JavaScript `var data=` (columnas `years;idp;lang;excel_lider;...`).
   - `KAI/SHANGHAI/main.js`: API pública `shanghairanking.com/api/pub/v1/...` (solo como referencia de estilo).
4. Tabla de universidades: la fuente de verdad de nombres e IDs es la tabla `universidad`
   de `backend/backup.sql` (58 universidades chilenas). El mapeo de nombres en inglés de THE
   ya existe en `THE_A_DB`, dentro de `tools/desnormalizacion/estimar_valores_pucv.py`.

**Objetivo global:** conseguir los **valores reales** (numeradores y denominadores) de
las métricas cuantitativas de THE, QS y Scimago para **todas** las universidades
chilenas de la BD, con la PUCV como institución prioritaria. Las métricas de encuestas
de reputación quedan **fuera del alcance**.

---

## 1. Reglas de trabajo (obligatorias)

1. **Nunca inventes un número.** Si un dato no se puede obtener, déjalo vacío y anota
   la razón en el manifiesto (§3). Un valor estimado debe llevar `metodo = "estimado"`
   y la fórmula que usaste.
2. **Guarda siempre el archivo crudo** (HTML, JSON, XLSX, PDF o CSV descargado) antes
   de procesarlo. Así se puede reprocesar sin volver a descargar.
3. **Sé cortés con los servidores:** pausa aleatoria de 1 a 3 s entre peticiones,
   máximo 2 navegadores en paralelo contra un mismo dominio, caché local (no descargues
   dos veces el mismo recurso) y un `User-Agent` de navegador real, como en los scrapers
   existentes.
4. **Credenciales:** nunca escribas contraseñas, tokens, cookies ni claves de API en
   archivos versionados. Si hace falta una clave, léela de una variable de entorno o de
   `.env`, que ya está en `.gitignore`. Las cookies de sesión viven solo en memoria.
5. **Login institucional (Scopus, SciVal):** el usuario hace el login a mano en una
   ventana visible. **PREGUNTAR** antes de cualquier tarea que lo requiera. Nunca
   automatices el formulario de credenciales.
6. **Entorno:** probablemente Windows, con rutas que tienen espacios y tildes
   (`KAI/THE/Código y outputs`). Usa `pathlib`, abre archivos con `encoding="utf-8"` y
   escribe los CSV con `utf-8-sig` para que Excel los lea bien. El navegador es Chrome o
   un Chromium configurable (`--browser-binary`, p. ej. OperaGX, como en el scraper de Scopus).
7. **Commits:** uno por tarea terminada, con mensaje en español. No subas los datos
   crudos pesados (más de 20 MB): déjalos en `KAI/Datos reales/**/raw/` y agrega esa ruta
   al `.gitignore` si alguno supera ese tamaño. **PREGUNTAR** antes de hacer push.
8. **No modifiques `backend/backup.sql`** ni la BD en esta fase. La carga a la BD se hace
   en la Fase 5, con migraciones y solo tras confirmación.

---

## 2. Cómo acceder a cada sitio (árbol de decisión)

Para cada fuente, prueba en este orden y quédate con el primer método que funcione:

**A. Herramientas web de Claude Code (`WebFetch` / `WebSearch`)**
Sirven para leer una página, ubicar enlaces de descarga o verificar una cifra. Si
`WebFetch` devuelve el contenido, úsalo para **encontrar URLs**, pero descarga los
archivos con un script (B), porque WebFetch resume y no entrega el dato íntegro.

**B. Script Python con `requests`**
Úsalo cuando el recurso es un archivo directo (XLSX, CSV o PDF) o un endpoint JSON
conocido. Pruébalo primero con una sola URL. Si responde 200 con el contenido esperado,
este es el método.

**C. Selenium + Chrome DevTools Protocol (CDP)**
Úsalo si la página se arma con JavaScript, si `requests` recibe 403 o un HTML vacío,
o si no conoces el endpoint de datos. Es el mismo stack que ya usa
`scopus_scraper_pro.py`. El patrón:

1. Levanta Chrome con registro de red:
   ```python
   opts.set_capability("goog:loggingPrefs", {"performance": "ALL"})
   driver.execute_cdp_cmd("Network.enable", {})
   ```
2. Navega a la página y espera a que cargue la tabla o los datos.
3. Lee `driver.get_log("performance")`, filtra los eventos `Network.responseReceived`
   cuyo `mimeType` sea `application/json` y cuya URL contenga el patrón buscado, y
   obtén el cuerpo con
   `driver.execute_cdp_cmd("Network.getResponseBody", {"requestId": ...})`.
4. **Objetivo del paso C:** descubrir el endpoint JSON real. Una vez que lo conozcas,
   anota la URL y sus parámetros en el manifiesto y pasa al método B para el resto de
   las descargas. Mantén Selenium solo si el endpoint exige cookies o tokens de sesión.
   En ese caso, copia las cookies del navegador a `requests.Session` (patrón
   `capture_all_cookies` del scraper de Scopus).

**D. Login manual + Selenium/CDP**
Solo para Scopus y SciVal. Abre un navegador visible, pide al usuario que inicie sesión
y presione ENTER en la terminal, captura las cookies vía CDP y continúa, igual que
`scopus_scraper_pro.py`. Si la sesión expira, detente limpiamente y avisa.

**E. Si nada funciona**
Documenta el intento (URL, método, código de respuesta, captura en
`KAI/Datos reales/<fuente>/debug/`) y pasa a la siguiente tarea. Al final, lista esos
casos en el reporte (§7) con la instrucción exacta para que un humano descargue el
archivo a mano y lo deje en la carpeta `raw/` correspondiente. Tus scripts deben poder
procesar un archivo dejado a mano en `raw/` sin volver a descargarlo.

### Módulo compartido que debes crear primero

`tools/recoleccion/navegador.py` con:
- `crear_driver(headless: bool, browser_binary: str | None, capturar_red: bool) -> webdriver.Chrome`,
  basada en `build_driver` de `scopus_scraper_pro.py` y con `goog:loggingPrefs` cuando
  `capturar_red=True`.
- `respuestas_json(driver, patron_url: str) -> list[dict]`: recorre el log de
  performance y devuelve `{"url", "status", "body"}` de cada respuesta JSON cuya URL
  contenga `patron_url`.
- `cookies_a_session(driver) -> requests.Session`: copia las cookies obtenidas con CDP
  `Network.getAllCookies` a una sesión de `requests`.
- `descargar(url, destino: Path, session=None) -> Path`: descarga con caché (no repite
  si el archivo existe), pausa aleatoria y registro en el manifiesto.
- `guardar_debug(driver, nombre)`: guarda HTML y captura de pantalla en `debug/`.

Agrega `tools/recoleccion/requirements.txt` con `selenium>=4.20`, `requests`, `pandas`,
`openpyxl`, `pypdf` y `beautifulsoup4`, y un `tools/recoleccion/README.md` breve con el
uso de cada script. Sigue el estilo del README de `tools/scopus_scraper`.

---

## 3. Estructura de salida y formato común

```
KAI/Datos reales/
├── <fuente>/                  # the, sies, qs, webometrics, scimago, openalex, scopus, scival, finanzas, anid, pucv
│   ├── raw/                   # archivos tal como se descargaron
│   ├── debug/                 # HTML y capturas de los intentos fallidos
│   ├── procesado.csv          # formato largo (ver abajo)
│   └── manifiesto.json        # una entrada por archivo crudo
└── valores_reales_chile.csv   # consolidado de todas las fuentes (Fase 5)
tools/recoleccion/
├── navegador.py
├── nombres_universidades.csv  # alias -> nombre_universidad de la BD
├── <fuente>.py                # un script por fuente, ejecutable e idempotente
├── consolidar.py
└── README.md
```

**`procesado.csv`** (formato largo, una fila por dato):

| columna | ejemplo |
|---|---|
| `fuente` | `sies` |
| `universidad` | `Pontificia Universidad Catolica de Valparaiso` (nombre exacto de la BD) |
| `anio_dato` | `2024` (año al que se refiere el dato) |
| `ventana` | `2020-2024` (para bibliometría; vacío si no aplica) |
| `variable` | `academicos_jce_doctorado` (snake_case, ver catálogo §4) |
| `valor` | `498.5` |
| `unidad` | `JCE` |
| `definicion` | texto corto con la definición exacta de la fuente |
| `url` | URL de origen |
| `fecha_descarga` | ISO 8601 |
| `metodo` | `requests` / `selenium_cdp` / `manual` / `estimado` |

**`manifiesto.json`**: lista con `{archivo, url, fecha_descarga, metodo, sha256, notas}`.

**`nombres_universidades.csv`**: columnas `alias, fuente, nombre_universidad`. Constrúyelo
a partir de la tabla `universidad` y de `THE_A_DB`. Cada script debe fallar con un mensaje
claro si encuentra una universidad chilena sin mapeo, en vez de descartarla en silencio.

---

## 4. Catálogo de variables objetivo

Cada variable alimenta una o más métricas. Prioridad: **P1** = desbloquea una métrica
completa; **P2** = mejora la precisión; **P3** = validación cruzada.

| variable | métricas que alimenta | prioridad |
|---|---|---|
| `estudiantes_fte`, `estudiantes_total`, `estudiantes_pregrado`, `estudiantes_posgrado`, `estudiantes_doctorado` | THE Student staff ratio; QS Faculty student ratio | P1 |
| `estudiantes_extranjeros` | THE International students; QS International students | P1 |
| `academicos_total`, `academicos_jce`, `academicos_jornada_completa`, `academicos_jornada_parcial` | THE SSR y denominadores de productividad y excelencia; QS FSR y PPF | P1 |
| `academicos_jce_doctorado`, `academicos_doctorado` | QS Staff with PhD | P1 |
| `academicos_extranjeros`, `academicos_jce_extranjeros` | THE International staff; QS International faculty | P1 |
| `titulados_pregrado`, `graduados_doctorado` | THE Doctorate/bachelor; THE Doctorate/staff | P1 |
| `ingresos_totales` | THE Institutional income | P1 |
| `ingresos_investigacion`, `ingresos_industria` (o proxy `montos_anid_adjudicados`) | THE Research income; THE Industry income | P2 |
| `publicaciones_scopus` (por año y tipo de documento) | THE Research productivity; QS Papers per faculty | P1 |
| `citas_scopus_ventana`, `citas_sin_autocitas` | QS Citations per paper | P2 |
| `fwci`, `fwci_p75`, `docs_top10_fwci`, `pct_colab_internacional` | THE Citation impact, Research strength, Research excellence, International co-authorship | P1 |
| `socios_irn_por_pais` (socio, país, papers conjuntos en 5 años) | QS International research network | P2 |
| `citas_en_patentes` | THE Patents | P3 |
| `webometrics_rank_mundial`, `webometrics_rank_visibilidad` | QS Web impact | P2 |
| `the_*` y `qs_*` (valores publicados por los rankings) | anclas de calibración | P1 |

---

## 5. Tareas por fase

### Fase 1: fuentes abiertas de rankings (sin login)

**T1.1 THE: key statistics y puntajes de todo el mundo**
- Objetivo: las estadísticas reales de **todas** las universidades del ranking, no solo
  las chilenas. Se necesitan para estimar μ y σ de la normalización CDF de THE (§3.1 del estudio).
- Método B: reutiliza `BASE_URL` del scraper THE existente. Descarga
  `/{year}/key_statistics` y la tabla de puntajes de cada edición de 2016 a 2026 **sin**
  filtrar por Chile. Guarda también los campos JSON que el scraper actual descarta:
  lista todas las claves (`stats_*`, `scores_*`, `*_rank`, `subjects_offered`, etc.) e
  inclúyelas.
- Repite para el ranking de América Latina
  (`/world-university-rankings/{year}/latin-america-university-rankings`, método C si el
  JSON no es evidente).
- Salida: `KAI/Datos reales/the/`.
- Terminado cuando: para 2026, `procesado.csv` tenga más de 2.000 universidades y la PUCV
  muestre `estudiantes_fte = 18070`, SSR `23.2` e internacionales `2 %`. Si no coinciden,
  hay un bug.

**T1.2 QS: datos de perfil y puntajes de todas las ediciones**
- Objetivo A: el **perfil** de cada universidad chilena en topuniversities.com (total
  students, international students, total faculty staff, domestic/international staff,
  con doctorado si aparece). Son datos reales con la definición de QS.
- Método C: abre `https://www.topuniversities.com/universities/pontificia-universidad-catolica-de-valparaiso`,
  captura el tráfico con CDP e identifica el endpoint o bloque JSON con las cifras
  ("University data" / "Students & staff"). Después aplica el método a todas las
  universidades chilenas. Las rutas de perfil (`path`) están en
  `KAI/QS/QS Latinoamérica/Datos QS Latinoamérica/datos_qs_latam_brutos.json`.
- Objetivo B: los puntajes por indicador de varias ediciones para Chile. **Ya están en el
  repo y solo hay que procesarlos:** QS Latam 2024, 2025 y 2026
  (`KAI/QS/DatosQS/QS LATAM/*.xlsx`) y QS World 2024–2027
  (`KAI/QS/DatosQS/QS global/*.xlsx`). La BD solo tiene Latam 2025. Descarga únicamente
  lo que falte (p. ej. Latam 2023). El endpoint de rankings que produjo
  `datos_qs_latam_brutos.json` (estructura `score_nodes`) se descubre con el método C en
  la página del ranking filtrada por Chile.
- Salida: `KAI/Datos reales/qs/`.
- Terminado cuando: la PUCV tenga `estudiantes_total`, `academicos_total` y
  `estudiantes_extranjeros` según QS, y los puntajes de al menos tres ediciones Latam.

**T1.3 Scimago: ventana nueva (2020–2024) y Excellence**
- Objetivo: la edición más reciente de SCImago Institutions Rankings (ventana 2020–2024,
  que coincide con la de THE 2026) para todas las instituciones chilenas, con el
  indicador `excel`.
- Método B: usa el patrón `var data=` de `KAI/Scimago/Scimago_completo.ipynb` con los IDs
  chilenos ya conocidos (`idp`; la PUCV es `1151`; la lista completa está en
  `KAI/Scimago/SCIMAGO-DATA/instituciones_chilenas_limpias.csv`). Si
  `scimagoiber.com` no entrega la ventana nueva, prueba `https://www.scimagoir.com/institution.php?idp={idp}`
  con el método C.
- Salida: `KAI/Datos reales/scimago/`.
- Terminado cuando: exista la ventana 2020–2024 para al menos 50 universidades y la
  ventana 2019–2023 de la PUCV reproduzca `output = 5052` y `excel = 616`.

**T1.4 Webometrics**
- Objetivo: la posición mundial y los subindicadores (visibilidad, transparencia,
  excelencia) de las universidades chilenas en las ediciones cercanas a QS Latam 2025 y 2026.
- Método: B o C sobre `https://www.webometrics.info/en/Latin_America/Chile`. Si la página
  pagina resultados, recórrelos todos. Si hay ediciones pasadas accesibles, guárdalas;
  si no, anota la edición vigente y su fecha.
- Salida: `KAI/Datos reales/webometrics/`.

### Fase 2: fuentes oficiales chilenas (sin login, archivos grandes)

**T2.1 SIES / mifuturo.cl: personal académico, matrícula y titulados.** Es la tarea más
importante de todo el plan.
- Objetivo: para cada universidad y año (2015–último disponible):
  - académicos (total, JCE, jornada, con doctorado, extranjeros);
  - matrícula (total, pregrado, posgrado, doctorado, extranjeros);
  - titulados (pregrado, magíster, doctorado).
- Fuente: el portal `https://www.mifuturo.cl`, sección "Bases de datos" (personal
  académico, matriculados, titulados). Usa el método A para ubicar las páginas y los
  enlaces de descarga actuales, que suelen ser XLSX o CSV por año o consolidados, y el
  método B para descargarlos.
- Procesamiento: los archivos son grandes, con microdatos o tablas por programa. Agrega
  por institución y año. Documenta en `definicion` cómo se calcula cada variable (p. ej.
  qué columnas suman JCE y cómo se identifica a un extranjero: nacionalidad distinta de
  chilena).
- Validación obligatoria (escribe un test en `tools/recoleccion/tests/`):
  - La PUCV debe tener ~650 JCE hacia 2022 y ~64 % de JCE con doctorado. Estos valores
    vienen de prensa; si difieren más de 10 %, **no** fuerces el ajuste: revisa tu
    agregación y reporta la diferencia.
  - Compara `estudiantes_total / academicos_jce` de SIES con el SSR que publica THE en
    T1.1 para las 30 universidades chilenas. Reporta la correlación y los casos que se
    alejan más de 25 %.
- Salida: `KAI/Datos reales/sies/`.

**T2.2 CNED INDICES (validación cruzada)**
- Fuente: `https://www.cned.cl`, sección INDICES (bases de instituciones). Método A para
  ubicar y B para descargar.
- Objetivo: las mismas variables de T2.1 cuando existan, más indicadores financieros si
  INDICES los publica. Úsalas como segunda fuente y reporta las diferencias con SIES.

**T2.3 Estados financieros**
- Objetivo: `ingresos_totales` por universidad y año y, si los estados lo desglosan,
  ingresos por aranceles, aportes estatales, investigación y servicios o venta a terceros.
- Fuentes, en este orden: (1) la Superintendencia de Educación Superior
  (`https://www.sesuperior.cl`, información financiera de las instituciones); (2) SIES,
  información financiera, si existe; (3) la página de transparencia o finanzas de cada
  universidad (PUCV: `https://vrafpucv.cl/df/`).
- Los estados suelen venir en PDF. Extrae el texto con `pypdf` y guarda las líneas
  relevantes con su página de origen. Si un PDF es escaneado, déjalo en `raw/` y
  repórtalo; no hagas OCR sin preguntar.
- Prioriza la PUCV y las 30 universidades del ranking THE. Moneda: CLP nominales del
  año. **No** conviertas a PPP en esta fase.

**T2.4 ANID: fondos de investigación adjudicados (proxy de research income)**
- Objetivo: montos adjudicados por institución y año, total y por instrumento
  (Fondecyt, Fondef, Anillos, Centros…), con una marca de "con empresa o industria"
  cuando el instrumento lo indique.
- Fuente: el repositorio o base de proyectos adjudicados que publica ANID. Usa el método
  A para ubicar la base descargable más reciente; ANID suele publicarla en su sitio o en
  su GitHub oficial.
- Salida: `KAI/Datos reales/anid/`.

### Fase 3: bibliometría abierta (sin login)

**T3.1 OpenAlex para todas las universidades chilenas**
- API pública: `https://api.openalex.org`. Agrega `mailto=` con un correo del proyecto
  (**PREGUNTAR** cuál usar) para entrar al pool cortés.
- Pasos:
  1. Resuelve el ID OpenAlex o ROR de cada universidad con
     `/institutions?filter=country_code:CL,type:education`.
  2. Para cada universidad y ventana (2018–2022, 2019–2023, 2020–2024), usa
     `/works?filter=institutions.id:{id},publication_year:{a}-{b}&group_by=type` para
     obtener los conteos por tipo de documento.
  3. Para la PUCV, y luego para las demás universidades, recorre los trabajos
     (`cursor=*`, `per_page=200`) y calcula:
     - citas dentro de ventana, a partir de `counts_by_year`, con la ventana de QS;
     - porcentaje con coautor de otro país (`authorships[].countries`);
     - socios institucionales con 3 o más trabajos conjuntos en 5 años, con su país
       (insumo para IRN: número de países L y de socios P).
- Salida: `KAI/Datos reales/openalex/`.
- Validación: los trabajos únicos 2019–2023 de la PUCV deben ser ~5.900 (dato del estudio,
  §4.4). Calcula el factor Scopus/OpenAlex por universidad usando la ventana 2019–2023
  de Scimago.

### Fase 4: bibliometría con licencia (login manual)

**PREGUNTAR** antes de empezar: ¿hay acceso institucional a Scopus y a SciVal desde este
equipo? ¿Hay una API key de Elsevier (`dev.elsevier.com`) en una variable de entorno? Si
hay API key, usa la API (método B con cabecera `X-ELS-APIKey`) en vez de Selenium.

**T4.1 Scopus: conteos de documentos por universidad, año y tipo**
- Objetivo: `publicaciones_scopus` para cada universidad chilena, por año (2015–2025) y
  tipo de documento (Article, Review, Conference Paper, Book, Book Chapter, Other).
- Método D: búsqueda avanzada `AF-ID({afid}) AND PUBYEAR = {y}`. Lee el total de
  resultados y el desglose por "Document type" del panel lateral. Los AF-ID conocidos
  están en los nombres de archivo de
  `KAI/Reuniones KAI/Reunión 20-05-26/Gerard/Datos SCOPUS/Colaboración Académica SCOPUS/`
  (p. ej. U. de Chile `60012464`, PUC `60029681`, UNAB `60002636`, USACH `60023383`,
  UV `60008781`). Resuelve los faltantes, incluido el de la PUCV, con la búsqueda de
  afiliaciones de Scopus y guárdalos en `nombres_universidades.csv`.
- Con API: `https://api.elsevier.com/content/search/scopus?query=AF-ID(...)&count=0`
  devuelve `opensearch:totalResults`.

**T4.2 Scopus: coautorías por país (IRN)**
- Objetivo: para la PUCV, y luego para el resto, las instituciones socias con 3 o más
  documentos conjuntos en la ventana QS vigente, con su país.
- Método D: en los resultados de `AF-ID(pucv) AND PUBYEAR > {a-1} AND PUBYEAR < {b+1}`,
  usa "Analyze results" y exporta por país y por afiliación, o la vista de afiliaciones
  colaboradoras. Guarda las exportaciones en `raw/`.

**T4.3 SciVal (si hay licencia)**
- Objetivo: para cada universidad chilena, con ventanas 2019–2023 y 2020–2024: Scholarly
  Output, FWCI, percentil 75 del FWCI (si SciVal lo entrega), Outputs in Top 10 %
  (field-weighted), % de colaboración internacional, citas en patentes (módulo Economic
  Impact) y número de autores.
- Método D: navega por Overview y Benchmarking con las instituciones chilenas
  seleccionadas y usa la **exportación nativa** de SciVal (CSV/XLSX). Automatiza solo los
  clics necesarios para exportar; no raspes la pantalla si existe exportación.
- Salida: `KAI/Datos reales/scival/`.
- Validación: la PUCV 2019–2023 debe quedar cerca de Scimago (output ~5.000, colaboración
  internacional ~56 %, FWCI ~0,9). Reporta las diferencias.

### Fase 5: integración, calibración y reporte

**T5.1 Consolidar**
- `tools/recoleccion/consolidar.py` une todos los `procesado.csv` en
  `KAI/Datos reales/valores_reales_chile.csv` y genera la tabla ancha
  `valores_reales_chile_ancho.csv`: una fila por universidad y año, una columna por variable.
- Detecta conflictos entre fuentes para una misma variable, universidad y año, y deja
  ambos valores con su fuente. **No** elijas uno en silencio.

**T5.2 Recalcular métricas crudas**
- Con los datos consolidados, calcula el valor crudo de cada métrica con la fórmula del
  ranking, según `docs/estudio-desnormalizacion-rankings.md` §3 y los PDF de metodología
  de `KAI/THE` y `KAI/Reuniones KAI`. Genera `metricas_crudas_chile.csv` con columnas
  `ranking, metrica, universidad, edicion, valor_crudo, formula, variables_usadas`.

**T5.3 Calibración (desnormalización)**
- **QS:** por indicador y edición, ajusta una recta `puntaje = a + b·valor_crudo` usando
  como anclas las universidades con dato real de QS (T1.2). Excluye los puntajes de 90 o
  más. Reporta R², residuos y la recta.
- **THE:** con los datos mundiales de T1.1, verifica la hipótesis de normalización CDF.
  THE no publica sub-puntajes, así que usa los pilares cuyas métricas quedan casi
  completas con datos reales. Si no alcanza, reporta que no es verificable y por qué.
- **Scimago:** confirma que los valores de la BD coinciden con la descarga nueva.

**T5.4 Actualizar la plataforma (PREGUNTAR antes)**
- Propón migraciones en `backend/migraciones/` siguiendo la numeración y el README
  existentes para:
  1. cargar Scimago Excellence (id 33);
  2. cargar los key statistics de THE como valores reales;
  3. marcar en el modelo si un valor es "puntaje" o "valor real".

  Muestra el SQL al usuario antes de aplicarlo.

**T5.5 Reporte final**
- Actualiza `docs/estudio-desnormalizacion-rankings.md`: la §4 con los valores nuevos, y
  la §5 tachando lo resuelto y dejando lo pendiente con la razón.
- Actualiza `tools/desnormalizacion/estimar_valores_pucv.py` para que lea de
  `KAI/Datos reales/` cuando exista el dato y marque "estimado" solo cuando no exista.
- Crea `docs/solicitud-datos-pucv.md`: un borrador para la unidad de la PUCV que envía
  datos a THE y QS. Debe listar solo los datos que **siguen faltando** tras este plan
  (con definición THE o QS de cada uno) y los reportes de retorno de THE y QS.

---

## 6. Orden de ejecución y puntos de control

1. Fase 0 (§0) y módulo compartido (§2) → commit.
2. T1.1 → T1.3 → T1.2 → T1.4. Commit por tarea.
3. T2.1 (prioridad máxima) → T2.3 → T2.4 → T2.2.
4. T3.1.
5. **PREGUNTAR** por el acceso y ejecutar la Fase 4 si procede.
6. Fase 5.

Reporta al usuario, en 3 a 5 líneas, al terminar cada fase: qué quedó, qué falló y qué
necesitas de él. No esperes al final para avisar de un bloqueo.

## 7. Formato del reporte final al usuario

1. Una tabla por métrica cuantitativa (THE, QS, Scimago) con el estado (`real`,
   `estimado` o `falta`), la fuente y la cobertura (n.º de universidades y años).
2. Los valores de la PUCV antes (estudio previo) y después.
3. Los resultados de calibración (T5.3).
4. Las descargas manuales pendientes: URL exacta, qué archivo bajar y en qué carpeta
   `raw/` dejarlo.
5. Los datos que solo la PUCV puede entregar (enlaza a `docs/solicitud-datos-pucv.md`).
