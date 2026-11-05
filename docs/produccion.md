# KAI — Guía de salida a producción

*Lo que te toca hacer a ti, paso a paso y en orden. Versión del 5 de noviembre de 2026.*

> Hay una versión para imprimir y marcar: [`guia-salida-a-produccion.pdf`](guia-salida-a-produccion.pdf).

El código quedó limpio, optimizado y probado. Lo que falta requiere acceso a Railway, GitHub y Google, así que solo puedes hacerlo tú. Sigue las fases **en orden**: cada paso dice cómo comprobar que salió bien y qué hacer si falla. Marca cada casilla al terminar.

Reserva **unas dos horas** para las fases 0 a 6, en un momento de poco uso: al publicar, todas las sesiones se cierran una vez y cada persona tendrá que volver a entrar. Las fases 7 y 8 pueden hacerse justo después.

**Lo esencial**

- El orden importa: respaldo → migraciones 018 a 024 → cargador de rankings → variables → Google → publicar → verificar.
- Lo más urgente en seguridad: el usuario de base `kai_asistente` y la variable `DATABASE_URL_ASISTENTE` (pasos 2.4 y 3.1).
- Las migraciones se pueden repetir sin riesgo, y si una falla no deja nada a medias.
- Si algo sale mal, la última sección explica cómo volver atrás.

**Lo que ya está hecho y probado**

- El camino completo de la base, sobre una copia en el mismo estado que producción (migración 017): 018 → 024 y el cargador, sin errores; una segunda pasada ya no cambia nada.
- Backend: 22 baterías, con 849 a 913 comprobaciones según el estado de la base, sin fallas. Navegador: 21 sondas y 591 comprobaciones, sin fallas.
- Accesibilidad (WCAG AA) sin infracciones en escritorio y móvil; la política de contenido no bloquea nada, ni al generar informes.
- El backend arranca y responde con solo sus 39 dependencias, sin selenium ni pillow.

## Lista de verificación

- [ ] **0.1** Ten a mano los accesos y las herramientas
- [ ] **0.2** Prepara el entorno de Python del cargador de rankings
- [ ] **0.3** Guarda la dirección pública de la base en la terminal
- [ ] **0.4** Mira qué migraciones tiene producción
- [ ] **1.1** Respalda la base de producción
- [ ] **2.1** Aplica las migraciones 018 a 024, una por una y en este orden
- [ ] **2.2** Carga las ediciones de los rankings
- [ ] **2.3** Confirma el estado final
- [ ] **2.4** Crea el usuario de base del asistente — *urgente*
- [ ] **3.1** Servicio del backend → Variables — *urgente*
- [ ] **3.2** Servicio del frontend → Variables
- [ ] **4.1** Revisa los orígenes autorizados
- [ ] **4.2** Publica la pantalla de consentimiento — *urgente*
- [ ] **5.1** Sube los cambios en un Pull Request
- [ ] **5.2** Fusiona el Pull Request
- [ ] **6.1** Recorre el sitio
- [ ] **7.1** Agrega el secreto de la base
- [ ] **7.2** Permite que Actions abra Pull Requests
- [ ] **7.3** Pruébalo una vez
- [ ] **8.1** Cambia la contraseña de la cuenta de administración — *urgente*
- [ ] **8.2** Cambia la clave local de PostgreSQL
- [ ] **8.3** Decide si limpiar el historial de git (opcional)

## Fase 0 · Preparación (15 min)

### 0.1 Ten a mano los accesos y las herramientas

Accesos de administración a **Railway** (el proyecto de KAI), **GitHub** (el repositorio) y **Google Cloud Console** (el proyecto del ID de cliente de OAuth).

