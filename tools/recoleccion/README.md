# Recolección de datos reales

Guiones que reúnen los **valores reales** —numeradores y denominadores— detrás de
las métricas normalizadas de THE, QS y Scimago, para todas las universidades
chilenas de la base. El plan completo está en `docs/plan-agente-recoleccion-datos.md`
y el estudio que lo motiva, en `docs/estudio-desnormalizacion-rankings.md`.

La salida vive fuera de este directorio, en `KAI/Datos reales/<fuente>/`:

```
raw/            los archivos tal como se descargaron
debug/          HTML y capturas de los intentos que fallaron
procesado.csv   formato largo, una fila por dato
manifiesto.json una entrada por archivo: url, fecha, sha256, notas
```

## Reglas que siguen todos los guiones

- **Ningún número inventado.** Lo que no se puede obtener se deja vacío y se anota
  por qué. Un valor calculado lleva `metodo = "estimado"` y su fórmula.
- **Se guarda siempre el archivo crudo** antes de procesarlo, de modo que
  reprocesar no exija volver a la red. Cada guion acepta `--solo-procesar`.
- **Descarga con caché:** un archivo que ya está en `raw/` no se vuelve a pedir.
- **Cortesía con el servidor:** pausa aleatoria de 1 a 3 s y agente de usuario de
  navegador real.
- **Nombres:** `nombres_universidades.csv` traduce el nombre de cada fuente al de
  la tabla `universidad`. Si aparece uno sin equivalencia, el guion **avisa** en
  lugar de descartar la universidad en silencio.

## Guiones

| Guion | Tarea | Qué obtiene |
|---|---|---|
| `construir_nombres.py` | — | Reconstruye la tabla de alias desde la base o el volcado |
| `the.py` | T1.1 | Puntajes y estadísticas de THE, mundial 2016-2026 y Latinoamérica |
| `scimago.py` | T1.3 | Series de indicadores de las 57 instituciones chilenas, seis ventanas |
| `qs.py` | T1.2 | Puntajes por indicador de siete ediciones, de las hojas oficiales del repo |
| `webometrics.py` | T1.4 | Posición mundial y subindicadores (a la espera de que el sitio responda) |
| `sies.py` | T2.1 | Personal académico, titulados y matrícula de todas las IES chilenas |
| `anid.py` | T2.4 | Fondos de investigación adjudicados por institución y año |
| `openalex.py` | T3.1 | Producción, colaboración internacional y socios recurrentes |
| `scimago_ventana.py` | T1.3 | La edición nueva, por la exportación oficial tras Cloudflare |
| `consolidar.py` | T5.1 | Une todo, señala conflictos y calcula el factor OpenAlex/Scopus |
| `tests/test_sies.py` | T2.1 | Valida la agregación contra cifras públicas y contra THE |

`navegador.py` es el módulo común: descarga con caché y manifiesto, escritura del
formato largo, mapa de nombres y, para las fuentes que lo necesiten, un navegador
con registro de red (`crear_driver`, `respuestas_json`, `cookies_a_session`).

```bash
python tools/recoleccion/construir_nombres.py
python tools/recoleccion/the.py                 # ~15 min la primera vez
python tools/recoleccion/scimago.py             # ~4 min
python tools/recoleccion/qs.py                  # local, sin red
python tools/recoleccion/webometrics.py
python tools/recoleccion/sies.py               # ~55 MB la primera vez
python tools/recoleccion/anid.py
python tools/recoleccion/openalex.py           # ~25 min; reanudable
python tools/recoleccion/scimago_ventana.py    # abre una ventana de navegador
python tools/recoleccion/consolidar.py
python tools/recoleccion/tests/test_sies.py
python tools/recoleccion/the.py --solo-procesar # reprocesa sin descargar
```

## Estado y hallazgos de acceso

