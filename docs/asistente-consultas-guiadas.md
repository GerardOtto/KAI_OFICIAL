# Consultas guiadas del asistente: los informes de brechas

El chat vacío ofrece cuatro botones, uno por ranking —QS Latam, THE Latam,
Scimago y Ranking KAI—, con el color y el ícono de cada uno. Cada botón pide al
asistente un informe de brechas de la PUCV y la UV: sus métricas más bajas entre
las universidades chilenas, cuánto pesan, la cifra que necesitan para subir y las
dos en que conviene concentrarse. Es la generalización del prompt de brechas de
Scimago que se probó a mano el 30-09-2026 («KAI - Guía del prompt brechas
Scimago»).

| Pieza | Dónde |
|---|---|
| Prompts, SQL y textos de cada ranking | `frontend/kai-project/src/components/asistente/consultasGuiadas.js` |
| Botones | `src/components/asistente/BotonesBrechas.jsx` y `estiloRankings.js` |
| Botón del reporte PDF | `src/components/asistente/BotonReporte.jsx` |
| Título de la conversación y red de seguridad | `backend/app/conversaciones.py`, `backend/app/main.py` (`/chat`), `backend/app/herramientas.py` |
| Pruebas | batería `consultas-guiadas` (backend) y sonda `consultas_guiadas` (navegador) |

## 1. Lo que ve el usuario y lo que recibe el modelo

El botón manda **un solo mensaje** con tres partes:

```
Scimago: ¿dónde pueden mejorar la PUCV y la UV?        ← lo que ve el usuario

<!-- kai:instrucciones brechas-scimago -->              ← marca
Instrucciones para el asistente…                         ← solo para el modelo
Paso 1. Llama a la herramienta consulta_sql con …
WITH inst AS (…)                                         ← el SQL completo
Paso 2. Responde únicamente con el texto de la columna informe…
```

Se guarda entero en `mensaje.contenido`. La interfaz muestra solo lo que va
antes de la marca (`parteVisible`) en la burbuja, en el historial, al volver a
abrir la conversación y en el subtítulo del PDF. El servidor titula la
conversación con esa misma parte (`titulo_desde_mensaje`).

**Por qué en el mismo mensaje y no en una columna nueva.** Las migraciones se
aplican a mano en Railway (`backend/migraciones/README.md`): una columna
`contenido_visible` habría dejado el sitio desplegado mostrando el SQL hasta que
alguien aplicara la migración. Además, el modelo necesita el mensaje completo en
los turnos siguientes —«¿y en 2022?» se responde sabiendo qué consulta se hizo—,
así que lo que se guarda es lo que de verdad leyó.

**Derivar a otro motor.** El compositor recibe solo la pregunta; si se envía sin
tocarla, viaja con sus instrucciones (`pendiente` en `Asistente.jsx`). Si el
usuario la edita, se envía lo que escribió.

## 2. La base arma el informe; el modelo lo copia

Cada SQL devuelve **una celda**, `informe`, con el Markdown completo: el recuadro
«Cómo leer», una sección por universidad con su tabla y su «Dónde enfocarse», el
glosario y la fuente. El modelo no calcula ni compone nada: copia la celda. Es lo
que hizo fiable el prompt original, y aquí se lleva un paso más allá porque
componer diez filas de cifras invita a redondear o a cambiar una de lugar.

**Red de seguridad.** Gemini 3.5 Flash Lite, puesto a prueba, copió el informe
idéntico casi siempre, pero no siempre: escribió «5 % to 10 %» en lugar de
«5 % a 10 %» y «in THE Latam» en lugar de «en THE Latam». Por eso `/chat` captura
la celda `informe` que devolvió `consulta_sql` durante el turno
(`herramientas.capturar_informes`) y, si el mensaje del usuario era una consulta
guiada y la copia del modelo no coincide, entrega el original. El modelo sigue
recibiendo el prompt y ejecutando la consulta; solo se corrige la transcripción.
Una pregunta de seguimiento escrita a mano nunca se reemplaza.

Medido el 14-10-2026 contra Gemini, antes de la red: QS, Scimago y KAI salieron
idénticos al resultado de la consulta; THE, idéntico una de cada tres veces y con
una palabra traducida las otras dos.

## 3. Qué datos usa cada ranking

