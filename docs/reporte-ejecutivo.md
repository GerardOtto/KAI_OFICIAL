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

## Dónde vive

| Archivo | Papel |
|---|---|
| `frontend/kai-project/src/reportes/reporteEjecutivo.js` | Compone el PDF |
| `frontend/kai-project/src/reportes/grafico.js` | Lee el bloque; lo comparten el chat y el PDF |
| `frontend/kai-project/src/components/asistente/GraficoBarras.jsx` | Dibuja el gráfico en el chat |
| `frontend/kai-project/src/components/asistente/Markdown.jsx` | Intercepta el bloque cercado |
| `backend/app/herramientas.py` | La instrucción de sistema que pide el formato |

La verificación está en la sonda `reporte`; ver `backend/pruebas/README.md`.
