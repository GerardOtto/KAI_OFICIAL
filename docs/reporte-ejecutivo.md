# Reporte ejecutivo de análisis institucional

Cualquier conversación del asistente puede convertirse en un PDF con formato de
reporte. El botón aparece bajo cada respuesta y el documento incluye la
conversación **hasta esa respuesta**, ambas incluidas: quien lo pulsa en la
tercera consulta espera un documento con esas tres, no con las que vinieran
después.

Es opcional y se compone **en el navegador**: no hay petición al servidor, no
consume cuota de tokens y no queda copia en la base.

## Estructura del documento

| Parte | Contenido |
|---|---|
| Cabecera | Logotipo, título fijo «Reporte ejecutivo de análisis institucional» y ficha con la conversación, la institución, quién lo solicita, el asistente empleado, la fecha y el número de consultas |
| Una sección por consulta | Número correlativo, la consulta del usuario como subtítulo y la respuesta del asistente como cuerpo |
| Marca de agua | El logotipo centrado al 5 % de opacidad, en todas las páginas |
| Pie | Rótulo, fecha y numeración `página / total` |

El subtítulo **no reinterpreta** la consulta. A una pregunta se le completa la
puntuación —`qué rankings hay cargados` pasa a `¿Qué rankings hay cargados?`— y
una instrucción se conserva tal cual: «Compara el índice de citas…» seguiría
siendo eso. Deformarla en interrogativa cambiaría lo que el usuario pidió, que es
justo lo que el reporte tiene que dejar constar.

## Por qué se dibuja y no se captura

Capturar la pantalla con `html2canvas` habría sido más corto, pero produce una
imagen: pesada, borrosa al imprimir, imposible de buscar o copiar y con cortes de
página a mitad de una fila. El generador compone el PDF elemento a elemento sobre
jsPDF, de modo que el texto es texto y los saltos de página se deciden bloque a
bloque. Un reporte de dos páginas con tablas y gráficos pesa unos 50 kB.

El papel es claro aunque el sitio sea oscuro, porque un reporte se imprime y se
adjunta. Lo que se conserva del sitio es el sistema tipográfico —serif para los
títulos, monoespaciada para las etiquetas— y el azul de acento.

Qué compone: encabezados, párrafos con negrita, cursiva y código en línea,
listas ordenadas y con viñeta hasta dos niveles, tablas con alineación por
columna y repetición de la cabecera al cambiar de página, citas, bloques de
código, separadores, enlaces pulsables y gráficos de barras.

## El bloque de gráfico

La instrucción de sistema pide al asistente que, al comparar entre tres y ocho
cantidades de la misma naturaleza, emita un bloque cercado con el lenguaje
`kai-grafico`. Se dibuja como barras horizontales en el chat y en el PDF:

````markdown
```kai-grafico
titulo: Puntaje total en QS Latam, edición 2024
unidad: puntos sobre 100
destacar: Pontificia Universidad Católica de Valparaíso
fuente: base de datos de KAI
Pontificia Universidad Católica de Chile: 88.1
Universidad de Chile: 85
Pontificia Universidad Católica de Valparaíso: 62.3
```
````

| Clave | Obligatoria | Qué hace |
|---|---|---|
| `titulo` | sí | Encabeza la figura |
| `unidad` | no | Rótulo bajo el título |
| `fuente` | no | Pie de la figura |
| `destacar` | no | Resalta una fila; la comparación ignora tildes y exige palabra entera, para que «UC» no resalte a «PUCV» |
| `maximo` | no | Fija el tope de la escala; si falta, es el mayor de los valores |

Cualquier otra línea con la forma `etiqueta: valor` es un dato. Se aceptan coma
decimal, punto de millar y el signo de porcentaje.

Las barras nacen en cero y son proporcionales al valor, así que el bloque solo
sirve para magnitudes comparables entre sí. La instrucción de sistema advierte de
los dos usos que lo harían mentir: mezclar un puntaje con un recuento, y
representar posiciones de ranking, donde el mejor es el número más bajo y una
barra más larga significaría lo contrario.

Un bloque mal formado —sin cifras, o con un solo dato— se muestra como bloque de
código, tanto en el chat como en el PDF. El contenido nunca se pierde.

## Los informes de los módulos

Tendencias, Simulación, Glosario y Resumen emiten su propio PDF con el mismo
estilo: comparten con este reporte el lienzo, la portada, la marca de agua y el
pie (`reportes/documento.js`). Antes eran otra cosa —una captura oscura de la
pantalla seguida de todas las filas, o listados de cientos de métricas— y
palidecían al lado del reporte del asistente.

