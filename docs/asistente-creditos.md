# Asistente de chat: créditos, clave de API y diagnóstico

Cómo mantener operativo el asistente de KAI (`/asistente`), qué hacer cuando deja
de responder y cómo cargar saldo para la compra de tokens.

- **Backend:** [`backend/app/assistant.py`](../backend/app/assistant.py) — modelo, herramientas y manejo de errores.
- **Endpoint:** `POST /chat` en [`backend/app/main.py`](../backend/app/main.py).
- **Frontend:** [`frontend/kai-project/src/pages/Asistente.jsx`](../frontend/kai-project/src/pages/Asistente.jsx).
- **Modelo en uso:** `claude-opus-5` con `effort: "medium"` y 5 herramientas que consultan la base de datos.

> **Estado al 6 de septiembre de 2026:** la clave configurada en `backend/.env`
> está bien formada (108 caracteres, prefijo `sk-ant-api03-`, sin espacios) pero la
> API responde `401 — API key is invalid`. **El bloqueo actual es la clave, no el
> saldo.** Hasta reemplazarla no es posible consultar el saldo de la cuenta, porque
> para leerlo hace falta una credencial válida. Ve a la sección
> [Reemplazar la clave](#2-reemplazar-la-clave-de-api).

---

## 1. Cómo se cobra

La API de Claude es **de prepago**: se compran créditos en dólares y cada llamada
descuenta según los tokens consumidos. No hay plan mensual fijo ni mínimo de gasto.

Precio de `claude-opus-5` (el modelo que usa el asistente):

| Concepto | Precio por millón de tokens |
|---|---|
| Entrada (lo que se le envía) | 5 USD |
| Salida (lo que responde) | 25 USD |

Cada consulta del asistente envía el prompt de sistema, las 5 definiciones de
herramientas, el historial de la conversación y los resultados de las consultas a
la base de datos. En la práctica, **una consulta típica ronda los 0,01–0,03 USD**,
así que 20 USD dan para varios cientos de preguntas. El consumo real se ve en
<https://platform.claude.com/usage>.

Dos formas de abaratarlo, si algún día hace falta:

- Activar **prompt caching** sobre el prompt de sistema y las herramientas (son
  idénticos en cada llamada): las lecturas de caché cuestan una fracción del precio
  de entrada.
- Bajar `effort` a `"low"` en `assistant.py`, o cambiar a `claude-sonnet-5`
  (2 / 10 USD por millón).

---

## 2. Reemplazar la clave de API

Necesario ahora mismo. Requiere una cuenta con acceso a la organización en la consola.

1. Entra en <https://platform.claude.com/settings/keys>.
2. Pulsa **Create key**.
3. Rellena:
   - **Nombre:** algo identificable, por ejemplo `kai-backend-produccion`.
   - **Expiración:** hay presets de 3 horas, 1 día, 7 días y 30 días, duración
     personalizada, o **Never**. Para un backend que corre siempre, elige `Never`
     (o el máximo que permita la política de la organización) y rota la clave
     manualmente; si eliges una fecha, apúntala, porque **una clave expirada no se
     puede reactivar** y devuelve `401` sin previo aviso.
   - **Linked account:** para un servicio compartido lo correcto es una *service
     account*, no una clave personal. Una clave personal actúa como esa persona y
     **deja de funcionar si sale de la organización**. Si no hay service account,
     un administrador puede crearla en
     <https://platform.claude.com/settings/service-accounts>.
   - **Workspace:** si acotas la clave a un workspace concreto, no hace falta
     mandar la cabecera `anthropic-workspace-id` en cada petición. Si la dejas sin
     acotar y la organización tiene varios workspaces, **hay que mandarla** o la
     API responde `400`.
4. Copia la clave. **Solo se muestra una vez.**
5. Pégala en `backend/.env`:

   ```
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

6. **Reinicia el backend.** El cliente se construye al importar el módulo, así que
   una clave nueva no se toma en caliente:

   ```bash
   cd backend
   venv/Scripts/uvicorn.exe app.main:app --reload --port 8000
   ```

7. Borra la clave vieja en la consola, una vez confirmes que la nueva funciona.

> En Railway la variable no se lee de `.env`: hay que definir `ANTHROPIC_API_KEY`
> en las variables de entorno del servicio y redesplegar.
>
> `.env` **no debe subirse al repositorio.** Verifica que está en `.gitignore`.

---

## 3. Cargar créditos

1. Entra en <https://platform.claude.com/settings/billing>.
2. Añade un medio de pago si aún no hay ninguno.
3. Compra créditos por el monto que quieras. El saldo queda disponible de
   inmediato y se consume por uso.
4. Si existe la opción de **recarga automática** (auto-reload), actívala con un
   umbral: evita que el asistente se caiga a mitad de una demo. Es la causa más
   común de corte en cuentas con poco saldo.

> No puedo verificar aquí las etiquetas exactas de los botones de compra, porque la
> página requiere sesión iniciada. La ruta (`Settings → Billing`) sí está
> confirmada en la documentación oficial.

### Topes de gasto

Aparte del saldo, cada organización tiene un **tope de gasto mensual** según su
nivel de uso (*usage tier*):

| Nivel | Tope mensual |
|---|---|
| Start | 500 USD |
| Build | 1.000 USD |
| Scale | 200.000 USD |
| Custom | sin tope |

Al alcanzarlo, la API deja de responder **hasta las 00:00 UTC del día 1 del mes
siguiente**, aunque quede saldo. Reintentar no sirve. Se sube pidiendo un
incremento en <https://platform.claude.com/settings/limits>.

También se puede fijar un tope propio por debajo del de tu nivel, en la misma
página de Billing (sección *Spend limits* → *Adjust limit*). Es lo recomendable
para un proyecto académico: pon un techo de, por ejemplo, 20 USD al mes y no habrá
sorpresas.

---

## 4. Qué responde el asistente ante cada fallo

Verificado inyectando cada excepción del SDK en `responder()`. Ningún caso deja
caer una excepción sin manejar (eso produciría un 500 y el frontend mostraría el
mensaje genérico "No se pudo contactar al asistente", que despista).

| Situación | Código | Qué ve el usuario | Qué hay que hacer |
|---|---|---|---|
| Clave inválida, revocada o expirada | 401 | "La clave de la API de Claude no es válida, fue revocada o expiró…" | [Sección 2](#2-reemplazar-la-clave-de-api) |
| **Sin créditos** | 400 | "La cuenta de Anthropic se quedó sin créditos…" | [Sección 3](#3-cargar-créditos) |
| Problema de facturación / medio de pago | 402 | "Hay un problema con la facturación o el medio de pago…" | Revisar la tarjeta en Billing |
| **Tope de gasto mensual alcanzado** | 429 | "…El acceso se restablece el día 1 del mes siguiente…" | Subir el nivel en Limits |
| Tope de gasto puesto a mano | 400 | "Se alcanzó el límite de gasto configurado manualmente…" | Subirlo o quitarlo en Billing |
| Demasiadas solicitudes (pico real) | 429 | "…Espera unos segundos y vuelve a intentar." | Reintentar |
| Clave sin permiso para el modelo | 403 | "La clave de la API no tiene permiso para usar este modelo…" | Revisar permisos/workspace |
| Modelo inexistente | 404 | "El modelo 'claude-opus-5' no existe o no está habilitado…" | Revisar `MODEL` en `assistant.py` |
| API caída o sobrecargada | 500 / 529 | "El servicio de IA está caído o sobrecargado…" | Reintentar en minutos |
| Sin red en el servidor | — | "No se pudo conectar con la API de Claude…" | Revisar conectividad |
| Tarda demasiado | — | "El asistente tardó demasiado en responder…" | Acotar la consulta |
| Falla una herramienta (BD caída) | — | "El asistente falló al procesar la consulta…" | Revisar logs y PostgreSQL |

Los dos casos en **negrita** se confunden con facilidad y son distintos: *sin
créditos* es saldo agotado (se arregla comprando); *tope mensual* es un límite
administrativo que no se levanta pagando más, sino subiendo de nivel o esperando
al mes siguiente. Un 429 puede ser cualquiera de los dos; el backend los distingue
leyendo `error.details.error_code == "enforced_spend_limit_reached"`.

---

## 5. Comprobar que funciona

**Comprobación rápida de la clave** (no gasta créditos si la clave es inválida;
si es válida gasta una fracción de centavo):

```bash
cd backend
venv/Scripts/python.exe -c "import os; from dotenv import load_dotenv; load_dotenv(); import anthropic; c=anthropic.Anthropic(); print(c.messages.create(model='claude-opus-5', max_tokens=16, messages=[{'role':'user','content':'di OK'}]).content[0].text)"
```

- Imprime `OK` → clave y saldo correctos.
- `AuthenticationError (401)` → clave inválida, ver [sección 2](#2-reemplazar-la-clave-de-api).
- `BadRequestError` con *credit balance* → sin saldo, ver [sección 3](#3-cargar-créditos).

**Prueba de extremo a extremo** (backend corriendo en el puerto 8000):

```bash
curl -s -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Cuantos rankings hay cargados?"}]}'
```

Debe devolver `{"role":"assistant","content":"..."}` con una respuesta real. Si
devuelve uno de los mensajes de la tabla de arriba, ese mensaje ya te dice qué
arreglar.

**Dónde mirar el consumo:** <https://platform.claude.com/usage> (tokens, coste y
tasa de aciertos de caché). Los límites vigentes: <https://platform.claude.com/settings/limits>.

---

## 6. Notas de mantenimiento

- El cliente `Anthropic()` se instancia al importar `assistant.py`, y lee
  `ANTHROPIC_API_KEY` del entorno. `main.py` llama a `load_dotenv()` **antes** de
  importarlo; si se altera ese orden, la clave dejará de cargarse.
- El texto exacto de los errores lo fija Anthropic y puede cambiar. Por eso
  `assistant.py` busca varias señales (`SENALES_SIN_CREDITO`, `SENALES_TOPE_PROPIO`)
  en vez de una sola cadena. Si algún día un error de saldo se muestra como
  "parámetros inválidos", hay que añadir la señal nueva a esa lista.
- El orden de los `except` importa: `AuthenticationError`, `PermissionDeniedError`,
  `NotFoundError`, `RateLimitError` y `BadRequestError` son todas subclases de
  `APIStatusError` y deben ir antes que ella.
