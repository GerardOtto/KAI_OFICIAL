# KAI

Plataforma de análisis de rankings universitarios (THE, QS Latam, Scimago, Shanghai GRAS). Permite explorar tendencias históricas, proyectar resultados futuros, simular cambios en las métricas de una institución y consultar un asistente de IA con acceso directo a los datos.

## Funcionalidades

- **Resumen** — ranking calculado por año a partir del puntaje ponderado de cada métrica.
- **Tendencias** — evolución histórica por universidad y métrica, con proyección por regresión lineal, su intervalo de predicción del 80 % y métricas de precisión (R², crecimiento anual, disciplina para Shanghai GRAS). Explica, métrica por métrica, por qué cambió el total de una institución entre dos ediciones.
- **Simulación** — edición interactiva de valores de métricas para ver cómo cambiaría el puntaje total de una institución, y simulación inversa (pestaña Objetivo): qué mover, y cuánto, para superar a otra institución o llegar a un puesto, en puntajes o en las cifras reales del Ranking KAI y Scimago.
- **Glosario** — catálogo de métricas agrupadas por categoría y ranking, con el puntaje total y el lugar de la institución entre las chilenas en cada ranking y edición.
- **Grupos de comparación** — conjuntos de instituciones guardados en la cuenta, para elegirlos de una vez en Tendencias y en la simulación comparada.
- **Asistente** — chat con IA (Claude, vía tool use) que consulta la base de datos real para responder preguntas sobre rankings, tendencias y universidades.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite, React Router, Tailwind, Recharts, Framer Motion |
| Backend | FastAPI + SQLAlchemy |
| Base de datos | PostgreSQL |
| IA | Anthropic Claude (Python SDK, tool use) |

## Estructura del proyecto

```
KAI_OFICIAL/
├── backend/
│   ├── app/
│   │   ├── main.py        # API FastAPI (endpoints)
│   │   ├── assistant.py   # Asistente IA (tools + Claude)
│   │   └── db.py          # Conexión a PostgreSQL
│   └── requirements.txt
└── frontend/kai-project/
    └── src/
        ├── pages/          # Vistas (Resumen, Tendencias, Simulación, Glosario, Asistente)
        ├── components/     # Componentes por vista
        └── hooks/          # Hooks de acceso a la API
```

## Requisitos previos

- Node.js 20.19+ (lo exige Vite 8)
- Python 3.12+
- PostgreSQL 15+

## Instalación

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # macOS/Linux

pip install -r requirements.txt
cp ../.env.example .env     # y completar las credenciales (ver tabla abajo)

uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend/kai-project
npm install
npm run dev
```

## Variables de entorno

**`backend/.env`**

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL, ej. `postgresql://usuario:password@localhost:5432/KAI-PROJECT` |
| `JWT_SECRET` | **Obligatoria.** Secreto para firmar las sesiones; sin ella todo `/auth/*` responde 503. Genérala con `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `ANTHROPIC_API_KEY` | Clave de la API de Claude, para el motor Claude del Asistente. Se obtiene en [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| `GEMINI_API_KEY` | Clave de la API de Gemini, para el motor Gemini del Asistente. Sin ella ese motor se muestra deshabilitado. Se obtiene en [aistudio.google.com](https://aistudio.google.com/apikey) |
| `GOOGLE_CLIENT_ID` | Opcional. Sin ella, el acceso con Google no se ofrece |

La lista completa de variables del backend —incluidas las del correo de «Contratar ahora»— está en [`backend/migraciones/README.md`](backend/migraciones/README.md).

**`frontend/kai-project/.env`**

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL del backend, ej. `http://localhost:8000`. Vite la incrusta al compilar: en producción (Railway) debe existir como variable del servicio del frontend **al construir la imagen**, y cambiarla exige volver a desplegar |

## Base de datos

El esquema y los datos académicos se cargan desde [`backend/pruebas/datos_de_prueba.sql`](backend/pruebas/datos_de_prueba.sql), que sí está versionado y trae todas las migraciones aplicadas pero **ninguna** fila de cuentas, conversaciones ni mensajes:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/pruebas/datos_de_prueba.sql
```

El volcado trae aplicadas las [migraciones](backend/migraciones/README.md) de datos y esquema hasta la 017. Después de cargarlo, aplica dos más:

- la del rol del asistente: los roles son del servidor y no viajan en el volcado, y sin ella la consulta SQL libre del asistente se niega;
- las del puntaje total de cada ranking, que Tendencias, Simulación y el Glosario muestran (la 020 y la 021, que corrige el de GRAS anterior a 2024); después, el cargador de rankings agrega las ediciones que faltan.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migraciones/019_rol_del_asistente.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migraciones/020_puntaje_total.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migraciones/021_gras_por_edicion.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migraciones/022_grupos_de_comparacion.sql
python tools/rankings/cargar.py --escribir   # ediciones que faltan y totales de GRAS 2017-2023
``` (El antiguo `backend/backup.sql` quedó versionado con un esquema anterior y no debe usarse para levantar el entorno.)

## Rankings oficiales

Las ediciones de THE Latam, QS Latam, QS Global, ARWU y GRAS llegan a la base por un solo camino: `tools/rankings/actualizar.py` las toma de la fuente oficial y escribe una instantánea versionada en `datos/rankings/`, y `tools/rankings/cargar.py` la verifica y la carga. Un flujo de GitHub Actions (`.github/workflows/rankings.yml`) revisa las fuentes el día 5 de cada mes y abre un PR con las ediciones nuevas. QS no se deja descargar de forma automática: su planilla oficial se deja a mano en `KAI/QS/DatosQS/`. Detalles en [`tools/rankings/README.md`](tools/rankings/README.md).

```bash
python tools/rankings/cargar.py              # compara las instantáneas con la base
python tools/rankings/cargar.py --escribir   # carga las ediciones que faltan
```

## Docker

También se puede levantar todo el stack (base de datos + backend + frontend) con `docker-composer.yml`. Antes, copia `.env.example` como `.env` en la raíz y completa al menos `POSTGRES_PASSWORD` y `JWT_SECRET`; sin ellas el arranque se detiene con un aviso.

```bash
cp .env.example .env    # y completar POSTGRES_PASSWORD y JWT_SECRET
docker compose -f docker-composer.yml up
```

El frontend del contenedor es la compilación de producción servida como archivos estáticos, no el servidor de desarrollo; `VITE_API_URL` se fija al construir la imagen. La base se crea con `backend/pruebas/datos_de_prueba.sql` la primera vez, con el volumen vacío. Usa PostgreSQL 18, igual que integración continua. Si levantaste antes la versión anterior, con PostgreSQL 15, borra su volumen para que se cree de nuevo: `docker compose -f docker-composer.yml down -v`.
