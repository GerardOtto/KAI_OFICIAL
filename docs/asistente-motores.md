# Los dos motores del asistente: Claude y Gemini

El asistente de KAI puede responder con dos modelos distintos. La elección no es
un detalle de configuración del servidor: la hace el usuario en cada
conversación, según el tipo de pregunta.

Los dos tienen las mismas capacidades: consultan toda la base de datos académica
—rankings, metodologías, métricas, universidades, series históricas y el censo de
científicos— y buscan en internet lo que no está cargado. Lo que los distingue es
la profundidad del razonamiento y el precio.

| Motor | Modelo | Para qué | Costo relativo |
|---|---|---|---|
| **Claude** (por defecto) | `claude-opus-5` | Razonamiento profundo: comparaciones entre rankings, preguntas de varios pasos, interpretación de tendencias | Alto |
| **Gemini** | `gemini-3.5-flash-lite` | Respuestas rápidas: consultas directas de datos, «qué métricas tiene X», «qué años hay cargados» | Bajo |

- **Registro y despacho:** [`backend/app/motores.py`](../backend/app/motores.py)
- **Herramientas y contrato de respuesta comunes:** [`backend/app/herramientas.py`](../backend/app/herramientas.py)
- **Motor Claude:** [`backend/app/assistant.py`](../backend/app/assistant.py) — ver también [asistente-creditos.md](asistente-creditos.md)
- **Motor Gemini:** [`backend/app/assistant_gemini.py`](../backend/app/assistant_gemini.py)
- **Frontend:** [`pages/Asistente.jsx`](../frontend/kai-project/src/pages/Asistente.jsx) y [`components/asistente/ChatSidebar.jsx`](../frontend/kai-project/src/components/asistente/ChatSidebar.jsx)

---

## 1. Qué comparten y qué no

Los dos motores ejecutan **exactamente las mismas once herramientas** sobre la
misma base de datos, con la misma instrucción de sistema, y los dos pueden
además **buscar en internet**. Las herramientas están definidas una sola vez, en
`herramientas.py`, como funciones normales de Python; de ahí se derivan los dos
formatos de declaración que exigen los proveedores. Si una consulta SQL cambia,
cambia para ambos: no hay dos versiones que puedan desincronizarse.

Lo único propio de cada módulo es la traducción al protocolo del proveedor y la
de sus errores. Ambos devuelven la misma estructura —texto, tokens de entrada,
tokens de salida, modelo, motor, número de búsquedas web y si la llamada fue
exitosa—, de modo que el endpoint `/chat` no necesita saber cuál respondió.

---

## 2. Qué sabe el asistente: contexto y alcance

La instrucción de sistema (`herramientas.py`, `BASE_SYSTEM_PROMPT`) define un
analista de inteligencia académica, no un asistente genérico: habla en español,
para autoridades universitarias y analistas institucionales, y prefiere decir que
un dato no permite sostener una conclusión antes que rellenar.

Lo que más condiciona sus respuestas son las dos reglas de procedencia:

1. **La base de datos manda** en todo lo que contiene. Nunca se inventan cifras,
   nombres ni identificadores: si no lo devolvió una herramienta, no se afirma.
2. **Internet cubre el resto**: ediciones o años que no están cargados, rankings
   ausentes, cambios recientes de metodología, definiciones oficiales, contexto
   internacional. Se priorizan las fuentes oficiales de cada entidad
   (`timeshighereducation.com`, `topuniversities.com`, `scimagoir.com`,
   `shanghairanking.com`) por encima de agregadores y prensa.

Cuando una respuesta mezcla ambas, **el asistente marca el origen de cada cifra**
y, si el sitio oficial y la base discrepan, lo muestra y explica la causa
probable en lugar de elegir en silencio.

Al arrancar el turno se le pega al prompt un **panorama de lo que hay cargado**,
calculado desde la propia base (`contexto_de_datos()`): cuántos rankings, con qué
métricas y disciplinas, cuántas universidades y qué años cubre cada uno. Así sabe
de antemano qué puede responder con datos propios y qué tiene que buscar fuera,
sin gastar un turno de herramientas en averiguarlo. Se cachea por proceso, porque
solo cambia cuando se cargan datos nuevos.

