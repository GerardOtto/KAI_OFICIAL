# Autenticación de usuarios, conversaciones y consumo de tokens

Cómo funciona el acceso a KAI, cómo habilitar el ingreso con Google y cómo se
controla el uso del asistente.

- **Backend:** [`auth.py`](../backend/app/auth.py) (contraseñas, JWT, Google) y [`conversaciones.py`](../backend/app/conversaciones.py) (historial y cuotas).
- **Frontend:** [`auth/AuthContext.jsx`](../frontend/kai-project/src/auth/AuthContext.jsx), [`auth/BotonGoogle.jsx`](../frontend/kai-project/src/auth/BotonGoogle.jsx), [`auth/RutaProtegida.jsx`](../frontend/kai-project/src/auth/RutaProtegida.jsx).

---

## 1. Cómo funciona la sesión

El sistema emite **siempre su propio JWT**, tanto si el usuario entró con correo
y contraseña como si lo hizo con Google. El resto de la aplicación no necesita
saber cómo se autenticó nadie: solo valida un token.

```
Correo + contraseña ─┐
                     ├──▶  JWT propio (HS256, 12 h)  ──▶  Authorization: Bearer …
Cuenta de Google  ───┘
```

- **Algoritmo:** HS256 con el secreto de `JWT_SECRET`.
- **Vigencia:** 12 horas (ajustable con `JWT_HORAS_VALIDEZ`). Al expirar, el
  frontend detecta el 401, descarta el token y vuelve a pedir acceso.
- **Contraseñas:** bcrypt con sal por usuario. Nunca se guardan ni se devuelven
  en claro; el perfil que viaja al cliente no incluye el campo.
- **Almacenamiento en el cliente:** `localStorage`. Es lo práctico para una SPA
  con la API en otro origen. La alternativa más segura sería una cookie
  `httpOnly`, que protege frente a XSS pero exige `SameSite=None; Secure` y
  manejo de CSRF; queda como mejora si el proyecto pasa a producción real.

### Endpoints

| Método | Ruta | Requiere sesión | Para qué |
|---|---|---|---|
| GET | `/auth/config` | no | Indica si el ingreso con Google está habilitado |
| POST | `/auth/registro` | no | Crear cuenta con correo y contraseña |
| POST | `/auth/login` | no | Iniciar sesión |
| POST | `/auth/google` | no | Registro o ingreso con cuenta de Google |
| GET | `/auth/yo` | sí | Perfil y estado de cuota |
| GET | `/conversaciones` | sí | Listado de conversaciones |
| GET | `/conversaciones/{id}` | sí | Una conversación con sus mensajes |
| PATCH | `/conversaciones/{id}` | sí | Renombrar |
| DELETE | `/conversaciones/{id}` | sí | Eliminar |
| GET | `/uso` | sí | Consumo del mes y límites |
| GET | `/motores` | no | Motores del asistente y cuáles están configurados |
| POST | `/chat` | sí | Consultar al asistente |

Los módulos de rankings, tendencias, simulación e investigadores **siguen siendo
públicos**. Solo el asistente exige cuenta, porque es el único que consume un
servicio de pago.

---

## 2. Habilitar el ingreso con Google

Está implementado y solo falta la credencial. Sin ella la aplicación funciona
igual: el botón simplemente no se muestra.

### Cómo funciona

Se usa **Google Identity Services** con el flujo de *ID token*:

1. El navegador muestra el botón oficial de Google y el usuario elige su cuenta.
2. Google devuelve un **ID token**: un JWT firmado por Google.
3. El frontend lo envía a `POST /auth/google`.
4. El backend lo verifica con la biblioteca oficial `google-auth`, comprobando
   firma, emisor, caducidad y **audiencia** (que el token fuera emitido para
   esta aplicación y no para otra).
5. El backend crea o reconoce al usuario y emite su propio JWT.

El navegador nunca maneja un *client secret*: no hay ninguno en el frontend.

### Pasos a seguir

1. Entra en <https://console.cloud.google.com/> y crea un proyecto (o usa uno existente).
2. Ve a **APIs y servicios → Pantalla de consentimiento de OAuth**. Configúrala
   como **Externa**, con el nombre de la aplicación y un correo de contacto.
   Mientras esté en modo de prueba, solo podrán entrar las cuentas que agregues
   como usuarios de prueba.
3. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
4. Tipo de aplicación: **Aplicación web**.
5. En **Orígenes autorizados de JavaScript** agrega, sin barra final:
   ```
   http://localhost:5173
   https://kaioficial-production.up.railway.app
   ```
   Este flujo no usa redirección, así que no hace falta completar los URI de redireccionamiento.
6. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`) y pégalo en `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=123456789-xxxxxxxx.apps.googleusercontent.com
   ```
7. Reinicia el backend. El botón «Continuar con Google» aparecerá solo.

> El *client secret* no se necesita para este flujo. Si lo generas, no lo pongas
> en el frontend.

### Vinculación de cuentas

Si alguien se registró con correo y contraseña y luego entra con Google usando
**ese mismo correo**, la cuenta de Google se vincula al usuario existente en
lugar de crear un duplicado. A partir de ahí puede entrar por cualquiera de las
dos vías. A la inversa, si una cuenta se creó con Google y alguien intenta
entrar con contraseña, el sistema lo indica explícitamente en vez de responder
«credenciales incorrectas».

---

## 3. Conversaciones

Cada consulta al asistente pertenece a una conversación del usuario:

- La primera consulta crea la conversación y toma su título de las primeras
  palabras del mensaje.
- Cada conversación queda ligada a **un motor** (Claude o Gemini) al crearse y no
  puede cambiarlo después; para pasar una pregunta al otro modelo se deriva a una
  conversación nueva. El porqué y cómo, en
  [asistente-motores.md](asistente-motores.md#2-por-qué-un-motor-no-se-puede-cambiar-a-mitad-de-conversación).
- El historial se reconstruye **en el servidor**, no se recibe del cliente. Así
  el cliente no puede inyectar turnos falsos ni inflar el contexto que se
  factura, y la conversación sobrevive a un cambio de dispositivo.
- Solo se envían al modelo los últimos 20 mensajes: la API es sin estado y
  reenvía todo el historial en cada llamada, así que sin tope una conversación
  larga encarecería cada turno.
- Si la llamada al proveedor falla, el turno se descarta por completo (mensaje
  del usuario incluido, y la conversación si se había creado para ese turno).
  De lo contrario el historial arrastraría un mensaje de error que el modelo
  leería después como si fuera suyo.

---

## 4. Consumo de tokens y cuotas

El consumo se registra **por mensaje**, no como un contador en la fila del
usuario. Así el gasto es auditable, se puede recalcular por período y borrar una
conversación no descuadra ningún contador.

Cada respuesta del asistente guarda `tokens_entrada` y `tokens_salida`, sumando
todas las llamadas del ciclo de herramientas —no solo la última—, e incluyendo
los tokens de lectura y escritura de caché.

### Planes

La cuota es **de cada motor por separado**, porque un token de Claude cuesta unas
veinte veces más que uno de Gemini y una bolsa común desligaría el precio del
costo. Las cuentas nuevas quedan en `free`, que incluye Gemini pero no Claude.

El catálogo, los precios, el cálculo del margen y cómo cambiar cualquiera de los
dos están en **[planes.md](planes.md)**.

### Qué ocurre al alcanzar el límite

`POST /chat` responde **403** si el plan no incluye el motor —se resuelve
contratando— y **429** si la cuota se agotó —se resuelve esperando—. El frontend
muestra el motivo y deshabilita lo que corresponda. El límite mensual se
restablece el día 1; el diario, al día siguiente. Agotar un motor no bloquea el
otro.

---

## 5. Variables de entorno

```
JWT_SECRET=…            # obligatoria; sin ella la autenticación devuelve 503
JWT_HORAS_VALIDEZ=12    # opcional
GOOGLE_CLIENT_ID=…      # opcional; si falta, el botón de Google no se muestra
```

`JWT_SECRET` se generó automáticamente en `backend/.env`. **Cambiarla invalida
todas las sesiones activas**, lo que sirve como mecanismo de emergencia si se
sospecha que un token quedó expuesto. En Railway hay que definir ambas variables
en la configuración del servicio, no en `.env`.

---

## 6. Estado y pendientes

Implementado y verificado: registro, ingreso, protección de rutas, aislamiento
entre usuarios, persistencia de conversaciones, contabilidad de tokens y cuotas.

Pendiente:

- **Recuperación de contraseña.** No hay flujo de restablecimiento; requiere
  envío de correo. Mientras tanto, una cuenta sin contraseña recuperable puede
  entrar con Google si usa el mismo correo.
- **Tokens de refresco.** Al expirar el JWT hay que volver a iniciar sesión.
- **Verificación de correo en el registro local.** Las cuentas de Google llegan
  con el correo ya verificado; las locales no se verifican.
- **Revocación de sesiones.** No hay lista de tokens revocados; el único
  mecanismo es rotar `JWT_SECRET`.