**THE.** El endpoint JSON `/json/ranking_tables/world_university_rankings/{año}`
sigue abierto y entrega la tabla mundial completa, con `key_statistics` aparte. La
tabla **latinoamericana no tiene endpoint**: viaja dentro del HTML, en el bloque
`__NEXT_DATA__`, y de ahí la extrae el guion. No hubo edición latinoamericana 2025:
tras la de 2024 vino la de 2026.

**Scimago.** Tres caminos probados, en este orden:

1. `scimagoir.com/institution.php?idp=…` — 200, pero la interfaz nueva ya **no
   publica los valores crudos**: muestra percentiles. Evidencia en `debug/`.
2. `scimagoir.com/rankings.php?...&out=xls` — **403**, protegido por Cloudflare. Un
   navegador visible lo pasaría; queda como descarga manual.
3. `scimagoiber.com/institution.php?id=…` — con el parámetro `id`, **no** `idp`,
   sigue devolviendo el bloque `var data=` con la serie histórica completa. Es el
   que usa el guion.

La serie 2014-2018 … 2019-2023 está completa, incluido el indicador `excel`, que
la base no tiene. Para la ventana **2020-2024** hay un cuarto camino, en
`scimago_ventana.py`: un navegador **visible** pasa el desafío de Cloudflare en
unos segundos, y sus cookies se copian a una sesión de `requests` para descargar
la exportación oficial. Con eso entran 42 universidades.

Pero esa exportación **ya no trae los indicadores**: solo posiciones y cuartil.
Scimago dejó de publicar los valores crudos de la edición nueva. Los mapeos están
escritos en el guion por si vuelven.

**QS.** Las siete hojas oficiales del repositorio (Latam 2024-2026 y mundial
2024-2027) se procesan sin salir a la red. Tres trampas de formato, ya resueltas:
la fila de claves cambia de la 3 a la 4 entre ediciones; la columna del nombre se
rotula `institution` o `name`; y la del país tiene cinco rótulos distintos, dos de
ellos engañosos —`rank in country` trae la posición nacional y `location code`, la
sigla—. Por eso la columna del país se identifica **por su contenido**: se busca
en cuál aparece «Chile».

**Webometrics.** El dominio `webometrics.info` existe pero **no publica dirección
IP**: no resuelve. No es un bloqueo ni un 403; el sitio no responde. El guion queda
escrito y procesa un HTML guardado a mano en `raw/chile.html`.

**SIES.** Las tres bases históricas están en mifuturo.cl, en páginas distintas de
la que las indexa. La de personal académico trae una fila por institución y año,
con la cabecera repartida en **tres filas** —grupo, subgrupo y columna— y dos hojas
paralelas: una cuenta personas y la otra, jornadas completas equivalentes. La de
titulados son 234.000 filas por programa que hay que agregar.

La matrícula viene como un ZIP que contiene un **RAR** —149 MB de microdatos al
descomprimir—, así que el guion lo extrae con 7-Zip y recorre el CSV en flujo. La
base **no trae nacionalidad**, de modo que `estudiantes_extranjeros`, que THE y QS
necesitan, no sale de aquí: hay que pedírselo a la institución.

### Validación de la agregación

`tests/test_sies.py` contrasta el resultado con dos fuentes que no son el SIES:

- Las cifras públicas de la PUCV: 675,9 JCE en 2022 frente a los ~650 citados, y
  65,9 % de JCE con doctorado frente al ~64 % citado. Ambas dentro del 10 %.
- Lo que las universidades declaran a THE: de las dos cifras que THE publica
  —estudiantes FTE y razón estudiantes/académico— se deduce cuántos académicos
  declaró cada una, y se compara con sus JCE del SIES. En 188 pares
  universidad-año la razón mediana es **1,03**, que es la confirmación de que se
  está agregando lo correcto.