También se le advierten dos trampas de estos datos, que ya habían producido
lecturas equivocadas: que **los pesos de las métricas cambiaron entre ediciones**
(sumar pesos de años distintos no significa nada) y que **Shanghai GRAS y QS por
Disciplina son multidisciplinarios** (agregarlos sin fijar disciplina infla las
cifras).

### Lo que no puede ver

Las herramientas alcanzan el dominio académico completo y nada más. Las tablas
`usuario`, `conversacion`, `mensaje`, `notificacion` y `plan` quedan fuera por
diseño, y la herramienta de SQL libre rechaza la consulta entera si las menciona
—escritas como sea, entre comillas o dentro de una subconsulta—. Si se le
pregunta por datos de usuarios, responde que quedan fuera de su alcance.

### Las once herramientas

| Herramienta | Para qué |
|---|---|
| `listar_rankings` | Catálogo con nivel, categoría, editor, métricas, universidades y años |
| `detalle_ranking` | Descripción y metodología completas, disciplinas y años con datos |
| `buscar_metricas` | Métricas de un ranking con tipo, peso y **en qué años hay valores** |
| `buscar_universidades` | Búsqueda por nombre o país; devuelve el id y su cobertura |
| `consultar_valores` | Corte transversal: qué sacó cada universidad en cada indicador de un año |
| `consultar_tendencia` | Serie histórica de una métrica |
| `consultar_ranking_resumen` | Score ponderado por universidad, con disciplina opcional |
| `comparar_universidades` | **Comparación completa en una llamada**: métricas, años y score ponderado |
| `buscar_cientificos` | Censo bibliométrico: h-index, citas, artículos, ranking global |
| `perfil_cientifico` | Ficha completa de un científico con sus indicadores y tópicos |
| `consulta_sql` | Salida de emergencia: SQL de solo lectura sobre las tablas académicas |

Las búsquedas por texto ignoran mayúsculas **y tildes**: la base guarda
«Pontificia Universidad Catolica de Valparaiso» sin acentos, pero tanto el
usuario como el modelo escriben «Católica».

`comparar_universidades` existe por una razón de costo, no de comodidad: el
patrón más frecuente —«quién está mejor», «cómo evolucionó»— obligaba a encadenar
tres herramientas o más, y cada eslabón es una vuelta entera del ciclo. Ver § 9.

### Ninguna consulta vacía es un callejón sin salida

Cuando una herramienta no encuentra nada, devolver «no hay datos» sale caro: el
modelo prueba otra combinación, y cada intento cuesta una vuelta. Así que el
resultado vacío trae la salida:

- Una búsqueda de métricas sin coincidencias devuelve **las métricas que sí
  tienen valores**, con su identificador, sus años y de qué se componen.
- Si lo que se pedía existe en la metodología pero sus valores están cargados en
  el pilar que lo agrupa —THE Latam publica «Citation impact», pero los datos
  están en «Research Quality»—, se nombra el pilar y `consultar_tendencia`
  **devuelve directamente su serie**, avisando de que la cifra es la del pilar.
- Un resultado recortado por el tope de filas no dice «hay más», sino que empuja
  a filtrar, que es lo que de verdad ahorra.

### `consulta_sql`: por qué existe y cómo está contenida

Enumerar una herramienta por pregunta posible es imposible, así que hay una que
acepta SQL. Su contención tiene cuatro capas, y ninguna basta sola:

1. Solo se admite **una** sentencia que empiece por `SELECT` o `WITH`.
2. Se rechazan las palabras que escriben o leen el sistema, y el catálogo interno
   de PostgreSQL.
3. Se rechaza cualquier mención de las tablas vetadas, y toda relación citada
   tras `FROM`/`JOIN` debe estar en la lista blanca.
4. La consulta se ejecuta en una **transacción de solo lectura** con un timeout
   de 8 segundos. Esta es la única garantía que no depende de acertar con una
   expresión regular: la impone el motor de la base.

Un error de SQL vuelve al modelo como resultado de la herramienta, para que
corrija la consulta y reintente.

---

## 3. La búsqueda en internet

En los dos proveedores la búsqueda **la ejecuta el servidor del proveedor**, no
este backend: el modelo la invoca, el proveedor busca y devuelve el resultado. No
hay que contratar ni configurar ningún buscador aparte, y el backend nunca abre
una conexión saliente a internet por su cuenta.

La diferencia está en **cuándo se ofrece**:

| | Claude | Gemini |
|---|---|---|
| Herramientas | `web_search_20260209` y `web_fetch_20260209` | `google_search` y `url_context` |
| Cuándo se declaran | En todas las peticiones | **Solo en la consulta que resuelve `buscar_en_internet`** |
| Cómo la pide el modelo | Directamente | Llamando a la función `buscar_en_internet` |
| Cómo llega la ejecución | Bloques de resultado en la respuesta | Como resultado de la herramienta, igual que los de la base |
| Tope por turno | `CLAUDE_MAX_BUSQUEDAS` (5 por defecto) | Lo decide el modelo, una llamada por búsqueda |

En **Claude**, el `tool_runner` del SDK separa por sí mismo las herramientas que
sabe ejecutar aquí de las que solo tiene que declarar, así que basta con añadir
las de servidor a la lista. Como la respuesta final llega partida en varios
bloques de texto con los resultados intercalados, se **concatenan todos**:
quedarse con el primero devolvía la respuesta a medias.

### Por qué en Gemini internet es una herramienta y no una capacidad

Hasta el 24 de septiembre de 2026 el motor declaraba `google_search` en todas las
peticiones, combinada con las funciones propias. Tenía dos problemas:

- **Invitaba a buscar lo que la base ya responde.** La capacidad estaba siempre
  ahí, y un modelo pequeño la usa.
- **Agotada la cuota diaria de búsqueda —independiente de la de tokens—, Google
  rechazaba la petición entera en la validación**, con un 429 en dos décimas de
  segundo. Un saludo fallaba igual que una consulta a internet.

Ahora el motor declara una función más, `buscar_en_internet`, junto a las diez de
datos. Cuando el modelo la llama, el backend hace **una consulta aparte** —esa sí
con `google_search` y `url_context`, y con su propia instrucción de sistema— y le
devuelve el resumen como resultado de herramienta. Consecuencias:

- La cuota de búsqueda solo se gasta cuando se busca de verdad.
- Si esa cuota está agotada, el modelo recibe un aviso como resultado de la
  herramienta y **termina el turno con lo que haya en la base**, advirtiéndolo.
  La suspensión dura `GEMINI_ESPERA_CUOTA_WEB` segundos (1800 por defecto) para
  no gastar una llamada perdida en cada consulta.
- Los tokens de la búsqueda se suman a los del turno: es una llamada al modelo
  como cualquier otra y se cobra contra la cuota del plan.

### Costo

Las búsquedas **se facturan por uso, aparte de los tokens**. La respuesta de
`/chat` incluye `uso.busquedas` para que ese gasto sea visible; **no se descuenta
de la cuota de tokens del plan**, que sigue midiendo solo tokens. Si el uso
crece, conviene revisarlo: es la vía por la que un turno puede costar bastante
más de lo que sugieren sus tokens.

---

## 4. Por qué un motor no se puede cambiar a mitad de conversación

Cada conversación queda ligada a un motor **al crearse** y ya no lo cambia. No es
una restricción arbitraria: el historial de una conversación no es
intercambiable entre proveedores. Los formatos de turno difieren, y además cada
proveedor acompaña sus respuestas de metadatos internos —firmas de razonamiento,
identificadores de llamadas a herramientas— que solo él sabe interpretar.
Reenviar a un modelo lo que produjo el otro da, en el mejor caso, respuestas
incoherentes, y en el peor, errores de formato de la propia API.

La regla se aplica en tres niveles, de modo que ninguno depende de que el
anterior funcione:

1. **Base de datos.** La columna `conversacion.motor` tiene una restricción
   `CHECK` que solo admite `'claude'` o `'gemini'`.
2. **API.** `POST /chat` acepta `motor` únicamente cuando abre una conversación
   nueva. En una existente usa el que quedó guardado, y si la petición trae uno
   distinto responde **409 Conflict** explicando que hay que derivar.
3. **Interfaz.** Con una conversación abierta, el selector se muestra bloqueado
   con el motor que le corresponde y sin botones para cambiarlo.

### Derivar: la forma prevista de cambiar de modelo

Al pasar el cursor sobre cualquier mensaje propio aparece **«Derivar a
[el otro motor]»**. Eso abre una conversación nueva con ese motor y deja el
mensaje escrito y listo para enviar.

La conversación de origen queda intacta en el historial, y la nueva empieza con
el contexto limpio, sin arrastrar turnos producidos por el otro proveedor. La
conversación nueva **no se crea hasta que se envía el mensaje**: una derivación
que el usuario abandona no deja conversaciones vacías en el historial.