En tu equipo: el repositorio al día, **Python 3.12** y el cliente de PostgreSQL (`psql` y `pg_dump`, versión 16 o superior). En Windows suelen estar en `C:\Program Files\PostgreSQL\18\bin\`; si la terminal no los encuentra, escribe la ruta completa entre comillas, precedida de `&`.

```
psql --version
pg_dump --version
python --version
```

**Comprueba:** Los tres comandos responden con su versión.

### 0.2 Prepara el entorno de Python del cargador de rankings

Desde la carpeta del repositorio. El cargador tiene ahora su propio archivo de dependencias: el del backend ya no incluye las suyas.

```
python -m venv venv
venv\Scripts\Activate.ps1          # Windows (PowerShell)
source venv/bin/activate          # macOS o Linux
pip install -r tools/rankings/requirements.txt
```

**Comprueba:** `pip` termina sin errores. Deja esta terminal abierta: la usarás en las fases 0 a 2.

**Si falla:** Si PowerShell responde que la ejecución de scripts está deshabilitada, ejecuta `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` (vale solo para esa ventana) y vuelve a activar el entorno.

### 0.3 Guarda la dirección pública de la base en la terminal

En Railway: servicio **PostgreSQL** → pestaña **Variables** → copia `DATABASE_PUBLIC_URL` (la pública; la interna, `postgres.railway.internal`, solo funciona dentro de Railway). **Es una credencial**: no la pegues en chats, documentos ni commits. Los comandos de esta guía la usan como `$URL`; defínela en la misma terminal:

```
$URL = 'postgresql://postgres:CLAVE@HOST.proxy.rlwy.net:PUERTO/railway'   # PowerShell
URL='postgresql://postgres:CLAVE@HOST.proxy.rlwy.net:PUERTO/railway'     # macOS o Linux
psql "$URL" -c "SELECT 1"
```

Las comillas simples al definirla importan: con dobles, un signo `$` en la contraseña se interpretaría y la URL quedaría mal sin avisar.

**Comprueba:** La última línea responde con una fila que dice `1`.

**Si falla:** Revisa que copiaste la URL completa, entre comillas simples.

### 0.4 Mira qué migraciones tiene producción

```
psql "$URL" -f backend/migraciones/ver_estado.sql
```

**Comprueba:** Lo esperado hoy: las siete filas (018 a 024) dicen «NO». Si alguna dice «sí», no importa: todas se pueden volver a aplicar sin cambiar nada.

## Fase 1 · Respaldo (10 min)

### 1.1 Respalda la base de producción

Antes de cambiar nada. El archivo contiene los datos de las cuentas: por eso se guarda en la carpeta de arriba (`../`), **fuera del repositorio**, para que nunca termine en un commit. No lo compartas.

```
pg_dump "$URL" -F c -f ../kai_respaldo_2026-11-05.dump
```

**Comprueba:** El archivo existe y pesa más de unos cientos de kilobytes.

**Si falla:** Si dice «server version mismatch», tu `pg_dump` es más antiguo que el servidor: usa el de la versión del servidor (por ejemplo, el de `PostgreSQL\18\bin`).

## Fase 2 · Base de datos (25 min)

### 2.1 Aplica las migraciones 018 a 024, una por una y en este orden

Desde la carpeta del repositorio. Con `ON_ERROR_STOP=1`, un error detiene la migración y la deshace entera: nunca queda a medias. **No cambies el orden**: la 018 tiene que ir antes que la 020.

```
psql "$URL" -v ON_ERROR_STOP=1 -f backend/migraciones/018_catalogo_de_universidades.sql
psql "$URL" -v ON_ERROR_STOP=1 -f backend/migraciones/019_rol_del_asistente.sql
psql "$URL" -v ON_ERROR_STOP=1 -f backend/migraciones/020_puntaje_total.sql
psql "$URL" -v ON_ERROR_STOP=1 -f backend/migraciones/021_gras_por_edicion.sql
psql "$URL" -v ON_ERROR_STOP=1 -f backend/migraciones/022_grupos_de_comparacion.sql
psql "$URL" -v ON_ERROR_STOP=1 -f backend/migraciones/023_posicion_y_actualizacion.sql
psql "$URL" -v ON_ERROR_STOP=1 -f backend/migraciones/024_the_world.sql
```

**Comprueba:** Cada una termina con su aviso (NOTICE): 018 «UNIACC fusionada…» o «UNIACC ya figura una sola vez»; 019 «kai_asistente lee solo las 8 tablas académicas»; 020 «puntajes totales cargados…»; 021 «GRAS 2017-2023: …»; 022 «grupo_comparacion lista»; 023 «posicion_oficial y estado_ranking listas…»; 024 «THE World listo…».

**Si falla:** Si una muestra ERROR, **detente** y no sigas con la siguiente: nada de esa migración quedó aplicado. Copia el mensaje completo y pide ayuda.

### 2.2 Carga las ediciones de los rankings

La primera línea solo revisa (no escribe nada), la segunda carga y la tercera confirma. Contra Railway puede tardar unos minutos.

```
python tools/rankings/cargar.py --url "$URL"
python tools/rankings/cargar.py --url "$URL" --escribir
python tools/rankings/cargar.py --url "$URL"
```

**Comprueba:** La revisión no muestra ninguna sección «RECHAZADA». Con `--escribir` aparecen CARGADA, COMPLETADA, POSICIONES ACTUALIZADAS y ESTADO ACTUALIZADO (en la simulación fueron 16, 7, 64 y 8). La tercera ejecución dice solo COINCIDE.

**Si falla:** Si alguna edición sale RECHAZADA, no uses `--reemplazar`: guarda la salida y pide ayuda.

### 2.3 Confirma el estado final

```
psql "$URL" -f backend/migraciones/ver_estado.sql
```

**Comprueba:** Las siete filas dicen «sí».

### 2.4 Crea el usuario de base del asistente (urgente)

Es la protección de la consulta SQL libre del asistente que no depende de su filtro. Se probó: sin este usuario, si el filtro llegara a fallar, una consulta puede recuperar privilegios de superusuario y leer la tabla de cuentas; con él, PostgreSQL la rechaza («permission denied to set role»).

Genera una contraseña (solo letras, números, guiones y guiones bajos, para no tener que codificarla en la URL) y asígnala:

```
python -c "import secrets; print(secrets.token_urlsafe(32))"
psql "$URL"
ALTER ROLE kai_asistente LOGIN;
\password kai_asistente
\q
```

Las tres últimas líneas se escriben dentro de `psql`. `\password` pide la clave dos veces sin que quede en el historial. Guárdala: la usarás en el paso 3.1.

**Comprueba:** Conectado como `kai_asistente` (misma URL pública, cambiando usuario y clave), `SELECT count(*) FROM ranking` responde un número y `SELECT count(*) FROM usuario` responde «permission denied».

## Fase 3 · Variables en Railway (15 min)

### 3.1 Servicio del backend → Variables (urgente)

| Variable | Qué poner |
|---|---|
| `JWT_SECRET` | Una nueva de al menos 32 bytes: `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Cambiarla cierra todas las sesiones (igual ocurrirá al publicar). |
| `DATABASE_URL_ASISTENTE` | `postgresql://kai_asistente:CLAVE@HOST:PUERTO/BASE`, con la clave del paso 2.4 y los valores internos de las variables `PGHOST`, `PGPORT` y `PGDATABASE` del servicio PostgreSQL (habitualmente `postgres.railway.internal`, `5432` y `railway`). |
| Deben existir | `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `CONTACTO_DESTINO`, `SMTP_USUARIO`, `SMTP_CLAVE`. |
| No definas | `KAI_CORS_LOCALHOST` ni `KAI_ENTORNO`: Railway se detecta solo y activa el modo producción. |
| Solo con dominio propio | `KAI_ORIGENES=https://tu-dominio` (sin barra final). |

