# Cargador de rankings oficiales

Un solo camino para que cada edición de un ranking externo llegue a la base:
**fuente oficial → instantánea versionada → verificación → base**. Antes, cada
ranking se había cargado a mano y de una forma distinta; así se colaron las
columnas corridas de QS Global 2026 y faltaban ediciones publicadas hace meses.

```
tools/rankings/
  actualizar.py      consulta las fuentes y escribe instantáneas (no toca la base)
  cargar.py          verifica las instantáneas y las carga en la base
  verificar.py       comprobaciones que no necesitan la base
  comun.py           formato de las instantáneas, descargas y alias
  fuentes/           una fuente por módulo: the, qs, shanghai (ARWU y GRAS), scimago
datos/rankings/<ranking>/<edición>.csv   la edición, reducida a las chilenas
datos/rankings/<ranking>/<edición>.json  de dónde salió y qué se comprobó
```

Una instantánea trae una fila por universidad y métrica, con el nombre de la
universidad y de la métrica tal como están en la base, la posición publicada y el
**puntaje total** («Puntaje total», migración 020), marcado `publicado` o
`calculado` cuando la fuente no lo da para esa universidad y se obtuvo con su
método.

## Qué cubre cada fuente

| Ranking | Fuente | Automático | Total |
|---|---|---|---|
| THE Latam | página oficial (tabla en `__NEXT_DATA__`) | sí | Overall publicado; en las bandas, con los pesos de la edición |
| Shanghai ARWU | API pública de shanghairanking.com | sí | 100 × suma ponderada / la de la primera del mundo |
| Shanghai GRAS | API pública, 57 materias | sí | desde 2024, suma de los indicadores (ya ponderados); antes, cada indicador por el peso de su materia y edición, deducido de los totales publicados del top 50 |
| QS Latam, QS Global | planilla oficial en `KAI/QS/DatosQS/` | la lectura sí; la descarga no | Overall publicado |
| Scimago Latam | scimagoiber.com | solo la detección | — |
| QS por Disciplina | — | no | — |

**QS no se puede descargar solo.** topuniversities.com, qs.com y support.qs.com
responden con un desafío de Cloudflare a todo cliente automatizado, incluido un
navegador sin cabeza, y el cargador no intenta pasarlo. La planilla oficial se
baja a mano —como las de 2024-2027— y se deja en `KAI/QS/DatosQS/QS LATAM/` o
`QS global/` con el año de la edición al comienzo del nombre. La revisión mensual
la convierte sola y, si por el calendario de QS ya debió salir una edición y su
planilla no está, lo avisa.

**Scimago no publica sus cifras desde la edición 2026.** La plataforma guarda el
percentil de cada cifra (documentos, citas, patentes) y la exportación nueva de
scimagoir.com trae solo posiciones. La serie con cifras sigue en scimagoiber.com,
que hoy llega a la ventana 2019-2023 (la edición 2025). La revisión mensual avisa
cuando aparezca la siguiente; su carga sigue el camino de
`tools/recoleccion/scimago.py` y la migración 011.

**QS por Disciplina** se cargó desde planillas por materia que este cargador aún no
lee; su edición 2027 saldrá en marzo de 2027.

**GRAS antes de 2024.** Hasta 2023 GRAS publicaba cada indicador de 0 a 100 y su
total con pesos propios de cada materia y edición (Matemáticas: CNCI 100 en 2017,
20 en 2023). La API no trae esos pesos y las páginas de metodología anteriores a
2023 ya no existen, así que la fuente los deduce de los totales que GRAS publica
para las 50 primeras de cada materia: un ajuste por mínimos cuadrados redondeado a
múltiplos de 5 puntos, que debe reproducir cada total publicado dentro del
redondeo de GRAS. Los pesos deducidos quedan en el `.json` de cada edición. En
2018, Oceanography y Mining & Mineral Engineering no se dejan deducir: sus cuatro
filas chilenas quedan sin total. La migración 020 los había calculado como suma
simple; la 021 los borra y `cargar.py --escribir` agrega los correctos.

## Uso

```bash
pip install -r backend/requirements.txt

python tools/rankings/actualizar.py                 # la revisión mensual
python tools/rankings/actualizar.py shanghai-gras 2026
python tools/rankings/actualizar.py --todas         # rehace todas las ediciones

python tools/rankings/cargar.py                     # compara las instantáneas con la base
python tools/rankings/cargar.py --escribir          # carga las ediciones que faltan
python tools/rankings/cargar.py --sql ediciones.sql # o las deja en un SQL para psql
python tools/rankings/cargar.py the-latam 2026 --escribir --reemplazar
```

`cargar.py` usa la `DATABASE_URL` de `backend/.env` salvo que se pase `--url`, y
requiere las migraciones 020 y 021. Antes de escribir una edición comprueba que cada
métrica exista en su época (GRAS cambió de indicadores en 2020 y 2024), que cada
universidad esté en el catálogo y que el total cuadre con sus componentes; si la
base ya tiene esa edición, la instantánea debe coincidir cifra por cifra; si
solo le faltan cifras, las agrega sin tocar las demás («completar»), y cualquier
otra diferencia la detiene: solo `--reemplazar`, nombrando ranking y edición,
sustituye una edición cargada. Después de escribir relee lo escrito. Al terminar, reinicia el backend: el asistente cachea el
panorama de datos.

Una métrica o una materia nuevas detienen la carga: hay que crearlas con una
migración, con su peso. Una universidad que la fuente nombra de otra forma se
agrega a `tools/recoleccion/nombres_universidades.csv`.

## La revisión mensual

`.github/workflows/rankings.yml` corre el día 5 de cada mes (y a mano, desde la
pestaña Actions):

1. `actualizar.py` pregunta a THE y a ShanghaiRanking por las ediciones
   posteriores a la última guardada, convierte las planillas de QS nuevas y mira si
   Scimago publicó cifras.
2. Si hay instantáneas nuevas, abre un PR `rankings/AAAA-MM` con ellas y el informe.
3. Lo que necesita a una persona —una planilla de QS que falta, una fuente que
   cambió su metodología o no respondió— va a un issue «Rankings: acción
   requerida», que se reutiliza mes a mes.
4. Al incorporar el PR a `main`, el trabajo `cargar` verifica todas las
   instantáneas contra la base y carga las que faltan. Usa el secreto
   `DATABASE_URL_RANKINGS` (la URL pública de PostgreSQL en Railway); sin él, deja
   un aviso y la carga se hace a mano con `cargar.py --escribir`.

En el repositorio hay que habilitar *Settings → Actions → General → Allow GitHub
Actions to create and approve pull requests*.

## Prueba de regresión

`backend/pruebas/test_rankings_oficiales.py` (batería `rankings`) exige que cada
instantánea de una edición ya cargada coincida con la base, que las que faltan se
puedan cargar sin dejar rastro, que las planillas de QS se lean igual y que el
cargador rechace un total corrido de columna, una métrica desconocida y una edición
cargada que difiere.
