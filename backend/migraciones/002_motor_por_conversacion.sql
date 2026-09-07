-- Migración: cada conversación queda ligada a un motor del asistente.
--
-- El motor no puede cambiar dentro de una conversación: los proveedores no
-- comparten el formato del historial, así que reenviar a uno lo que produjo el
-- otro da respuestas incoherentes o errores de formato. Guardarlo en la fila —y
-- no deducirlo de los mensajes— permite que una conversación recién creada, aún
-- sin mensajes, ya tenga motor definido.
--
-- Idempotente: puede ejecutarse varias veces sin efecto acumulado.
BEGIN;

ALTER TABLE conversacion
  ADD COLUMN IF NOT EXISTS motor TEXT NOT NULL DEFAULT 'claude';

-- Las conversaciones anteriores a esta migración son todas de Claude, que era el
-- único motor; el DEFAULT ya las deja correctas. Este UPDATE solo cubre el caso
-- de una columna preexistente con nulos.
UPDATE conversacion SET motor = 'claude' WHERE motor IS NULL;

ALTER TABLE conversacion DROP CONSTRAINT IF EXISTS conversacion_motor_chk;
ALTER TABLE conversacion ADD CONSTRAINT conversacion_motor_chk
  CHECK (motor IN ('claude', 'gemini'));

COMMIT;