| Botón | Ranking en la base | Cifras | Edición |
|---|---|---|---|
| QS Latam | `QS Latam` | puntajes de 0 a 100 que publica QS, por indicador | la más reciente cargada (hoy 2026) |
| THE Latam | `THE Latam` | puntajes de 0 a 100 que publica THE, **por pilar** | la más reciente (hoy 2026) |
| Scimago | `Scimago Latam` | valores medidos (`valor_real_universidad`) | la más reciente (hoy 2023) |
| Ranking KAI | `Ranking KAI` | valores medidos | la más reciente (hoy 2025) |

QS y THE van en puntajes porque sus encuestas de reputación no tienen cifra
medida: un informe sobre lo medido dejaría fuera la mitad del peso de QS. THE
publica sus puntajes por pilar; sus indicadores tienen cifras reconstruidas por
KAI, pero en 2026 faltan las de citas e influencia. Las métricas con peso 0
(«Industry» de THE, «Student mix» de QS) no entran: mejorarlas no mueve el total.

## 4. El método

Todo se calcula entre las **universidades chilenas** de la edición:

- **Lugar en el total**: puesto por la suma ponderada de los puntajes, como en el
  módulo Resumen.
- **Lugar en cada métrica**: puesto por la cifra (o el puntaje); en «Estudiantes
  por académico» del Ranking KAI, menos es mejor.
- **Métricas más bajas**: las cinco peor ubicadas en términos relativos (lugar /
  total), más las dos prioritarias si no estaban entre ellas.
- **Influencia**: el peso de la métrica; alta desde 10 %, media desde 5 %.
- **Prioridad**: peso × cuán atrás está ((lugar − 1) / (total − 1)). Las dos más
  altas son el «Dónde enfocarse».
- **Metas**: la cifra de quien ocupa hoy ese lugar. «Mitad» es el lugar
  ceil(lugar / 2); se muestra «—» cuando el top 10 queda más cerca (lugares 11 a
  20: del 16.º, la mitad es el 8.º, más exigente que entrar al top 10). En el top
  10 la meta del «Dónde enfocarse» es la mitad del lugar; en el 1.º, mantenerlo.

Las metas suponen que las demás universidades no cambian: son una guía, no una
predicción, y el informe lo dice.

## 5. Restricciones del texto del SQL

La consulta pasa por el guardián de `consulta_sql` y por `text()` de SQLAlchemy:

- sin `;` (se rechaza la consulta) ni `--` (el guardián lo lee como comentario):
  la fila de alineación de las tablas se arma con `repeat('-', 3)`;
- sin dos puntos pegados a una letra, que `text()` toma por un parámetro;
- sin las palabras de las tablas vetadas (`plan`, `usuario`, `mensaje`…), que
  rechazan la consulta entera aunque vayan dentro de un texto;
- sin `JOIN LATERAL` ni nada que ponga tras `FROM`/`JOIN` un nombre que no sea una
  tabla académica o un CTE;
- **sin frases que sirvan de respuesta**: una versión tenía un aviso de «no hay
  datos» para el caso vacío, y Gemini lo respondió una vez sin ejecutar la
  consulta. Sin datos, la celda llega vacía y el prompt pide decirlo en una frase.

La batería `consultas-guiadas` ejecuta las cuatro consultas con `consulta_sql`
contra la base y comprueba todo esto.

## 6. Plan gratuito

QS y THE son de los planes de pago. Los botones aparecen con candado y no se
envían; si llegara a enviarse uno, el servidor no le da esos datos al asistente
(`con_rankings_vedados`) y la celda llega vacía. Cada informe gasta una de las
tres consultas de prueba.

## 7. El reporte PDF

El botón «Descargar reporte ejecutivo» va bajo cada respuesta; el de la última,
relleno con el acento y con un destello periódico (se apaga si el sistema pide
menos movimiento). Si la conversación abre con un informe de brechas, el PDF se
titula «Informe de brechas: PUCV y UV en …» y lleva el logotipo del ranking en la
portada. Las tablas cortas no se parten entre páginas y un título no queda solo
al pie: cada universidad ocupa una página entera si hace falta.

## 8. Cambiar las universidades o agregar un ranking

- **Universidades**: `INSTITUCIONES` en `consultasGuiadas.js` —sigla, nombre
  exacto de la base (sin tildes) y nombre para mostrar—, y los textos que dicen
  «PUCV y UV» (`pregunta`, `bajada`, `tituloDeInforme`).
- **Otro ranking**: una entrada en `CONSULTAS_GUIADAS` con su diccionario de
  métricas (nombre en la base, nombre en español, qué mide en una frase y
  formato) y su estilo en `estiloRankings.js`. La batería espera hoy los cuatro
  botones en orden; habrá que actualizarla.
