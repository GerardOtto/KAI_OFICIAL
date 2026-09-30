-- Migración: solicitudes de contratación enviadas desde la portada.
--
-- El botón «Contratar ahora» abre un formulario de contacto: todavía no hay
-- cobro en línea, y las universidades compran con contrato y orden de compra.
-- Cada solicitud se guarda aquí y además se envía por correo al equipo
-- (`app/contacto.py`). Guardarla primero es lo que garantiza que ninguna se
-- pierda si el envío falla o si el servidor de correo aún no está configurado:
-- `enviado` y `error_envio` dicen qué pasó con cada una.
--
-- Son datos personales de terceros: el asistente no puede leer esta tabla
-- (TABLAS_VETADAS en app/herramientas.py) y el volcado de pruebas no incluye
-- sus filas.
--
-- Idempotente: puede ejecutarse varias veces sin efecto acumulado.
BEGIN;

CREATE TABLE IF NOT EXISTS solicitud_contacto (
    id_solicitud  SERIAL PRIMARY KEY,
    fecha         TIMESTAMPTZ NOT NULL DEFAULT now(),
    nombre        TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 120),
    correo        TEXT NOT NULL CHECK (length(correo) BETWEEN 3 AND 200),
    institucion   TEXT NOT NULL CHECK (length(institucion) BETWEEN 1 AND 200),
    cargo         TEXT CHECK (length(cargo) <= 120),
    telefono      TEXT CHECK (length(telefono) <= 40),
    codigo_plan   TEXT REFERENCES plan(codigo_plan) ON UPDATE CASCADE ON DELETE SET NULL,
    mensaje       TEXT CHECK (length(mensaje) <= 2000),
    enviado       BOOLEAN NOT NULL DEFAULT FALSE,
    error_envio   TEXT
);

CREATE INDEX IF NOT EXISTS solicitud_contacto_pendientes
    ON solicitud_contacto (fecha) WHERE NOT enviado;

COMMIT;

DO $$
BEGIN
    IF to_regclass('public.solicitud_contacto') IS NULL THEN
        RAISE EXCEPTION 'No se creó solicitud_contacto';
    END IF;
END $$;