El caso típico es empezar barato y escalar: se pregunta con Gemini, la respuesta
se queda corta, y se deriva la misma pregunta a Claude.

---

## 5. Configurar el motor Gemini

El motor Gemini está implementado y solo le falta la credencial. Sin ella la
aplicación funciona igual: el motor aparece en el selector marcado **«Sin
configurar»** y deshabilitado, y solo se ofrece Claude.

1. Entra en <https://aistudio.google.com/apikey> con una cuenta de Google.
2. Pulsa **Crear clave de API** y elige un proyecto de Google Cloud (sirve el que
   ofrece por defecto).
3. Copia la clave y pégala en `backend/.env`:

   ```
   GEMINI_API_KEY=AIza...
   ```

4. Reinicia el backend. El motor aparecerá habilitado.

En Railway la clave va en las **Variables** del servicio de backend, no en un
archivo `.env`.

### Variables

| Variable | Obligatoria | Notas |
|---|---|---|
| `GEMINI_API_KEY` | Para usar el motor Gemini | Sin ella el motor se muestra deshabilitado |
| `GEMINI_MODELOS` | No | Cadena de modelos separados por comas. Por defecto `gemini-3.5-flash-lite,gemini-3.1-flash-lite` |
| `GEMINI_MODEL` | No | Variable antigua. Si está, su modelo encabeza la cadena |
| `GEMINI_ESPERAS_503` | No | Segundos entre reintentos. Por defecto `1,3,6`, es decir cuatro intentos |
| `GEMINI_ESPERA_CUOTA_WEB` | No | Segundos que se suspende la búsqueda tras un 429. Por defecto 1800 |
| `GEMINI_MAX_CICLOS` | No | Vueltas del ciclo de herramientas por turno. Por defecto 15 |
| `KAI_TOPE_FILAS` | No | Filas máximas de un resultado de herramienta. Por defecto 80 |
| `KAI_VENTANA_MENSAJES` | No | Mensajes del historial que se reenvían. Por defecto 10 |
| `KAI_MENSAJES_INTACTOS` | No | Cuántos de ellos van sin recortar. Por defecto 4 |

`GOOGLE_API_KEY` funciona como alternativa a `GEMINI_API_KEY`, por compatibilidad
con el nombre que usa el SDK.

### Cambiar de modelo

No hay un modelo único, sino una **cadena**: si el primero agota sus reintentos
por saturación, el motor pasa al siguiente y lo registra. Una vez que uno
responde, el turno se queda con él, porque el historial de un turno con llamadas
a herramientas lleva firmas de razonamiento que pertenecen al modelo que las
produjo.

```
GEMINI_MODELOS=gemini-3.5-flash-lite,gemini-3.1-flash-lite
```

`gemini-3.5-flash-lite` encabeza la cadena desde el 24 de septiembre de 2026.

Sustituyó a `gemini-3.1-flash-lite`, que era más barato pero dejó de estar
disponible en la práctica: medido ese día con turnos completos de consulta a la
base, uno de cada cuatro se perdía por saturación del modelo y los que salían
adelante tardaban entre 26 y 118 segundos. El mismo turno contra 3.5-flash-lite
respondió las cuatro veces, entre 3,7 y 7 segundos.

Cuatro comprobaciones antes de cambiarlo, todas aprendidas a la fuerza:

- **Que el modelo admita *function calling***. Uno que no lo haga arrancará sin
  error y fallará en la primera consulta.
- **Que sea de la generación Gemini 3.** Combinar la búsqueda de Google con las
  funciones propias solo está disponible ahí. En un modelo anterior el motor
  seguiría funcionando, pero replegado a la base de datos y sin acceso a
  internet.
- **Que la API lo sirva de verdad.** Que aparezca en `models.list()` del SDK no
  basta: `gemini-2.5-flash-lite` sigue listado y es más barato (0,10 / 0,40 USD),
  pero la API responde *«no longer available to new users»* y remite a la
  generación siguiente. La única prueba fiable es una consulta real.
- **Que responda con holgura, no solo que responda.** Un modelo saturado
  devuelve 503 *«This model is currently experiencing high demand»*, y como una
  consulta de datos necesita dos llamadas —pedir la herramienta y redactar con su
  resultado—, la probabilidad de perder el turno se multiplica. Hay que medirlo
  con varios turnos completos, no con una llamada suelta: `gemini-3.8-flash`
  responde 503 de inmediato en todos los intentos pese a estar listado.

