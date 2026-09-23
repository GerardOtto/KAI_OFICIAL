-- Modelo entidad-relación de KAI (PostgreSQL).
--
-- Extraído del esquema real con `pg_dump --schema-only` (21-09-2026) y
-- simplificado para importarlo en herramientas de diagramas: claves primarias
-- y foráneas en línea, sin secuencias, índices ni triggers.
--
-- Simplificaciones respecto de la base real:
--   - SERIAL reemplaza a INTEGER + secuencia.
--   - usuario.google_sub es UNIQUE; en la base es un índice único parcial
--     (WHERE google_sub IS NOT NULL), que en la práctica equivale.
--   - Se omite el trigger de notificacion (pg_notify al insertar).

-- ---------------------------------------------------------------------------
-- Rankings y métricas institucionales
-- ---------------------------------------------------------------------------

CREATE TABLE universidad (
    id_universidad      SERIAL PRIMARY KEY,
    nombre_universidad  TEXT NOT NULL,
    pais_universidad    TEXT
);

CREATE TABLE ranking (
    id_ranking           SERIAL PRIMARY KEY,
    nombre_ranking       TEXT NOT NULL,
    descripcion_ranking  TEXT,
    nivel_ranking        TEXT,
    categoria_ranking    TEXT,
    pais_ranking         TEXT,
    metodologia_ranking  TEXT
);

CREATE TABLE metrica (
    id_metrica           SERIAL PRIMARY KEY,
    id_ranking           INTEGER NOT NULL REFERENCES ranking (id_ranking) ON DELETE CASCADE,
    nombre_metrica       TEXT NOT NULL,
    descripcion_metrica  TEXT,
    tipo_metrica         TEXT,
    peso_metrica         NUMERIC,
    disciplina           TEXT,
    -- Jerarquía dentro del propio ranking: un pilar y los indicadores que agrupa.
    -- `pondera` marca cuál de los dos niveles compone el 100 %; el otro se
    -- conserva como referencia metodológica y no suma.
    id_metrica_padre     INTEGER REFERENCES metrica (id_metrica) ON DELETE SET NULL,
    pondera              BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE metrica_universidad (
    id_metrica      INTEGER NOT NULL REFERENCES metrica (id_metrica) ON DELETE CASCADE,
    id_universidad  INTEGER NOT NULL REFERENCES universidad (id_universidad) ON DELETE CASCADE,
    anio_metrica    INTEGER NOT NULL,
    valor_metrica   NUMERIC,
    PRIMARY KEY (id_metrica, id_universidad, anio_metrica)
);

-- ---------------------------------------------------------------------------
-- Investigadores
-- ---------------------------------------------------------------------------

CREATE TABLE cientifico (
    id_cientifico             SERIAL PRIMARY KEY,
    nombre_cientifico         TEXT NOT NULL,
    id_universidad            INTEGER REFERENCES universidad (id_universidad) ON DELETE SET NULL,
    institucion_original      TEXT,
    campo_principal           TEXT,
    subcampo_principal        TEXT,
    anio_primera_publicacion  INTEGER,
    anio_ultima_publicacion   INTEGER,
    pais_cientifico           TEXT,
    orcid                     TEXT
);

CREATE TABLE cientifico_metrica (
    id_cientifico      INTEGER NOT NULL REFERENCES cientifico (id_cientifico) ON DELETE CASCADE,
    anio_datos         INTEGER NOT NULL,
    fuente             TEXT NOT NULL DEFAULT 'Stanford/Elsevier - World''s Top 2% Scientists',
    rank_global        INTEGER,
    rank_global_ns     INTEGER,
    h_index            INTEGER,
    hm_index           NUMERIC,
    citas_totales      INTEGER,
    num_articulos      INTEGER,
    composite_score    NUMERIC,
    self_citation_pct  NUMERIC,
    PRIMARY KEY (id_cientifico, anio_datos, fuente)
);

CREATE TABLE cientifico_topico (
    id_cientifico     INTEGER NOT NULL REFERENCES cientifico (id_cientifico) ON DELETE CASCADE,
    topico            TEXT NOT NULL,
    fuente            TEXT NOT NULL,
    anio_datos        INTEGER NOT NULL,
    autor_documentos  INTEGER,
    topico_fwci       NUMERIC,
    PRIMARY KEY (id_cientifico, topico, fuente, anio_datos)
);

-- ---------------------------------------------------------------------------
-- Usuarios, planes y asistente
-- ---------------------------------------------------------------------------

CREATE TABLE plan (
    codigo_plan         TEXT PRIMARY KEY,
    nombre_plan         TEXT NOT NULL,
    descripcion         TEXT,
    precio_mensual_usd  NUMERIC(10,2) NOT NULL DEFAULT 0,
    tokens_claude_mes   BIGINT,
    tokens_gemini_mes   BIGINT,
    mensajes_por_dia    INTEGER,
    publico             BOOLEAN NOT NULL DEFAULT TRUE,
    orden               INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE usuario (
    id_usuario             SERIAL PRIMARY KEY,
    nombre_usuario         TEXT NOT NULL,
    correo_usuario         TEXT NOT NULL UNIQUE,
    clave_usuario          TEXT,
    google_sub             TEXT UNIQUE,
    avatar_url             TEXT,
    correo_verificado      BOOLEAN NOT NULL DEFAULT FALSE,
    institucion_usuario    TEXT,
    plan_usuario           TEXT DEFAULT 'free' REFERENCES plan (codigo_plan),
    notificaciones_switch  BOOLEAN DEFAULT TRUE,
    fecha_creacion         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_facturacion      TIMESTAMP,
    ultimo_acceso          TIMESTAMP,
    CONSTRAINT usuario_metodo_acceso_chk CHECK (clave_usuario IS NOT NULL OR google_sub IS NOT NULL)
);

CREATE TABLE conversacion (
    id_conversacion      SERIAL PRIMARY KEY,
    id_usuario           INTEGER NOT NULL REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    titulo               TEXT NOT NULL DEFAULT 'Nueva conversación',
    motor                TEXT NOT NULL DEFAULT 'claude' CHECK (motor IN ('claude', 'gemini')),
    archivada            BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mensaje (
    id_mensaje       SERIAL PRIMARY KEY,
    id_conversacion  INTEGER NOT NULL REFERENCES conversacion (id_conversacion) ON DELETE CASCADE,
    rol              TEXT NOT NULL CHECK (rol IN ('user', 'assistant')),
    contenido        TEXT NOT NULL,
    tokens_entrada   INTEGER NOT NULL DEFAULT 0,
    tokens_salida    INTEGER NOT NULL DEFAULT 0,
    modelo           TEXT,
    fecha_creacion   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notificacion (
    id_notificacion  SERIAL PRIMARY KEY,
    id_usuario       INTEGER NOT NULL REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    mensaje          TEXT NOT NULL,
    leido_bool       BOOLEAN DEFAULT FALSE,
    fecha_creacion   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
