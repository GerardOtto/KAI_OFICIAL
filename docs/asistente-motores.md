# Los dos motores del asistente: Claude y Gemini

El asistente de KAI puede responder con dos modelos distintos. La elección no es
un detalle de configuración del servidor: la hace el usuario en cada
conversación, según el tipo de pregunta.

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

Los dos motores ejecutan **exactamente las mismas cinco herramientas** sobre la
misma base de datos, con la misma instrucción de sistema. Están definidas una
sola vez, en `herramientas.py`, como funciones normales de Python; de ahí se
derivan los dos formatos de declaración que exigen los proveedores. Si una
consulta SQL cambia, cambia para ambos: no hay dos versiones que puedan
desincronizarse.

Lo único propio de cada módulo es la traducción al protocolo del proveedor y la
de sus errores. Ambos devuelven la misma estructura —texto, tokens de entrada,
tokens de salida, modelo, motor y si la llamada fue exitosa—, de modo que el
endpoint `/chat` no necesita saber cuál respondió.

---

## 2. Por qué un motor no se puede cambiar a mitad de conversación

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

## 3. Configurar el motor Gemini

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

Dos comprobaciones antes de cambiarlo, ambas aprendidas a la fuerza:

- **Que el modelo admita *function calling***. Uno que no lo haga arrancará sin
  error y fallará en la primera consulta.
- **Que la API lo sirva de verdad.** Que aparezca en `models.list()` del SDK no
  basta: `gemini-2.5-flash-lite` sigue listado y es más barato (0,10 / 0,40 USD),
  pero la API responde *«no longer available to new users»* y remite a la
  generación siguiente. La única prueba fiable es una consulta real.

Los precios están en la [página de tarifas](https://ai.google.dev/gemini-api/docs/pricing);
los modelos vigentes, en la [lista de modelos](https://ai.google.dev/gemini-api/docs/models).

---

## 4. Costo y cuotas

Precios por millón de tokens:

| Motor | Entrada | Salida |
|---|---|---|
| `claude-opus-5` | 5,00 USD | 25,00 USD |
| `gemini-3.1-flash-lite` | 0,25 USD | 1,50 USD |

La entrada cuesta **20 veces menos** y la salida, **algo más de 16 veces menos**.
Medido sobre una consulta real —«¿qué rankings hay cargados?», que obliga al
modelo a llamar a una herramienta y leer su resultado— el motor Gemini consumió
1.192 tokens de entrada y 54 de salida: **0,00038 USD**.

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

**La cuota del usuario cuenta los tokens igual en ambos motores.** Es decir, un
usuario del plan gratuito agota sus 200.000 tokens mensuales a la misma velocidad
use el motor que use, aunque a la institución le cueste cincuenta veces menos.
Se hizo así por claridad: un contador único es comprensible y auditable, mientras
que ponderar por costo obligaría a explicar en la interfaz por qué el mismo
mensaje descuenta cantidades distintas.

Si más adelante se quiere que el motor barato rinda más cuota, el cambio está
acotado: `mensaje.modelo` ya guarda con qué modelo se generó cada respuesta, así
que basta ponderar la suma en `consumo_del_mes()`
([`conversaciones.py`](../backend/app/conversaciones.py)) sin migrar ningún dato.

El resto del control de cuotas —planes, límite diario, qué ocurre al agotarlas—
está en [autenticacion.md](autenticacion.md#4-consumo-de-tokens-y-cuotas).

---

## 5. Diagnóstico

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

## 6. Estado

Implementado y verificado con pruebas automatizadas: el ciclo de herramientas y
la contabilidad de tokens de Gemini, la traducción de sus errores, el bloqueo del
motor dentro de una conversación, el aislamiento del contexto entre conversaciones
de motores distintos y la derivación desde la interfaz.

Pendiente: la clave `GEMINI_API_KEY`, que hay que generar y configurar. Sin ella
el motor queda visible pero deshabilitado, sin afectar al resto de la aplicación.
