-- 011_scimago_en_dos_modos.sql
--
-- Una sola regla para todos los rankings:
--
--   metrica_universidad      el PUNTAJE normalizado, de 0 a 100 (modo «Puntajes»)
--   valor_real_universidad   el VALOR cuantificable detrás (modo «Valores medidos»)
--
-- Scimago era la excepción: metrica_universidad guardaba sus cifras crudas
-- —5.052 documentos, 67,8 % en acceso abierto, 0,91 de impacto—, y la pantalla de
-- puntajes las sumaba ponderadas, de modo que el orden era básicamente el tamaño
-- de cada universidad (la U. de Chile con 3.934,9 «puntos»). Esta migración:
--
--   1. copia cada cifra cruda de Scimago a valor_real_universidad, con su unidad;
--   2. reemplaza en metrica_universidad cada cifra por su percentil: la
--      proporción de las demás universidades del mismo año a las que supera, de 0
--      a 100 —el mismo método del Ranking KAI—;
--   3. deja registrado el origen de los valores de cada ranking.
--
-- No se pierde ninguna cifra: las crudas quedan en valor_real_universidad con la
-- misma clave, y la verificación del final aborta si falta alguna.
--
-- Requiere la 010. Idempotente: la transformación solo corre mientras
-- ranking.valores_son_crudos esté en verdadero, y lo apaga al terminar; una
-- segunda ejecución no vuelve a tratar percentiles como cifras crudas.

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ranking' AND column_name = 'valores_son_crudos') THEN
        RAISE EXCEPTION 'La 011 necesita la 010. Aplica antes 010_valores_crudos_de_la_fuente.sql.';
    END IF;
END $$;

-- De dónde salen los valores cuantificables de cada ranking. La interfaz lo
-- necesita para advertir lo correcto: no es lo mismo una cifra publicada por la
-- fuente que una que KAI midió con la definición ajena.
ALTER TABLE ranking
    ADD COLUMN IF NOT EXISTS origen_valores TEXT
        CONSTRAINT ranking_origen_valores_check CHECK (origen_valores IN ('fuente', 'medido'));

COMMENT ON COLUMN ranking.origen_valores IS
  'fuente: el ranking publica sus valores cuantificables y se guardan tal cual. '
  'medido: KAI los midió con la definición que el ranking publica. Nulo si el '
  'ranking no tiene valores cuantificables.';

UPDATE ranking SET origen_valores = 'medido'
WHERE nombre_ranking IN ('THE Latam', 'QS Latam', 'QS Global', 'Ranking KAI');
UPDATE ranking SET origen_valores = 'fuente' WHERE nombre_ranking = 'Scimago Latam';


-- ------------------------------------------------------------------ 1 y 2
-- Solo mientras metrica_universidad guarde cifras crudas.

CREATE TEMP TABLE scimago_crudo ON COMMIT DROP AS
SELECT mu.id_metrica, mu.id_universidad, mu.anio_metrica, mu.valor_metrica,
       to_jsonb(m) ->> 'unidad_valor' AS unidad
FROM metrica_universidad mu
JOIN metrica m ON m.id_metrica = mu.id_metrica
JOIN ranking r ON r.id_ranking = m.id_ranking
WHERE r.nombre_ranking = 'Scimago Latam'
  AND r.valores_son_crudos
  AND mu.valor_metrica IS NOT NULL;

INSERT INTO valor_real_universidad
    (id_metrica, id_universidad, anio_edicion, valor, unidad, calidad,
     formula, anios_origen, fuentes)
SELECT c.id_metrica, c.id_universidad, c.anio_metrica, c.valor_metrica,
       COALESCE(c.unidad, 'según SCImago'), 'directa',
       'valor publicado por SCImago',
       'publicaciones ' || (c.anio_metrica - 4) || '-' || c.anio_metrica,
       'SCImago Institutions Rankings'
FROM scimago_crudo c
ON CONFLICT (id_metrica, id_universidad, anio_edicion) DO UPDATE SET
    valor = EXCLUDED.valor, unidad = EXCLUDED.unidad, calidad = EXCLUDED.calidad,
    formula = EXCLUDED.formula, anios_origen = EXCLUDED.anios_origen,
    fuentes = EXCLUDED.fuentes, actualizado_en = now();

