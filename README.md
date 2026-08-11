# KAI

Plataforma de análisis de rankings universitarios (THE, QS Latam, Scimago, Shanghai GRAS). Permite explorar tendencias históricas, proyectar resultados futuros, simular cambios en las métricas de una institución y consultar un asistente de IA con acceso directo a los datos.

## Funcionalidades

- **Resumen** — ranking calculado por año a partir del puntaje ponderado de cada métrica.
- **Tendencias** — evolución histórica por universidad y métrica, con proyección por regresión lineal y métricas de precisión (R², crecimiento anual, disciplina para Shanghai GRAS).
- **Simulación** — edición interactiva de valores de métricas para ver cómo cambiaría el puntaje total de una institución.
- **Glosario** — catálogo de métricas agrupadas por categoría y ranking.
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

- Node.js 18+
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
| `ANTHROPIC_API_KEY` | Clave de la API de Claude, requerida para el Asistente. Se obtiene en [console.anthropic.com](https://console.anthropic.com/settings/keys) |

**`frontend/kai-project/.env`**

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL del backend, ej. `http://localhost:8000` |

## Base de datos

El dump con los datos (`backup.sql`) no se sube al repositorio. Se comparte por otro medio (USB, Drive, etc.); quien clone el proyecto debe colocarlo en `backend/backup.sql` antes de levantar el entorno.

## Docker

También se puede levantar todo el stack (base de datos + backend + frontend) con `docker-composer.yml`:

```bash
docker compose -f docker-composer.yml up
```
