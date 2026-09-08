-- Migración: los planes pasan a definirse por consumo de tokens, con cuota
-- separada para cada motor y precio mensual.
--
-- Por qué separada y no un único saldo: un token de Claude cuesta unas veinte
-- veces más que uno de Gemini. Con una bolsa común, dos usuarios que gastan la
-- misma cifra le cuestan a la plataforma cantidades muy distintas, y el precio
-- deja de tener relación con el costo. Con una cuota por motor, el costo máximo
-- de cada plan es una cifra cerrada y conocida de antemano.
--
-- Convenio de valores, usado en todo el código:
--   NULL = sin límite
--   0    = ese motor no está incluido en el plan
--   > 0  = tope mensual de tokens (entrada + salida)
--
-- Idempotente: puede ejecutarse varias veces sin efecto acumulado.
BEGIN;

ALTER TABLE plan ADD COLUMN IF NOT EXISTS descripcion        TEXT;
ALTER TABLE plan ADD COLUMN IF NOT EXISTS precio_mensual_usd NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE plan ADD COLUMN IF NOT EXISTS tokens_claude_mes  BIGINT;
ALTER TABLE plan ADD COLUMN IF NOT EXISTS tokens_gemini_mes  BIGINT;
-- `publico` distingue los planes que se ofrecen en la portada de los internos
-- (administración, cortesías), que existen pero no se venden.
ALTER TABLE plan ADD COLUMN IF NOT EXISTS publico            BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE plan ADD COLUMN IF NOT EXISTS orden              INTEGER NOT NULL DEFAULT 0;

-- `tokens_mensuales` queda sin uso: la cuota es ahora por motor. Se elimina
-- antes de insertar —y no al final— porque era NOT NULL sin valor por defecto:
-- dejarla obligaría a nombrarla en el INSERT, y entonces la segunda ejecución de
-- esta migración fallaría al referirse a una columna ya eliminada.
ALTER TABLE plan DROP COLUMN IF EXISTS tokens_mensuales;

-- Catálogo. Los topes salen de un costo objetivo equivalente a una cuarta parte
-- del precio; el detalle del cálculo está en docs/planes.md.
INSERT INTO plan (codigo_plan, nombre_plan) VALUES
    ('investigador', 'Investigador'),
    ('departamento', 'Departamento')
ON CONFLICT (codigo_plan) DO NOTHING;

UPDATE plan SET
    nombre_plan        = 'Gratuito',
    descripcion        = 'Para probar la herramienta. Solo el motor rápido.',
    precio_mensual_usd = 0,
    tokens_claude_mes  = 0,
    tokens_gemini_mes  = 300000,
    mensajes_por_dia   = 15,
    publico = TRUE, orden = 1
WHERE codigo_plan = 'free';

UPDATE plan SET
    nombre_plan        = 'Investigador',
    descripcion        = 'Para una persona que consulta a diario y necesita análisis profundo.',
    precio_mensual_usd = 12,
    tokens_claude_mes  = 300000,
    tokens_gemini_mes  = 2000000,
    mensajes_por_dia   = 80,
    publico = TRUE, orden = 2
WHERE codigo_plan = 'investigador';

UPDATE plan SET
    nombre_plan        = 'Departamento',
    descripcion        = 'Para un equipo o unidad académica que comparte el seguimiento.',
    precio_mensual_usd = 45,
    tokens_claude_mes  = 1200000,
    tokens_gemini_mes  = 6000000,
    mensajes_por_dia   = 300,
    publico = TRUE, orden = 3
WHERE codigo_plan = 'departamento';

UPDATE plan SET
    nombre_plan        = 'Institucional',
    descripcion        = 'Para la oficina de análisis institucional, sin tope de consultas diarias.',
    precio_mensual_usd = 180,
    tokens_claude_mes  = 5000000,
    tokens_gemini_mes  = 25000000,
    mensajes_por_dia   = NULL,
    publico = TRUE, orden = 4
WHERE codigo_plan = 'institucional';

-- Planes internos: no se ofrecen en la portada.
UPDATE plan SET
    nombre_plan        = 'Sin límite',
    descripcion        = 'Cortesía interna. Sin topes.',
    precio_mensual_usd = 0,
    tokens_claude_mes  = NULL,
    tokens_gemini_mes  = NULL,
    mensajes_por_dia   = NULL,
    publico = FALSE, orden = 98
WHERE codigo_plan = 'ilimitado';

UPDATE plan SET
    nombre_plan        = 'Administrador',
    descripcion        = 'Acceso completo a todos los motores y sin topes.',
    precio_mensual_usd = 0,
    tokens_claude_mes  = NULL,
    tokens_gemini_mes  = NULL,
    mensajes_por_dia   = NULL,
    publico = FALSE, orden = 99
WHERE codigo_plan = 'admin';

-- Red de seguridad: un plan que se haya añadido a mano y quedara sin definir
-- no debe conceder acceso ilimitado por omisión. NULL significa «sin límite»,
-- así que un valor sin definir se interpreta como el plan gratuito.
UPDATE plan SET tokens_claude_mes = 0      WHERE tokens_claude_mes IS NULL AND codigo_plan NOT IN ('admin', 'ilimitado');
UPDATE plan SET tokens_gemini_mes = 300000 WHERE tokens_gemini_mes IS NULL AND codigo_plan NOT IN ('admin', 'ilimitado');

COMMIT;
