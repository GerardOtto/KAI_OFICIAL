-- Migración: recalibración de precios y cuotas de los planes de pago.
--
-- Los precios de la 003 (US$ 12 / 45 / 180) se fijaron solo sobre el costo de
-- los tokens, con un margen de 4×. Cubrían la API, pero no la operación: con
-- ellos harían falta unas veinte cuentas institucionales para pagar los
-- sueldos del equipo. Esta migración fija los precios sobre el costo total
-- —sueldos, alojamiento, herramientas de desarrollo y modelos— y ajusta las
-- cuotas a lo que de verdad consume una consulta: ~15.000 tokens en Gemini
-- (medido) y ~20.000 en Claude (estimado), no los 1.300 y 3.000 de la 003.
--
-- El cálculo completo, en USD y CLP, está en docs/planes.md.
--
-- Idempotente: puede ejecutarse varias veces sin efecto acumulado.
BEGIN;

UPDATE plan SET
    descripcion        = 'Para una persona que consulta a diario y necesita análisis profundo.',
    precio_mensual_usd = 29,
    tokens_claude_mes  = 600000,
    tokens_gemini_mes  = 5000000,
    mensajes_por_dia   = 40
WHERE codigo_plan = 'investigador';

UPDATE plan SET
    descripcion        = 'Para un equipo o unidad académica que comparte el seguimiento.',
    precio_mensual_usd = 99,
    tokens_claude_mes  = 2000000,
    tokens_gemini_mes  = 15000000,
    mensajes_por_dia   = 150
WHERE codigo_plan = 'departamento';

UPDATE plan SET
    descripcion        = 'Para la oficina de análisis institucional, sin tope de consultas diarias.',
    precio_mensual_usd = 490,
    tokens_claude_mes  = 10000000,
    tokens_gemini_mes  = 60000000,
    mensajes_por_dia   = NULL
WHERE codigo_plan = 'institucional';

COMMIT;

-- Verificación ---------------------------------------------------------------
-- Ningún plan de pago puede quedar con un margen menor que 3× sobre el costo
-- máximo de su cuota. Costo por millón de tokens contabilizados:
--   Gemini 3.5 Flash-Lite, 90 % entrada / 10 % salida: 0,9×0,30 + 0,1×2,50 = 0,52
--   Claude Opus 5, 85 % entrada / 15 % salida:         0,85×5  + 0,15×25  = 8,00
DO $$
DECLARE
    fila RECORD;
BEGIN
    FOR fila IN
        SELECT codigo_plan, precio_mensual_usd AS precio,
               tokens_gemini_mes / 1e6 * 0.52 + tokens_claude_mes / 1e6 * 8.00 AS costo
          FROM plan
         WHERE precio_mensual_usd > 0
    LOOP
        IF fila.precio < 3 * fila.costo THEN
            RAISE EXCEPTION 'El plan % quedó con margen %×, por debajo de 3×.',
                fila.codigo_plan, round(fila.precio / fila.costo, 2);
        END IF;
    END LOOP;
END $$;
