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
| **Gemini** | `gemini-3.1-flash-lite` | Respuestas rápidas: consultas directas de datos, «qué métricas tiene X», «qué años hay cargados» | Bajo |

- **Registro y despacho:** [`backend/app/motores.py`](../backend/app/motores.py)
- **Herramientas y contrato de respuesta comunes:** [`backend/app/herramientas.py`](../backend/app/herramientas.py)
- **Motor Claude:** [`backend/app/assistant.py`](../backend/app/assistant.py) — ver también [asistente-creditos.md](asistente-creditos.md)
- **Motor Gemini:** [`backend/app/assistant_gemini.py`](../backend/app/assistant_gemini.py)
- **Frontend:** [`pages/Asistente.jsx`](../frontend/kai-project/src/pages/Asistente.jsx) y [`components/asistente/ChatSidebar.jsx`](../frontend/kai-project/src/components/asistente/ChatSidebar.jsx)

---

## 1. Qué comparten y qué no

Los dos motores ejecutan **exactamente las mismas diez herramientas** sobre la
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

### Las diez herramientas

| Herramienta | Para qué |
|---|---|
| `listar_rankings` | Catálogo con nivel, categoría, editor, métricas, universidades y años |
| `detalle_ranking` | Descripción y metodología completas, disciplinas y años con datos |
| `buscar_metricas` | Métricas de un ranking con tipo, peso y **en qué años rige ese peso** |
| `buscar_universidades` | Búsqueda por nombre o país; devuelve el id y su cobertura |
| `consultar_valores` | Corte transversal: qué sacó cada universidad en cada indicador de un año |
| `consultar_tendencia` | Serie histórica de una métrica |
| `consultar_ranking_resumen` | Score ponderado por universidad, con disciplina opcional |
| `buscar_cientificos` | Censo bibliométrico: h-index, citas, artículos, ranking global |
| `perfil_cientifico` | Ficha completa de un científico con sus indicadores y tópicos |
| `consulta_sql` | Salida de emergencia: SQL de solo lectura sobre las tablas académicas |

Las búsquedas por texto ignoran mayúsculas **y tildes**: la base guarda
«Pontificia Universidad Catolica de Valparaiso» sin acentos, pero tanto el
usuario como el modelo escriben «Católica».

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
este backend: el modelo la invoca, el proveedor busca y devuelve el resultado ya
incorporado al turno. No hay que contratar ni configurar ningún buscador aparte,
y el backend nunca abre una conexión saliente a internet por su cuenta.

| | Claude | Gemini |
|---|---|---|
| Herramientas | `web_search_20260209` y `web_fetch_20260209` | `google_search` y `url_context` |
| Cómo se declaran | Entradas sueltas en la lista de `tools` | **Dentro del mismo objeto `Tool`** que las funciones propias |
| Requisito extra | Ninguno | `tool_config.include_server_side_tool_invocations = True` |
| Cómo llega la ejecución | Bloques de resultado en la respuesta | Partes `toolCall`/`toolResponse`, distintas de las `functionCall` |
| Tope por turno | `CLAUDE_MAX_BUSQUEDAS` (5 por defecto) | Lo decide el proveedor |

Dos detalles de implementación que no son evidentes:

- **En Claude**, el `tool_runner` del SDK separa por sí mismo las herramientas
  que sabe ejecutar aquí de las que solo tiene que declarar, así que basta con
  añadir las de servidor a la lista. Como la respuesta final llega partida en
  varios bloques de texto con los resultados de búsqueda intercalados, se
  **concatenan todos**: quedarse con el primero devolvía la respuesta a medias.
- **En Gemini**, combinar herramientas integradas con funciones propias solo está
  disponible en los modelos **Gemini 3** y sigue en *Preview*. Si el proveedor
  rechazara la combinación, el motor se repliega a las herramientas de base de
  datos, responde igualmente y recuerda el rechazo para no repetir la llamada
  fallida en cada turno.

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
| `GEMINI_MODEL` | No | Por defecto `gemini-3.1-flash-lite`. Ver más abajo |

`GOOGLE_API_KEY` funciona como alternativa a `GEMINI_API_KEY`, por compatibilidad
con el nombre que usa el SDK.

### Cambiar de modelo

`gemini-3.1-flash-lite` es, al escribir esto (7 de septiembre de 2026), el modelo
más económico que Google sirve a claves nuevas y que admite llamada a funciones
—imprescindible aquí, porque el asistente no responde de memoria: consulta la
base de datos—. El identificador es configurable precisamente porque esto cambia:

```
GEMINI_MODEL=gemini-3.1-flash-lite
```

Tres comprobaciones antes de cambiarlo, todas aprendidas a la fuerza:

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

Los precios están en la [página de tarifas](https://ai.google.dev/gemini-api/docs/pricing);
los modelos vigentes, en la [lista de modelos](https://ai.google.dev/gemini-api/docs/models).

---

## 6. Costo y cuotas

Precios por millón de tokens:

| Motor | Entrada | Salida |
|---|---|---|
| `claude-opus-5` | 5,00 USD | 25,00 USD |
| `gemini-3.1-flash-lite` | 0,25 USD | 1,50 USD |

La entrada cuesta **20 veces menos** y la salida, **algo más de 16 veces menos**.
Medido sobre una consulta real —«¿qué rankings hay cargados?», que obliga al
modelo a llamar a una herramienta y leer su resultado— el motor Gemini consumió
1.192 tokens de entrada y 54 de salida: **0,00038 USD**.

Dos avisos sobre esa cifra, ahora que el asistente hace más cosas:

- Es **anterior** a la ampliación de herramientas y al panorama de datos que se
  añade al prompt. La entrada por turno ha subido: hay diez herramientas
  declaradas en vez de cinco, y una de ellas (`consulta_sql`) lleva el esquema
  completo en su descripción. Habrá que volver a medirla.
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
tope de ocho ciclos por turno impide que se quede reintentando.

---

## 8. Estado

Verificado con pruebas automatizadas contra la base de datos real: las diez
herramientas, la contención de `consulta_sql` (28 intentos de evasión, incluidos
los identificadores entre comillas y las subconsultas), el ciclo de herramientas
y la contabilidad de tokens y búsquedas de Gemini, su repliegue si el proveedor
rechaza la combinación, la traducción de errores, el bloqueo del motor dentro de
una conversación y el recorrido completo de `/chat` con autenticación real.

En Claude está verificado que el `tool_runner` separa correctamente las diez
herramientas locales de las dos de servidor y declara las doce a la API.

**No verificado contra el proveedor en vivo**, por falta de saldo en la cuenta de
Anthropic y de cuota diaria en la clave gratuita de Gemini el día de la
implementación:

- Que Claude use efectivamente `web_search` y devuelva citas.
- Que Gemini acepte en la práctica la combinación de `google_search` con las
  funciones propias. La forma de la petición sigue la documentación oficial de
  Google y el SDK la admite; el repliegue automático cubre el caso de que no.

La primera consulta real de cada motor confirmará ambas cosas.
