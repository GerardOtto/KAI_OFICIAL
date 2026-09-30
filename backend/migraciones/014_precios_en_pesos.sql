-- Migración: precio de los planes en pesos chilenos.
--
-- Las universidades compran en pesos, con orden de compra y factura, así que la
-- portada muestra el precio en CLP. Se guarda como columna propia y no como una
-- conversión en el navegador: el precio en pesos lo fija el negocio —puede ser
-- un redondeo comercial— y no debe moverse solo con el tipo de cambio.
--
-- Valores iniciales: los de docs/planes.md, convertidos a 946 CLP/USD y
-- redondeados a la centena. Netos, sin IVA. Para cambiarlos basta un UPDATE.
--
-- `precio_lista_clp` es el precio de referencia que la portada muestra tachado
-- junto al vigente, con el rótulo «Descuento de lanzamiento». Es el vigente
-- redondeado hacia arriba a una cifra significativa. Ojo: la Ley 19.496 exige
-- que un precio de referencia sea uno que efectivamente se cobre; al terminar el
-- lanzamiento, o se pasa a cobrar el de lista o se deja en NULL, y el tachado
-- desaparece solo.
--
-- Idempotente: puede ejecutarse varias veces sin efecto acumulado.
BEGIN;

ALTER TABLE plan ADD COLUMN IF NOT EXISTS precio_mensual_clp INTEGER NOT NULL DEFAULT 0
    CHECK (precio_mensual_clp >= 0);
ALTER TABLE plan ADD COLUMN IF NOT EXISTS precio_lista_clp INTEGER;

UPDATE plan SET precio_mensual_clp = 27400,  precio_lista_clp = 30000  WHERE codigo_plan = 'investigador';
UPDATE plan SET precio_mensual_clp = 93700,  precio_lista_clp = 100000 WHERE codigo_plan = 'departamento';
UPDATE plan SET precio_mensual_clp = 463500, precio_lista_clp = 500000 WHERE codigo_plan = 'institucional';

COMMIT;

-- Verificación: todo plan público de pago tiene precio en pesos, los gratuitos
-- no cobran nada, y un precio de lista, si lo hay, es mayor que el vigente.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM plan WHERE publico AND precio_mensual_usd > 0 AND precio_mensual_clp = 0) THEN
        RAISE EXCEPTION 'Hay planes de pago públicos sin precio en pesos';
    END IF;
    IF EXISTS (SELECT 1 FROM plan WHERE precio_mensual_usd = 0 AND precio_mensual_clp > 0) THEN
        RAISE EXCEPTION 'Un plan gratuito quedó con precio en pesos';
    END IF;
    IF EXISTS (SELECT 1 FROM plan WHERE precio_lista_clp IS NOT NULL
                                    AND precio_lista_clp <= precio_mensual_clp) THEN
        RAISE EXCEPTION 'Un precio de lista no es mayor que el precio vigente';
    END IF;
END $$;