- La razón estudiantes/académico calculada con matrícula y JCE del SIES, contra la
  que THE publica. Aquí apareció algo que no estaba documentado: **THE trabaja con
  tres años de retraso**. Emparejando cada edición con el año del SIES que le
  corresponde, el desvío mediano baja del 13,2 % al **8,4 %** y la correlación sube
  de 0,40 a 0,56. Ese desfase hay que respetarlo en la calibración de la fase 5.

  Cuarenta y nueve pares se alejan más de un 25 %, y eso **no** es un defecto del
  guion: son universidades cuya declaración a THE no cuadra con su reporte al
  Estado. Finis Terrae y Mayor declaran a THE más del doble de académicos que al
  SIES; la Santa María de 2016, la mitad. Conviene mirarlo antes de usar esas
  cifras como ancla de calibración.

**ANID.** La agencia publica su base histórica de proyectos adjudicados en
GitHub, lo que evita raspar el sitio. Una trampa: la unidad viene en su propia
columna y casi todo está en **miles de pesos**. Tomarlo al pie de la letra divide
por mil el presupuesto de investigación del país.

**OpenAlex.** Se consulta con `mailto` para entrar en su cola cortés. Los
agregados salen de `group_by`, que resuelve en una petición lo que recorrer los
trabajos costaría cientos. La recolección es **reanudable**: el crudo de cada
universidad queda en `raw/` y una segunda ejecución lo reutiliza.

### Lo que produce la consolidación

`consolidar.py` deja cuatro archivos en `KAI/Datos reales/`:

| Archivo | Qué es |
|---|---|
| `valores_reales_chile.csv` | 25.620 datos en formato largo, con su fuente |
| `valores_reales_chile_ancho.csv` | 660 filas universidad-año × 58 variables |
| `conflictos.csv` | donde dos fuentes discrepan más de un 2 % |
| `factor_openalex_scopus.csv` | la razón entre ambos universos bibliométricos |

De momento **no hay conflictos**, y conviene entender por qué: cada fuente nombra
sus variables de forma distinta, así que no compiten. El detector se activará
cuando dos midan lo mismo con el mismo nombre —por ejemplo, cuando entren los
estados financieros junto a los montos de ANID—.

El factor OpenAlex/Scopus tiene mediana **1,36** sobre 102 pares. En las
universidades con producción grande ronda 1,2 y es estable —PUCV 1,18 y 1,20 en
dos ventanas—; en las pequeñas se dispara, porque dividir entre ocho documentos
de Scopus amplifica cualquier diferencia. Sirve para traducir cifras de OpenAlex
al universo de Scopus, que es con el que trabajan THE y QS, pero solo en las
universidades con volumen.

## Pendiente

| Tarea | Estado |
|---|---|
| T1.1 THE · T1.3 Scimago · T2.1 SIES · T2.4 ANID · T3.1 OpenAlex · T5.1 Consolidar | hechas |
| T1.2 QS | puntajes sí; faltan los perfiles de topuniversities.com |
| T1.4 Webometrics | el sitio no resuelve |
| T2.2 CNED · T2.3 Estados financieros | sin empezar |
| Fase 4 (Scopus, SciVal) | requiere la sesión institucional del usuario |
| T5.2-T5.5 (recálculo, calibración, reporte) | sin empezar |

Dos variables que **ninguna fuente abierta entrega** y que habrá que pedir a las
instituciones: los estudiantes extranjeros —la base de matrícula del SIES no trae
nacionalidad; los **académicos** extranjeros sí los publica— y los ingresos por
investigación con la definición de THE.

Lo que apareció **dentro** de los datos —el retraso de tres años de THE, las
universidades que declaran cifras distintas a cada organismo, las métricas vacías
de la plataforma, los huecos del catálogo y dos defectos de estos guiones— está en
[docs/hallazgos-recoleccion.md](../../docs/hallazgos-recoleccion.md).

### Descargas manuales pendientes

| Qué | Dónde | Dejar en |
|---|---|---|
| Tabla de Webometrics de Chile | `webometrics.info/en/Latin_America/Chile`, guardar la página | `KAI/Datos reales/webometrics/raw/chile.html` |
