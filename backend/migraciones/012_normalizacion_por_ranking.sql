-- 012_normalizacion_por_ranking.sql
--
-- Cómo se obtiene el puntaje de cada ranking a partir de su valor cuantificable.
-- Lo necesita el switch global de modos para saber qué puede hacer cada módulo en
-- «Valores medidos»:
--
--   percentil  el puntaje es el percentil de la cifra entre las universidades del
--              año. Se puede recalcular en el cliente: la Simulación deja mover
--              la cifra real y reordena. Ranking KAI y Scimago Latam.
--
--   propia     el puntaje lo calcula el ranking con parámetros que no publica (la
--              media y la desviación de su población, en THE). La cifra se puede
--              mostrar, pero no convertir en puntaje. THE, QS y Shanghai.
--
-- Requiere la 011. Idempotente.

BEGIN;

ALTER TABLE ranking
    ADD COLUMN IF NOT EXISTS normalizacion TEXT
        CONSTRAINT ranking_normalizacion_check CHECK (normalizacion IN ('percentil', 'propia'));

COMMENT ON COLUMN ranking.normalizacion IS
  'percentil: el puntaje es el percentil de valor_real_universidad entre las '
  'universidades del año, y se puede recalcular. propia: lo calcula el ranking '
  'con parámetros que no publica.';

UPDATE ranking SET normalizacion = 'percentil'
WHERE nombre_ranking IN ('Ranking KAI', 'Scimago Latam');
UPDATE ranking SET normalizacion = 'propia'
WHERE normalizacion IS NULL;

DO $$
DECLARE
    mal INTEGER;
BEGIN
    -- Un ranking «percentil» debe tener, para cada puntaje, la cifra de la que sale.
    SELECT count(*) INTO mal
    FROM metrica_universidad mu
    JOIN metrica m ON m.id_metrica = mu.id_metrica
    JOIN ranking r ON r.id_ranking = m.id_ranking
    WHERE r.normalizacion = 'percentil'
      AND NOT EXISTS (SELECT 1 FROM valor_real_universidad v
                      WHERE v.id_metrica = mu.id_metrica AND v.id_universidad = mu.id_universidad
                        AND v.anio_edicion = mu.anio_metrica);
    IF mal > 0 THEN
        RAISE EXCEPTION '% puntajes de rankings por percentil no tienen su cifra', mal;
    END IF;
    RAISE NOTICE 'normalización declarada en todos los rankings';
END $$;

COMMIT;