Todos siguen el mismo orden, que es el de un análisis y no el de un volcado:

1. **Cifras clave** de la institución de quien emite el informe (la de su
   perfil), o del líder si no figura entre los datos.
2. **Lectura**: frases que dicen lo que un analista vería en el gráfico —quién
   lidera, cuánto se movió la institución propia, el mayor alza y la mayor caída—.
3. **Un gráfico** dibujado en vectores: líneas con proyección punteada en
   Tendencias, barras en los demás.
4. **Una tabla acotada**. El detalle completo va a la exportación XLSX o CSV, y
   el informe lo dice.

| Módulo | Qué deja fuera, a propósito |
|---|---|
| Tendencias · evolución | El año a año de cada institución: la tabla trae una fila por institución (primer y último dato, variación, tendencia y proyección) |
| Tendencias · comparación anual | Más de seis métricas |
| Simulación | Las métricas que no se movieron: solo los ajustes, su efecto y las cinco métricas donde mejorar rinde más puntos. En la comparada, la matriz entera |
| Glosario | Las métricas una por una (más de mil): queda la matriz de dimensiones por rankings, con el peso y un mapa de calor |
| Resumen | De la fila 26 en adelante, salvo la institución propia. En el Ranking KAI añade los pesos con que se calculó el orden |

Las proyecciones de un puntaje se acotan a 0–100: una recta no puede sacar un
puntaje normalizado de su escala.

**El ranking, por su logotipo.** Los informes de un solo ranking llevan su
logotipo en la esquina superior derecha de la portada, frente al de KAI y bajo el
rótulo «Ranking usado:». El Glosario, que abarca todos, no lo lleva. Los archivos
están en `src/assets/rankings/`, en PNG transparente de 240 px de alto:

| Archivo | Rankings | Origen |
|---|---|---|
| `the.png` | THE Latam | Wikimedia Commons, `Times_Higher_Education_logo.svg` |
| `qs.png` | QS Latam, QS Global, QS por Disciplina (uno para todos) | qs.com, logotipo de la cabecera |
| `scimago.png` | Scimago Latam | scimagoir.com, «SCImago Institutions Rankings» |
| `shanghairanking.png` | Shanghai GRAS y ARWU (los publica la misma consultora) | shanghairanking.com, logotipo de la cabecera |
| — | Ranking KAI | el logotipo propio, `src/assets/logo.png` |

Los de SCImago y ShanghaiRanking venían con el texto en blanco, para las
cabeceras oscuras de sus sitios. Para el papel, ese texto se pasó a casi negro
(`#1A1A1A`) sin tocar el blanco de los íconos. Son marcas de terceros, y se usan
solo para identificar la fuente de los datos. La correspondencia entre nombre y
logotipo está en `logoDeRanking` (`documento.js`); un ranking nuevo sin logotipo
muestra su nombre en texto.

**Caracteres fuera de la fuente.** Las fuentes estándar del PDF solo traen la
codificación WinAnsi. El signo menos, las flechas o la delta griega salían como
basura y descuadraban la línea entera. `documento.js` sustituye cada carácter por
su equivalente más cercano (− por –, → por », Δ por «Var.») antes de escribir o
medir, y omite lo que no tiene equivalente, como los emojis. Esto también protege
al reporte del asistente de lo que escriba el modelo.

## Dónde vive

| Archivo | Papel |
|---|---|
| `frontend/kai-project/src/reportes/reporteEjecutivo.js` | Compone el PDF del asistente |
| `frontend/kai-project/src/reportes/documento.js` | Lienzo, portada, pie y bloques comunes a todos los informes |
| `frontend/kai-project/src/reportes/informeTendencias.js` · `informeSimulacion.js` · `informeGlosario.js` · `informeResumen.js` | Los informes de los módulos |
| `frontend/kai-project/src/reportes/grafico.js` | Lee el bloque; lo comparten el chat y el PDF |
| `frontend/kai-project/src/components/asistente/GraficoBarras.jsx` | Dibuja el gráfico en el chat |
| `frontend/kai-project/src/components/asistente/Markdown.jsx` | Intercepta el bloque cercado |
| `backend/app/herramientas.py` | La instrucción de sistema que pide el formato |

La verificación está en las sondas `reporte` e `informes`; ver `backend/pruebas/README.md`.
