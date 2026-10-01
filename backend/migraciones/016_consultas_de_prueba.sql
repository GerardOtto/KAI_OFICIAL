-- Migración: el plan gratuito pasa de «una consulta cada tres días» a tres
-- consultas al asistente por cuenta, para siempre.
--
-- La espera entre consultas (migración 006) servía para acotar el gasto, pero no
-- para vender: quien prueba el asistente una vez y tiene que esperar tres días
-- para la segunda pregunta no llega a formarse una opinión. Tres consultas
-- seguidas sí dan para ver qué hace, y el tope no se repone: para seguir, hay
-- que contratar un plan, cuyas cuotas pasan a regir en cuanto se asigna.
--
-- Dos piezas:
--
--   1. `plan.mensajes_totales`: consultas al asistente que una cuenta puede
--      hacer en toda su vida mientras esté en ese plan. NULL = sin tope, como
--      el resto de los límites de la tabla. Solo lo usa el gratuito.
--
--   2. `usuario.consultas_asistente`: cuántas ha hecho la cuenta. Es un
--      contador propio y no un recuento de `mensaje` porque borrar una
--      conversación borra sus mensajes: contándolos, bastaría con borrar el
--      historial para recuperar las tres consultas. El backend lo sube al
--      registrar la pregunta y lo baja si el turno falla, así que un fallo del
--      proveedor no gasta una consulta (ver `app/conversaciones.py`).
--
-- El contador de las cuentas existentes arranca con las preguntas que ya tienen
-- en su historial. Es lo más fiel que se puede reconstruir: lo ya borrado no
-- se recupera, y quien más haya preguntado, más cerca queda del tope.
--
-- Idempotente: puede ejecutarse varias veces sin efecto acumulado. El recuento
-- inicial solo se hace al crear la columna, para no pisar contadores vivos.
BEGIN;

-- 1. Tope de por vida en el plan ---------------------------------------------

ALTER TABLE plan ADD COLUMN IF NOT EXISTS mensajes_totales INTEGER;

ALTER TABLE plan DROP CONSTRAINT IF EXISTS plan_mensajes_totales_chk;
ALTER TABLE plan ADD CONSTRAINT plan_mensajes_totales_chk
    CHECK (mensajes_totales IS NULL OR mensajes_totales >= 0);

COMMENT ON COLUMN plan.mensajes_totales IS
    'Consultas al asistente por cuenta, en toda su vida, mientras esté en este plan. NULL = sin tope.';

-- El gratuito cambia la espera y el tope diario por las tres consultas.
UPDATE plan SET mensajes_totales = 3, dias_entre_mensajes = NULL, mensajes_por_dia = NULL
 WHERE codigo_plan = 'free';

-- 2. Contador por cuenta -------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'usuario'
                      AND column_name = 'consultas_asistente') THEN
        ALTER TABLE usuario ADD COLUMN consultas_asistente INTEGER NOT NULL DEFAULT 0
            CONSTRAINT usuario_consultas_asistente_chk CHECK (consultas_asistente >= 0);

        UPDATE usuario u SET consultas_asistente = h.n
          FROM (SELECT c.id_usuario, count(*) AS n
                  FROM mensaje m JOIN conversacion c ON c.id_conversacion = m.id_conversacion
                 WHERE m.rol = 'user'
                 GROUP BY c.id_usuario) h
         WHERE h.id_usuario = u.id_usuario;
    END IF;
END $$;

COMMENT ON COLUMN usuario.consultas_asistente IS
    'Consultas al asistente hechas por la cuenta desde su creación. No baja al borrar conversaciones.';

COMMIT;

-- Verificación ---------------------------------------------------------------
DO $$
DECLARE
    tope   INTEGER;
    espera INTEGER;
    diario INTEGER;
    desfase INTEGER;
BEGIN
    SELECT mensajes_totales, dias_entre_mensajes, mensajes_por_dia INTO tope, espera, diario
      FROM plan WHERE codigo_plan = 'free';
    IF tope IS DISTINCT FROM 3 OR espera IS NOT NULL OR diario IS NOT NULL THEN
        RAISE EXCEPTION 'El plan gratuito quedó con tope %, espera % y diario %; se esperaba 3, NULL y NULL.',
            tope, espera, diario;
    END IF;

    IF EXISTS (SELECT 1 FROM plan WHERE codigo_plan <> 'free' AND mensajes_totales IS NOT NULL) THEN
        RAISE EXCEPTION 'Algún otro plan quedó con tope de por vida.';
    END IF;

    -- El contador nunca puede quedar por debajo de lo que hay en el historial.
    SELECT count(*) INTO desfase
      FROM usuario u
      JOIN (SELECT c.id_usuario, count(*) AS n
              FROM mensaje m JOIN conversacion c ON c.id_conversacion = m.id_conversacion
             WHERE m.rol = 'user' GROUP BY c.id_usuario) h ON h.id_usuario = u.id_usuario
     WHERE u.consultas_asistente < h.n;
    IF desfase > 0 THEN
        RAISE EXCEPTION '% cuentas tienen menos consultas contadas que preguntas en su historial.', desfase;
    END IF;

    RAISE NOTICE 'Migración 016 aplicada: plan gratuito con % consultas de por vida y contador por cuenta.', tope;
END $$;
