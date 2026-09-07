-- Migración: autenticación con JWT, cuentas de Google, conversaciones y consumo de tokens.
-- Idempotente: puede ejecutarse varias veces sin efecto acumulado.
BEGIN;

-- 1) usuario: soporte para cuentas de Google y control de plan
--    clave_usuario pasa a ser nulable porque las cuentas de Google no tienen contraseña local.
ALTER TABLE usuario ALTER COLUMN clave_usuario DROP NOT NULL;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS google_sub      TEXT;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS avatar_url      TEXT;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS correo_verificado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS ultimo_acceso   TIMESTAMP;

ALTER TABLE usuario ALTER COLUMN plan_usuario SET DEFAULT 'free';
UPDATE usuario SET plan_usuario = 'free' WHERE plan_usuario IS NULL;

-- El identificador de Google ("sub") es único y estable por cuenta.
CREATE UNIQUE INDEX IF NOT EXISTS usuario_google_sub_key ON usuario (google_sub) WHERE google_sub IS NOT NULL;

-- Una cuenta debe poder autenticarse de alguna forma: contraseña local o Google.
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_metodo_acceso_chk;
ALTER TABLE usuario ADD CONSTRAINT usuario_metodo_acceso_chk
  CHECK (clave_usuario IS NOT NULL OR google_sub IS NOT NULL);

-- Búsqueda por correo en minúsculas (el login normaliza el correo).
CREATE INDEX IF NOT EXISTS idx_usuario_correo_lower ON usuario (lower(correo_usuario));


-- 2) Planes: cuota mensual de tokens por plan.
CREATE TABLE IF NOT EXISTS plan (
    codigo_plan        TEXT PRIMARY KEY,
    nombre_plan        TEXT NOT NULL,
    tokens_mensuales   BIGINT NOT NULL,
    mensajes_por_dia   INTEGER
);

INSERT INTO plan (codigo_plan, nombre_plan, tokens_mensuales, mensajes_por_dia) VALUES
    ('free',         'Gratuito',     200000,   30),
    ('institucional','Institucional', 5000000, NULL),
    ('ilimitado',    'Sin límite',   9223372036854775807, NULL),
    ('admin',        'Administrador', 9223372036854775807, NULL)
ON CONFLICT (codigo_plan) DO NOTHING;

-- Normaliza planes preexistentes escritos con otra capitalización.
UPDATE usuario SET plan_usuario = lower(plan_usuario)
 WHERE plan_usuario IS NOT NULL AND plan_usuario <> lower(plan_usuario);

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_plan_fkey;
ALTER TABLE usuario ADD CONSTRAINT usuario_plan_fkey
  FOREIGN KEY (plan_usuario) REFERENCES plan (codigo_plan);


-- 3) Conversaciones del asistente
CREATE TABLE IF NOT EXISTS conversacion (
    id_conversacion    SERIAL PRIMARY KEY,
    id_usuario         INTEGER NOT NULL REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    titulo             TEXT NOT NULL DEFAULT 'Nueva conversación',
    fecha_creacion     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archivada          BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_conversacion_usuario
  ON conversacion (id_usuario, fecha_actualizacion DESC);


-- 4) Mensajes. Los tokens se registran por mensaje, no como contador agregado:
--    así el consumo es auditable y se puede recalcular por período.
CREATE TABLE IF NOT EXISTS mensaje (
    id_mensaje       SERIAL PRIMARY KEY,
    id_conversacion  INTEGER NOT NULL REFERENCES conversacion (id_conversacion) ON DELETE CASCADE,
    rol              TEXT NOT NULL CHECK (rol IN ('user', 'assistant')),
    contenido        TEXT NOT NULL,
    tokens_entrada   INTEGER NOT NULL DEFAULT 0,
    tokens_salida    INTEGER NOT NULL DEFAULT 0,
    modelo           TEXT,
    fecha_creacion   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mensaje_conversacion
  ON mensaje (id_conversacion, id_mensaje);

-- Índice para agregar consumo por usuario y período sin recorrer toda la tabla.
CREATE INDEX IF NOT EXISTS idx_mensaje_fecha ON mensaje (fecha_creacion);

COMMIT;