-- Percentil: 100 · (universidades del año con un valor estrictamente menor) / (n − 1).
-- rank() da 1 + el número de valores estrictamente menores, y los empates
-- comparten rango: las empatadas en el fondo reciben 0. Todas las métricas de
-- Scimago son de «más es mejor» (la 010 lo declara en metrica.sentido).
UPDATE metrica_universidad mu SET valor_metrica = p.puntaje
FROM (
    SELECT id_metrica, id_universidad, anio_metrica,
           CASE WHEN count(*) OVER w = 1 THEN 100.0
                ELSE 100.0 * (rank() OVER (w ORDER BY valor_metrica) - 1) / (count(*) OVER w - 1)
           END AS puntaje
    FROM scimago_crudo
    WINDOW w AS (PARTITION BY id_metrica, anio_metrica)
) p
WHERE mu.id_metrica = p.id_metrica
  AND mu.id_universidad = p.id_universidad
  AND mu.anio_metrica = p.anio_metrica;

UPDATE ranking SET valores_son_crudos = false WHERE nombre_ranking = 'Scimago Latam';

-- Dos decimales bastan para un percentil, y la columna es `numeric`: sin redondear
-- quedaban dieciséis, que se arrastran a cada respuesta del asistente. Se aplica
-- en cada ejecución porque es idempotente y corrige también una base ya migrada.
UPDATE metrica_universidad mu SET valor_metrica = round(mu.valor_metrica, 2)
FROM metrica m JOIN ranking r ON r.id_ranking = m.id_ranking
WHERE mu.id_metrica = m.id_metrica AND r.nombre_ranking = 'Scimago Latam'
  AND mu.valor_metrica <> round(mu.valor_metrica, 2);


-- ------------------------------------------------------------------ verificación

DO $$
DECLARE
    sin_pareja   INTEGER;
    fuera        INTEGER;
    crudos       INTEGER;
    sin_origen   INTEGER;
BEGIN
    -- Cada puntaje de Scimago debe tener su cifra cruda con la misma clave.
    SELECT count(*) INTO sin_pareja
    FROM metrica_universidad mu
    JOIN metrica m ON m.id_metrica = mu.id_metrica
    JOIN ranking r ON r.id_ranking = m.id_ranking
    WHERE r.nombre_ranking = 'Scimago Latam' AND mu.valor_metrica IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM valor_real_universidad v
                      WHERE v.id_metrica = mu.id_metrica AND v.id_universidad = mu.id_universidad
                        AND v.anio_edicion = mu.anio_metrica);
    IF sin_pareja > 0 THEN
        RAISE EXCEPTION '% puntajes de Scimago quedaron sin su cifra cruda', sin_pareja;
    END IF;

    SELECT count(*) INTO fuera
    FROM metrica_universidad mu
    JOIN metrica m ON m.id_metrica = mu.id_metrica
    JOIN ranking r ON r.id_ranking = m.id_ranking
    WHERE r.nombre_ranking = 'Scimago Latam'
      AND (mu.valor_metrica < 0 OR mu.valor_metrica > 100);
    IF fuera > 0 THEN
        RAISE EXCEPTION '% puntajes de Scimago quedaron fuera de 0-100', fuera;
    END IF;

    SELECT count(*) INTO crudos FROM ranking WHERE valores_son_crudos;
    IF crudos > 0 THEN
        RAISE EXCEPTION 'Quedan % rankings guardando cifras crudas como puntajes', crudos;
    END IF;

    -- Todo ranking con valores cuantificables debe declarar su origen.
    SELECT count(*) INTO sin_origen
    FROM ranking r
    WHERE r.origen_valores IS NULL
      AND EXISTS (SELECT 1 FROM valor_real_universidad v JOIN metrica m ON m.id_metrica = v.id_metrica
                  WHERE m.id_ranking = r.id_ranking);
    IF sin_origen > 0 THEN
        RAISE EXCEPTION '% rankings con valores cuantificables no declaran su origen', sin_origen;
    END IF;

    RAISE NOTICE 'Scimago en dos modos: puntajes en metrica_universidad, cifras en valor_real_universidad';
END $$;

COMMIT;
