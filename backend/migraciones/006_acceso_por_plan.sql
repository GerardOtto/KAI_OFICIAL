-- Migración: el plan gratuito pasa a ser una demostración acotada.
--
-- Hasta aquí el plan gratuito se distinguía solo por sus cuotas de tokens y su
-- tope diario de consultas. Ahora limita además tres cosas que no se median en
-- tokens, y que por tanto no cabían en el modelo anterior:
--
--   1. La frecuencia de consulta al asistente, que pasa de «quince al día» a
--      «una cada tres días». Se añade `dias_entre_mensajes` al plan en vez de
--      bajar `mensajes_por_dia` a uno, porque son dos límites distintos: uno
--      acota el volumen de un día y el otro, la frecuencia entre consultas.
--      Convenio, como en el resto de la tabla: NULL significa sin restricción.
--
--   2. Las descargas de informes, que no consumen cuota del proveedor pero sí
--      entregan el producto. La tabla `descarga` lleva la cuenta por módulo y
--      formato; el plan gratuito dispone de una de cada, una sola vez.
--
--   3. El acceso a los datos de THE y QS, que no se registra aquí: se deriva del
--      código del plan en `app/acceso.py`, porque depende de qué rankings haya
--      cargados y no de una columna que habría que mantener a mano.
--
-- La institución del usuario pasa a ser obligatoria en el registro. No se
-- declara NOT NULL: hay cuentas anteriores sin ella —y todas las creadas con
-- Google—, que deben poder entrar para elegirla. La obligación se aplica en el
-- registro y se reclama al entrar, no con una restricción que dejaría fuera a
-- quien ya está dentro.
--
-- Idempotente: puede ejecutarse varias veces sin efecto acumulado.
BEGIN;

-- 1. Frecuencia mínima entre consultas al asistente ------------------------

ALTER TABLE plan ADD COLUMN IF NOT EXISTS dias_entre_mensajes INTEGER;

COMMENT ON COLUMN plan.dias_entre_mensajes IS
    'Días que deben pasar entre dos consultas al asistente. NULL = sin espera.';

UPDATE plan SET dias_entre_mensajes = 3, mensajes_por_dia = 1
 WHERE codigo_plan = 'free';

UPDATE plan SET dias_entre_mensajes = NULL
 WHERE codigo_plan <> 'free' AND dias_entre_mensajes IS NOT NULL;

-- 2. Descargas de informes --------------------------------------------------

CREATE TABLE IF NOT EXISTS descarga (
    id_descarga     SERIAL PRIMARY KEY,
    id_usuario      INTEGER NOT NULL REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    modulo          TEXT NOT NULL,
    formato         TEXT NOT NULL,
    fecha_creacion  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT descarga_formato_chk CHECK (formato IN ('pdf', 'xlsx'))
);

-- La consulta habitual es «qué ha descargado este usuario», tanto para decidir
-- si puede volver a hacerlo como para mostrárselo en la interfaz.
CREATE INDEX IF NOT EXISTS descarga_usuario_idx
    ON descarga (id_usuario, modulo, formato);

COMMIT;

-- Verificación ---------------------------------------------------------------
DO $$
DECLARE
    espera INTEGER;
    tope   INTEGER;
BEGIN
    SELECT dias_entre_mensajes, mensajes_por_dia INTO espera, tope
      FROM plan WHERE codigo_plan = 'free';

    IF espera IS DISTINCT FROM 3 OR tope IS DISTINCT FROM 1 THEN
        RAISE EXCEPTION 'El plan gratuito quedó con espera % y tope %, se esperaba 3 y 1.',
            espera, tope;
    END IF;

    IF EXISTS (SELECT 1 FROM plan WHERE codigo_plan <> 'free' AND dias_entre_mensajes IS NOT NULL) THEN
        RAISE EXCEPTION 'Algún plan de pago quedó con espera entre mensajes.';
    END IF;

    IF to_regclass('public.descarga') IS NULL THEN
        RAISE EXCEPTION 'No se creó la tabla de descargas.';
    END IF;

    RAISE NOTICE 'Migración 006 aplicada: plan gratuito con espera de % días y tabla de descargas.', espera;
END $$;