**Comprueba:** Las variables quedan guardadas. Si Railway muestra «cambios pendientes», aplícalos con Deploy.

### 3.2 Servicio del frontend → Variables

`VITE_API_URL` = la URL pública del backend, con `https://` y **sin barra final** (la ves en el servicio del backend → Settings → Networking). Se incrusta al compilar: si la cambias, hay que volver a desplegar. Sin ella, la compilación se detiene a propósito.

**Comprueba:** El valor coincide letra por letra con la URL pública del backend.

## Fase 4 · Google Cloud Console (10 min)

### 4.1 Revisa los orígenes autorizados

APIs y servicios → Credenciales → tu ID de cliente de OAuth (aplicación web) → **Orígenes autorizados de JavaScript**. Debe figurar `https://kaioficial-production.up.railway.app` (sin barra final), y tu dominio propio si tienes uno.

**Comprueba:** El origen está en la lista y guardaste los cambios.

### 4.2 Publica la pantalla de consentimiento (urgente)

APIs y servicios → **Pantalla de consentimiento de OAuth**. Si el estado de publicación es «Prueba» (Testing), pulsa **Publicar aplicación**. Mientras esté en prueba, solo entran con Google las cuentas agregadas como usuarias de prueba, y el asistente exige entrar con Google. Con los permisos básicos que usa KAI (correo y perfil) no hace falta la verificación de Google.

