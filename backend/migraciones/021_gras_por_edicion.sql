-- 021_gras_por_edicion.sql
--
-- Corrige el puntaje total de Shanghai GRAS que dejó la 020 en las ediciones
-- 2017-2023.
--
-- La 020 trató todas las ediciones de GRAS como las de 2024 en adelante, en que
-- cada indicador se publica ya ponderado (el de World-Class Output llega a 200) y
-- el total es la suma. Hasta 2023 no era así: GRAS publicaba cada indicador de 0
-- a 100 y el total era Σ indicador × peso, con pesos propios de cada materia y
-- edición —Matemáticas: PUB 100, CNCI 100, IC 20, TOP 100, AWARD 100 en 2017;
-- CNCI 20 en 2023—. Sumarlos sin más contaba IC entero en vez de a un quinto, y
-- el Resumen ordenaba con esa misma suma.
--
-- Lo comprobó el cargador de rankings (tools/rankings) al reconstruir cada
-- edición desde la API de ShanghaiRanking: en 2017 la suma se alejaba hasta 138
-- puntos del total publicado de las 50 primeras.
--
-- Qué hace:
--
--   1. Reemplaza `ranking.puntajes_ponderados` (verdadero o falso para todo el
--      ranking) por `ranking.puntajes_ponderados_desde`: la primera edición en que
--      los puntajes vienen ponderados. 2024 en GRAS; vacía en los demás.
--   2. Borra los totales de GRAS 2017-2023 que son la suma simple de sus
--      indicadores, es decir, los que calculó la 020. Los correctos los agrega
--      `python tools/rankings/cargar.py --escribir`, con los pesos de cada materia
--      y edición deducidos de los totales que GRAS publica para su top 50.
--   3. Actualiza la descripción del total de GRAS, que el glosario muestra.
--
-- Idempotente: solo borra los totales que coinciden con la suma simple, así que
-- volver a ejecutarla después del cargador no borra los suyos (salvo el caso
-- improbable de que ambos coincidan, y entonces el cargador los repone). Requiere
-- la 020.

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM metrica WHERE tipo_metrica = 'Puntaje' AND nombre_metrica = 'Puntaje total') THEN
        RAISE EXCEPTION 'La 021 necesita la 020. Aplica antes 020_puntaje_total.sql.';
    END IF;
END $$;


-- -------------------------------------------- desde qué edición vienen ponderados

ALTER TABLE ranking ADD COLUMN IF NOT EXISTS puntajes_ponderados_desde INTEGER;

COMMENT ON COLUMN ranking.puntajes_ponderados_desde IS
  'Primera edición en que el puntaje de cada métrica ya incluye su peso (Shanghai '
  'GRAS, 2024): desde ella el total es la suma de los puntajes. Antes, o si es '
  'NULL, el total es la suma de puntaje × peso / 100.';

UPDATE ranking SET puntajes_ponderados_desde = CASE WHEN nombre_ranking = 'Shanghai GRAS' THEN 2024 END
WHERE puntajes_ponderados_desde IS DISTINCT FROM CASE WHEN nombre_ranking = 'Shanghai GRAS' THEN 2024 END;

ALTER TABLE ranking DROP COLUMN IF EXISTS puntajes_ponderados;


-- ------------------------------------------ los totales de GRAS anteriores a 2024

DELETE FROM metrica_universidad t
USING metrica tm, ranking r
WHERE t.id_metrica = tm.id_metrica
  AND tm.id_ranking = r.id_ranking AND r.nombre_ranking = 'Shanghai GRAS'
  AND tm.tipo_metrica = 'Puntaje'
  AND t.anio_metrica < 2024
  AND t.valor_metrica = (
      SELECT round(sum(mu.valor_metrica), 1)
      FROM metrica_universidad mu
      JOIN metrica m ON m.id_metrica = mu.id_metrica AND m.pondera
      WHERE m.id_ranking = tm.id_ranking AND m.disciplina IS NOT DISTINCT FROM tm.disciplina
        AND mu.id_universidad = t.id_universidad AND mu.anio_metrica = t.anio_metrica);

