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

`navegador.py` es el módulo común: descarga con caché y manifiesto, escritura del
formato largo, mapa de nombres y, para las fuentes que lo necesiten, un navegador
con registro de red (`crear_driver`, `respuestas_json`, `cookies_a_session`).

```bash
python tools/recoleccion/construir_nombres.py
python tools/recoleccion/the.py                 # ~15 min la primera vez
python tools/recoleccion/scimago.py             # ~4 min
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

Por eso la ventana **2020-2024 no se obtuvo**: ninguna vía abierta la publica
todavía. La serie 2014-2018 … 2019-2023 sí está completa, incluido el indicador
`excel`, que la base no tiene.

## Pendiente

Las fases 2 a 5 del plan (SIES, CNED, estados financieros, ANID, OpenAlex, Scopus
y SciVal, consolidación y calibración) están sin empezar. Las de bibliometría con
licencia exigen decidir antes si hay acceso institucional desde este equipo.
