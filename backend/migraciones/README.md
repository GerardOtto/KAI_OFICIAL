# Migraciones de base de datos

Las migraciones se aplican **a mano y en orden**, primero en local y después en
producción (Railway). No hay herramienta de migraciones automática: el proyecto
usa SQLAlchemy Core, no el ORM, así que no hay Alembic.

| Archivo | Qué hace | Local | Railway |
|---|---|---|---|
| `001_usuarios_y_conversaciones.sql` | Autenticación, cuentas de Google, planes, conversaciones y consumo de tokens | aplicada | aplicada (07-09-2026) |

Tras aplicar la 001 se verificó que el esquema de ambas bases es idéntico
(mismas tablas y mismas columnas en `usuario`), y se convirtieron a bcrypt las
contraseñas que quedaban en texto plano en producción.

Todas son idempotentes (`IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`), así que
volver a ejecutarlas no duplica nada.

---

## Aplicar en local

```bash
psql -U postgres -d KAI-PROJECT -v ON_ERROR_STOP=1 -f backend/migraciones/001_usuarios_y_conversaciones.sql
```

`ON_ERROR_STOP=1` es importante: sin él, `psql` continúa tras un error y la
transacción termina revertida sin que se note.

## Aplicar en Railway

1. En el panel de Railway, abre el servicio de **PostgreSQL** → pestaña
   **Variables** → copia `DATABASE_PUBLIC_URL` (la pública, no la interna:
   `postgres.railway.internal` solo resuelve dentro de la red de Railway).

2. Ejecuta la migración contra esa URL:

   ```bash
   psql "postgresql://postgres:CLAVE@HOST.proxy.rlwy.net:PUERTO/railway" \
        -v ON_ERROR_STOP=1 \
        -f backend/migraciones/001_usuarios_y_conversaciones.sql
   ```

   En Windows, si `psql` no está en el PATH:
   `"C:\Program Files\PostgreSQL\18\bin\psql.exe"`

3. Verifica que las tablas quedaron creadas:

   ```bash
   psql "postgresql://..." -c "\dt" -c "SELECT codigo_plan, tokens_mensuales FROM plan;"
   ```

   Deben aparecer `plan`, `conversacion` y `mensaje`, y cuatro planes.

4. **Respalda antes si la base tiene datos que no quieras perder:**

   ```bash
   pg_dump "postgresql://..." -f respaldo_antes_de_001.sql
   ```

---

## Contraseñas en texto plano

Si la base de producción tiene usuarios creados antes de esta migración, sus
contraseñas están guardadas **sin hashear**. El guion `hashear_claves.py` las
convierte a bcrypt sin mostrarlas por pantalla:

```bash
cd backend
venv/Scripts/python.exe migraciones/hashear_claves.py
```

Lee `DATABASE_URL` del entorno, así que para producción hay que apuntarlo a la
URL pública de Railway antes de ejecutarlo:

```bash
# PowerShell
$env:DATABASE_URL = "postgresql://..."
venv\Scripts\python.exe migraciones\hashear_claves.py
```

Reconoce los hashes bcrypt por su prefijo, de modo que ejecutarlo dos veces no
vuelve a hashear lo ya convertido.

---

## Variables de entorno del backend en Railway

Además de la migración, el servicio de backend necesita estas variables
(pestaña **Variables** del servicio, no un archivo `.env`):

| Variable | Obligatoria | Notas |
|---|---|---|
| `DATABASE_URL` | sí | La interna (`postgres.railway.internal`) funciona bien aquí |
| `ANTHROPIC_API_KEY` | sí, para el asistente | |
| `JWT_SECRET` | **sí** | Sin ella, todo `/auth/*` responde 503. Genera una distinta de la local |
| `JWT_HORAS_VALIDEZ` | no | Por defecto 12 |
| `GOOGLE_CLIENT_ID` | no | Sin ella el botón de Google no aparece |

Para generar un secreto:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```