UPDATE metrica m SET descripcion_metrica = d.texto
FROM ranking r, (VALUES
  ('Shanghai GRAS', 'Puntaje total de la disciplina. ShanghaiRanking solo lo publica para las 50 primeras de cada una; para las demás, KAI aplica su método: desde 2024, la suma de los indicadores, que GRAS publica ya ponderados; hasta 2023, cada indicador por el peso de su materia en esa edición, deducido de los totales publicados.')
) AS d(ranking, texto)
WHERE r.id_ranking = m.id_ranking AND r.nombre_ranking = d.ranking
  AND m.tipo_metrica = 'Puntaje'
  AND m.descripcion_metrica IS DISTINCT FROM d.texto;


-- ------------------------------------------------------------------ verificación

DO $$
DECLARE
    n INTEGER;
    sin_cargar INTEGER;
BEGIN
    SELECT count(*) INTO n FROM ranking WHERE puntajes_ponderados_desde IS NOT NULL;
    IF n <> 1 OR (SELECT puntajes_ponderados_desde FROM ranking WHERE nombre_ranking = 'Shanghai GRAS') <> 2024 THEN
        RAISE EXCEPTION 'puntajes_ponderados_desde debe valer 2024 en Shanghai GRAS y nada en los demás';
    END IF;

    -- Desde 2024 el total de GRAS sigue siendo la suma de los indicadores.
    SELECT count(*) INTO n FROM (
        SELECT t.valor_metrica AS total, round(sum(mu.valor_metrica), 1) AS suma
        FROM metrica_universidad mu
        JOIN metrica m ON m.id_metrica = mu.id_metrica AND m.pondera
        JOIN ranking r ON r.id_ranking = m.id_ranking AND r.nombre_ranking = 'Shanghai GRAS'
        JOIN metrica tm ON tm.id_ranking = m.id_ranking AND tm.tipo_metrica = 'Puntaje'
                       AND tm.disciplina IS NOT DISTINCT FROM m.disciplina
        JOIN metrica_universidad t ON t.id_metrica = tm.id_metrica
                                  AND t.id_universidad = mu.id_universidad AND t.anio_metrica = mu.anio_metrica
        WHERE mu.anio_metrica >= 2024
        GROUP BY t.valor_metrica, t.id_metrica, mu.id_universidad, mu.anio_metrica
    ) x WHERE x.total <> x.suma;
    IF n > 0 THEN RAISE EXCEPTION '% totales de GRAS desde 2024 no son la suma de sus indicadores', n; END IF;

    SELECT count(DISTINCT (m.disciplina, mu.id_universidad, mu.anio_metrica)) INTO sin_cargar
    FROM metrica_universidad mu
    JOIN metrica m ON m.id_metrica = mu.id_metrica AND m.pondera
    JOIN ranking r ON r.id_ranking = m.id_ranking AND r.nombre_ranking = 'Shanghai GRAS'
    WHERE mu.anio_metrica < 2024
      AND NOT EXISTS (SELECT 1 FROM metrica tm JOIN metrica_universidad t ON t.id_metrica = tm.id_metrica
                      WHERE tm.id_ranking = m.id_ranking AND tm.tipo_metrica = 'Puntaje'
                        AND tm.disciplina IS NOT DISTINCT FROM m.disciplina
                        AND t.id_universidad = mu.id_universidad AND t.anio_metrica = mu.anio_metrica);
    -- Tras el cargador quedan cuatro (2018, Oceanography y Mining & Mineral
    -- Engineering): en esas materias los pesos no se dejan deducir.
    RAISE NOTICE 'GRAS 2017-2023: % universidades por disciplina y edición sin total; el cargador agrega los que se pueden calcular (tools/rankings/cargar.py --escribir)', sin_cargar;
END $$;

COMMIT;