Los precios están en la [página de tarifas](https://ai.google.dev/gemini-api/docs/pricing);
los modelos vigentes, en la [lista de modelos](https://ai.google.dev/gemini-api/docs/models).

---

## 6. Costo y cuotas

Precios por millón de tokens:

| Motor | Entrada | Salida |
|---|---|---|
| `claude-opus-5` | 5,00 USD | 25,00 USD |
| `gemini-3.5-flash-lite` | por confirmar en la página de tarifas | por confirmar |

El precio de `gemini-3.1-flash-lite`, el modelo anterior, era 0,25 / 1,50 USD. El
del actual hay que confirmarlo antes de rehacer los márgenes de los planes: la
disponibilidad obligó a cambiar de modelo y el costo por token puede no ser el
mismo.

La entrada cuesta **20 veces menos** y la salida, **algo más de 16 veces menos**.
Medido sobre una consulta real —«¿qué rankings hay cargados?», que obliga al
modelo a llamar a una herramienta y leer su resultado— el motor Gemini consumió
1.192 tokens de entrada y 54 de salida: **0,00038 USD**.

Dos avisos sobre esa cifra, ahora que el asistente hace más cosas:

- Es **anterior** a la ampliación de herramientas y al panorama de datos que se
  añade al prompt. La entrada por turno subió —hay once herramientas declaradas
  en vez de cinco, y una de ellas (`consulta_sql`) lleva el esquema completo en
  su descripción— y después se volvió a medir y a recortar: ver § 9.
- **No incluye las búsquedas en internet**, que se cobran por uso y no por token.
  Son el componente que más puede desviar el costo real de lo que sugieren los
  tokens; `uso.busquedas` en la respuesta de `/chat` permite seguirlo.

### El nivel gratuito de Gemini

Esos precios son los del **nivel de pago**. La API de Gemini tiene además un
**nivel gratuito**, y una clave recién creada en AI Studio empieza ahí: por eso
el motor funciona sin haber cargado saldo. La API de Claude no tiene equivalente
—es de prepago puro—, y esa es toda la diferencia entre que uno responda y el
otro no cuando no se ha pagado nada.

Lo gratuito no sale gratis del todo. Dos condiciones a tener presentes:

- **Google usa el contenido del nivel gratuito para mejorar sus productos.** En
  el nivel de pago, no. Aquí eso significa las preguntas de los usuarios y los
  resultados de las consultas a la base. Los datos de rankings son públicos,
  pero las preguntas pueden no serlo: «¿en qué métrica conviene que invirtamos
  para subir en THE?» dice bastante sobre la estrategia de la institución.
- **Los límites de uso son bajos** (peticiones por minuto y por día). Al
  superarlos la API responde 429 y el motor lo traduce a un aviso que sugiere
  usar el otro. Las cifras vigentes de la clave se consultan en
  <https://aistudio.google.com/> → *Rate limits*; no están publicadas de forma
  estática porque dependen del proyecto.

Activar la facturación en el proyecto de Google Cloud pasa la clave al nivel de
pago: suben los límites y el contenido deja de usarse para entrenamiento. Con los
precios de la tabla, el gasto sería de céntimos al mes salvo un uso intenso.

**Cada motor tiene su propia cuota mensual**, definida en el plan del usuario. No
hay una bolsa común: con la diferencia de precio entre ambos, un saldo único
haría que dos usuarios que consumen la misma cifra le costaran a la plataforma
cantidades muy distintas según qué motor eligieran.

El plan gratuito incluye Gemini pero **no Claude**, que solo entra en los planes
de pago; el rol de administrador tiene acceso completo y sin topes. El catálogo,
los precios y el cálculo del margen están en **[planes.md](planes.md)**.

---

## 7. Diagnóstico

Para ver qué motores reconoce el servidor y cuáles tienen su clave configurada:

```bash
curl -s http://localhost:8000/motores
```

El campo `disponible` de cada motor indica si su clave está presente. El endpoint
es público a propósito: la interfaz lo consulta antes de que el usuario inicie
sesión.

### Errores y qué significan

Ambos motores traducen los fallos del proveedor a un mensaje que dice qué pasó y
qué hacer. Nunca se propaga una excepción cruda: un fallo del proveedor no debe
llegar al navegador como un 500 opaco.

| Situación | Qué se ve |
|---|---|
| Clave inválida o revocada | Indica qué variable corregir y dónde generar otra |
| Modelo inexistente | Nombra la variable a corregir (`GEMINI_MODEL`) |
| Cuota del proveedor agotada | Sugiere abrir una conversación con **el otro motor** |
| Facturación sin activar (Gemini) | Apunta a la consola de Google Cloud |
| Demasiadas solicitudes | Pide esperar unos segundos |
| Servicio caído (5xx) | Pide reintentar en unos minutos |
| Filtros de seguridad | Pide reformular |
| Llamada a herramienta malformada | Sugiere derivar la consulta a Claude |
| Respuesta cortada por longitud | Se entrega lo obtenido, con un aviso al final |
| Gemini rechaza combinar búsqueda y herramientas | Nada: responde igual, sin internet, y lo deja en el log |
| SQL que toca tablas de usuarios | El modelo recibe el rechazo y reformula; el usuario no ve nada |

Cuando una consulta falla, **el turno completo se descarta**: el mensaje del
usuario se borra y, si la conversación se había creado para ese turno, también la
conversación. Así el historial no arrastra un mensaje sin respuesta que se
reenviaría al modelo en el turno siguiente. Ese comportamiento es común a los dos
motores.

### Un fallo de herramienta no rompe el turno en Gemini

Los dos motores difieren en un punto deliberado. Si una herramienta falla —por
ejemplo, porque el modelo pasó `"PUCV"` donde se esperaba un identificador
numérico—, el motor Gemini le devuelve el error al modelo como resultado de la
herramienta, para que corrija el argumento y vuelva a intentar. Un modelo pequeño
se equivoca más al construir argumentos, y esta vía de recuperación le sirve. El
tope de vueltas por turno —`GEMINI_MAX_CICLOS`, quince por defecto— impide que se
quede reintentando.

El número es un margen, no una medida: un turno corriente gasta dos o tres
vueltas y una comparación entre instituciones y años, cuatro o cinco. Conviene
saber qué encarece subirlo: cada vuelta es una petición completa que reenvía la
conversación **y todos los resultados de herramientas acumulados**, así que las
últimas cuestan bastante más que las primeras, y en el nivel gratuito cuentan
también contra el límite de peticiones por minuto. El aviso «encadenó más de N
consultas» apareciendo con una pregunta razonable es la señal de que el tope se
quedó corto.

---

## 8. La espera y la aparición de la respuesta

`/chat` no emite en flujo: el turno puede encadenar hasta quince ciclos de
herramientas, y la respuesta se devuelve entera cuando termina el último. Entre
la pregunta y esa entrega no hay nada que informar, así que la interfaz resuelve
los dos momentos por separado.

**Mientras se espera** (`components/asistente/Cargando.jsx`) se muestra un
indicador animado: la marca del asistente latiendo, la etiqueta recorrida por un
barrido de luz, tres puntos en onda y una barra indeterminada. A los tres
segundos aparece un cronómetro y, a los quince, una nota de que la consulta sigue
en curso. Todo el movimiento es CSS sobre elementos que ya están en la página
—ninguna imagen que descargar— y se detiene con `prefers-reduced-motion`.

El indicador no anuncia etapas («analizando», «redactando»): el servidor no
informa del progreso, y fingirlo sería inventar. Dice lo único que se sabe con
certeza —que la consulta sigue en curso y cuánto lleva—.

**Al llegar la respuesta**, el texto aparece por palabras en lugar de de golpe
(`revelado.js` y `useRevelado.js`). No es flujo de datos: el texto ya está
completo en el navegador y solo se entrega a la vista de forma gradual, en entre
0,3 y 2 segundos según su largo. Por eso no cuesta ni una petición ni un token, y
no cambia nada del backend.

Mientras dura la aparición, el texto se recorta por donde el marcado esté
completo: un bloque de gráfico sin cerrar se dibujaría como código y una tabla a
medias saltaría de párrafo a tabla en cada avance, así que ambos se mantienen
ocultos hasta que terminan y entonces aparecen de una vez. Solo se revela la
respuesta recién llegada; las que se abren desde el historial se muestran enteras.

La verificación está en la sonda `revelado` (25 comprobaciones).

---

## 9. El consumo de entrada

De un día real medido: **506.079 tokens de entrada frente a 16.065 de salida**,
31 a 1. No es una anomalía, es la forma del problema. La API es sin estado, así
que en **cada vuelta** del ciclo de herramientas se reenvía todo: la instrucción
de sistema, la declaración de las herramientas, el historial y los resultados ya
entregados. El costo de un turno crece casi al cuadrado del número de vueltas.

Reconstruidos los 33 turnos de ese día, el reparto era: **56 % el bloque fijo**
—sistema más herramientas—, 15 % el historial y el resto, resultados.

### Lo que se hizo

| Medida | Dónde |
|---|---|
| Podar la instrucción de sistema y las descripciones de las herramientas | `herramientas.py` |
| Publicar en el contexto los identificadores de rankings y universidades habituales, para que no cueste una vuelta averiguarlos | `contexto_de_datos()` |
| Pedir explícitamente que agrupe las consultas independientes en una misma vuelta | instrucción de sistema |
| `comparar_universidades`: el patrón dominante en una sola llamada | `herramientas.py` |
| Que ninguna consulta vacía sea un callejón sin salida (§ 2) | `herramientas.py` |
| Bajar el tope de filas de 300 a 80, con un aviso que empuja a filtrar | `TOPE_FILAS` |
| Ventana de historial de 20 a 10 mensajes, y recorte de los más antiguos | `conversaciones.py` |
| Registrar en el log las vueltas y las llamadas de cada turno | `assistant_gemini.py` |

Medido contra la API real, con las mismas tres preguntas antes y después:

| Pregunta | Antes | Después |
|---|---:|---:|
| Qué rankings hay cargados | 6.974 | 7.572 |
| Qué universidad es mejor en THE Latam, PUCV o USM | 44.372 | 7.464 |
| Comparar el índice de citas de la PUCV, 2019-2024 | 69.883 | 11.983 |
| **Total** | **121.229** | **27.019 (−78 %)** |

La primera sube un poco: el bloque fijo creció al añadir la herramienta de
comparación y los identificadores. Es el precio de las otras dos.

### Lo que no se puede hacer

**Caché de contexto.** El bloque fijo es idéntico byte a byte en todas las
vueltas, que es el caso de libro para una caché. No está disponible: crearla
devuelve `429 TotalCachedContentStorageTokensPerModelFreeTier limit=0`. Requiere
facturación activa. Conviene volver a ello si el proyecto pasa a plan de pago,
porque ahí está la mitad del gasto.

**Emitir en flujo no ahorra nada.** El streaming adelantaría la primera palabra,
pero el consumo es el mismo.

### El límite por minuto

El nivel gratuito admite **15 peticiones por minuto** por modelo (comprobado: el
429 lo dice con ese número). Cada vuelta es una petición, así que con
`GEMINI_MAX_CICLOS` en 15 un solo turno pesado puede agotar el minuto entero. Es
un motivo más para que los turnos den pocas vueltas, no solo el costo.

---

## 10. Estado

Verificado con pruebas automatizadas contra la base de datos real: las diez
herramientas, la contención de `consulta_sql` (28 intentos de evasión, incluidos
los identificadores entre comillas y las subconsultas), el ciclo de herramientas
y la contabilidad de tokens y búsquedas de Gemini, internet como herramienta a
demanda —incluido qué ocurre cuando su cuota está agotada—, la cadena de modelos
de respaldo, la traducción de errores, el bloqueo del motor dentro de una
conversación y el recorrido completo de `/chat` con autenticación real.

En Claude está verificado que el `tool_runner` separa correctamente las diez
herramientas locales de las dos de servidor y declara las doce a la API.

Verificado además **contra la API real de Gemini**: el ciclo completo de
herramientas, que el límite de privacidad se sostiene frente a un intento directo
de extracción, que la petición corriente no declara las herramientas de internet y
que, sin cuota de búsqueda, el motor lo comunica en vez de fallar.

**No verificado contra el proveedor en vivo**, por falta de saldo en la cuenta de
Anthropic:

- Que Claude use efectivamente `web_search` y devuelva citas.

Tampoco se ha podido ejercitar una búsqueda real de Gemini de extremo a extremo:
la cuota diaria de `google_search` de la clave gratuita lleva agotada desde antes
del cambio. Lo que sí está verificado es el camino alternativo, que es el que
importa para que el turno no se pierda.