**Comprueba:** El estado dice «En producción».

## Fase 5 · Publicar el código (20 min)

### 5.1 Sube los cambios en un Pull Request

Así las pruebas automáticas corren antes de que el código llegue a producción.

```
git switch -c salida-a-produccion
git add -A
git commit -m "Versión para producción"
git push -u origin salida-a-produccion
```

En GitHub, abre el Pull Request que te propone («Compare & pull request») y espera el check de **Pruebas** (unos cinco minutos).

**Comprueba:** «Pruebas» termina en verde.

**Si falla:** Si sale en rojo, no fusiones: abre el detalle del check y pide ayuda con el error.

### 5.2 Fusiona el Pull Request

**Merge pull request**. Railway despliega el backend y el frontend desde `main` (si no lo hace solo, usa Deploy en cada servicio).

**Comprueba:** En Railway, los dos servicios terminan en «Success». En el registro del backend **no** aparece «JWT_SECRET tiene menos de 32 bytes», y en la compilación del frontend no aparece «Falta VITE_API_URL».

**Si falla:** Si un despliegue falla, el anterior sigue en línea: revisa el registro de compilación (Build Logs) y pide ayuda.

## Fase 6 · Verificación en producción (20 min)

### 6.1 Recorre el sitio

- [ ] `https://<backend>/` responde `{"message":"API funcionando"}`, y `https://<backend>/docs` responde «Not Found» (la documentación interactiva queda cerrada en producción).
- [ ] La portada carga rápido, con los títulos en Noto Serif y el texto en Manrope.
- [ ] Puedes crear una cuenta con correo y entrar con «Continuar con Google» con una cuenta PUCV.
- [ ] Resumen: al cambiar de ranking, junto a cada nombre aparece «oficial N», y en Scimago Latam se ve el aviso de la edición 2026.
- [ ] Tendencias, Simulación (Comparada, Unitaria y Objetivo) y Glosario muestran datos.
- [ ] Con una cuenta de pago o de administración, descarga un PDF y un Excel (las gratuitas tienen un solo informe por módulo).
- [ ] Asistente, con una cuenta PUCV que entró con Google: «¿Cuántos rankings hay cargados?» recibe respuesta.
- [ ] En el celular: el Resumen muestra los nombres y «Historial» abre el panel del asistente.
- [ ] Con F12 → Consola: no hay errores en rojo, en especial ninguno que diga «Content Security Policy».

**Si falla:** Busca el síntoma en «Si algo sale mal», al final de esta guía.

## Fase 7 · GitHub: revisión mensual de rankings (5 min)

### 7.1 Agrega el secreto de la base

Settings → Secrets and variables → Actions → **New repository secret**. Nombre `DATABASE_URL_RANKINGS`; valor: la `DATABASE_PUBLIC_URL` del paso 0.3.

### 7.2 Permite que Actions abra Pull Requests

Settings → Actions → General → Workflow permissions → marca **Allow GitHub Actions to create and approve pull requests** → Save.

### 7.3 Pruébalo una vez

Actions → **Rankings** → Run workflow.

**Comprueba:** Termina en verde. Si hay ediciones nuevas abre un PR «rankings/AAAA-MM»; si algo necesita a una persona, un issue «Rankings: acción requerida».

## Fase 8 · Credenciales expuestas en el historial (15 min)

### 8.1 Cambia la contraseña de la cuenta de administración (urgente)

Estuvo en `backend/backup.sql` y sigue en el historial de git. Primero mira cómo entra cada cuenta de administración (las líneas después de `psql` se escriben dentro de psql):

```
psql "$URL"
SELECT correo_usuario, clave_usuario IS NOT NULL AS tiene_clave,
       google_sub IS NOT NULL AS con_google
  FROM usuario WHERE plan_usuario = 'admin';
\q
```

Si `con_google` es verdadero, la contraseña antigua ya no sirve: esas cuentas solo entran con Google. Si la cuenta tiene clave, genera el hash de una nueva y escríbelo **dentro de psql**, no en la terminal: el hash lleva signos `$` que la terminal interpretaría.

```
python -c "import bcrypt,getpass;print(bcrypt.hashpw(getpass.getpass().encode(),bcrypt.gensalt()).decode())"
psql "$URL"
UPDATE usuario SET clave_usuario = 'HASH' WHERE correo_usuario = 'CORREO';
\q
```

**Comprueba:** Entras con la clave nueva y la antigua ya no funciona.

### 8.2 Cambia la clave local de PostgreSQL

En tu equipo: `psql -U postgres`, luego `\password postgres`, y actualiza `DATABASE_URL` en `backend/.env`.

### 8.3 Decide si limpiar el historial de git (opcional)

Con las claves cambiadas, lo que queda en el historial ya no da acceso. Limpiarlo (git filter-repo y push forzado) reescribe el repositorio para todo el equipo: solo de acuerdo con GerardOtto.

## Después de la salida

- [ ] **Avisa a quienes usan KAI**: tendrán que volver a iniciar sesión una vez.
- [ ] **Cada día 5**: revisa el PR «rankings/AAAA-MM» y el issue «Rankings: acción requerida». Al fusionar el PR, la base se actualiza sola; después, reinicia el backend en Railway (el asistente guarda en memoria el panorama de los datos).
- [ ] **QS** no se deja descargar automáticamente: cuando publique (Latam suele salir en octubre, Global en junio y por disciplina en marzo), baja la planilla oficial a `KAI/QS/DatosQS/QS LATAM/` o `QS global/`, con el año de la edición al comienzo del nombre.
- [ ] **Cada tres meses**: `pip-audit -r backend/requirements.txt` (se instala con `pip install pip-audit`) y `npm audit` en `frontend/kai-project`, para detectar dependencias con fallas conocidas.

## Si algo sale mal

| Síntoma | Qué hacer |
|---|---|
| El sitio no carga o falla después de publicar | Railway → el servicio → Deployments → el último despliegue que funcionaba → **Redeploy**. El código anterior ya convivía con estas migraciones, así que la base no hay que tocarla. |
| Nadie puede iniciar sesión | Revisa que `JWT_SECRET` exista en el backend. Con Google, revisa los orígenes y la publicación (fase 4). |
| El asistente dice que la consulta SQL no está disponible | Falta la migración 019, o la clave de `DATABASE_URL_ASISTENTE` no coincide con la del paso 2.4. El registro del backend dice cuál de las dos. |
| En la consola aparece «Refused to … Content Security Policy» | Algo intenta cargarse desde un origen no permitido. Agrégalo en `frontend/kai-project/serve.json` y vuelve a desplegar el frontend. |
| Último recurso: volver la base al respaldo | Borra todo lo posterior al respaldo del paso 1.1: `pg_restore --clean --if-exists --no-owner -d "$URL" ../kai_respaldo_2026-11-05.dump` |

## Qué cambió en esta versión

- La portada descarga 0,5 MB en vez de 2,1 MB: cada módulo, y las librerías de PDF y Excel, se cargan recién al usarlos, y la imagen de fondo pesa 82 % menos.
- Se cargan las fuentes del diseño (Noto Serif y Manrope), que nunca se cargaban: cada sistema mostraba su fuente por defecto.
- La API comprime sus respuestas (la más pesada pasa de 351 KB a 14 KB) y usa una sola conexión a la base, que se repone sola si Railway la corta.
- El backend instala 39 dependencias en vez de 52 (sin selenium ni pillow), y una variable de entorno vacía ya no impide que arranque.
- La integración continua y docker-compose aplican la 018, como lo hará producción, y se corrigió una prueba que fijaba el número de universidades del catálogo.
