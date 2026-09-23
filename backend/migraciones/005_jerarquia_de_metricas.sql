-- Migración: distingue las métricas agregadoras de los indicadores que las componen.
--
-- Un ranking puede publicar su metodología en dos niveles: los pilares y los
-- indicadores que cada pilar agrupa. THE Latam trae los dos niveles en la misma
-- tabla, así que sumar `peso_metrica` sin distinguirlos daba 200 %: 100 de los
-- cinco pilares más 100 de sus diecisiete componentes. Scimago Latam tiene el
-- mismo caso a menor escala, con «Altmetrics (PlumX and Mendeley)» conviviendo
-- con sus dos partes.
--
-- Se añaden dos columnas a `metrica`:
--   id_metrica_padre  el agregador al que pertenece un componente
--   pondera           si la métrica entra en la composición del 100 % del ranking
--
-- Los indicadores no se eliminan: se conservan como referencia metodológica,
-- siguen consultables y siguen apareciendo en el desglose del glosario, pero no
-- suman. El criterio para decidir qué nivel pondera es cuál tiene observaciones
-- cargadas: en THE Latam son los pilares, y en Scimago Latam, las partes.
--
-- Los cálculos de puntaje no cambian: todos cruzan `metrica_universidad`, de modo
-- que una métrica sin observaciones nunca aportaba nada.
--
-- Idempotente: puede ejecutarse varias veces sin efecto acumulado.
BEGIN;

ALTER TABLE metrica ADD COLUMN IF NOT EXISTS id_metrica_padre INTEGER;
ALTER TABLE metrica ADD COLUMN IF NOT EXISTS pondera BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE metrica DROP CONSTRAINT IF EXISTS metrica_id_metrica_padre_fkey;
ALTER TABLE metrica ADD CONSTRAINT metrica_id_metrica_padre_fkey
    FOREIGN KEY (id_metrica_padre) REFERENCES metrica (id_metrica) ON DELETE SET NULL;

-- Una métrica no puede ser su propio agregador.
ALTER TABLE metrica DROP CONSTRAINT IF EXISTS metrica_padre_distinto_chk;
ALTER TABLE metrica ADD CONSTRAINT metrica_padre_distinto_chk
    CHECK (id_metrica_padre IS NULL OR id_metrica_padre <> id_metrica);

COMMENT ON COLUMN metrica.id_metrica_padre IS
    'Métrica agregadora de la que esta forma parte. NULL si no pertenece a ninguna.';
COMMENT ON COLUMN metrica.pondera IS
    'La métrica entra en la composición del 100 % del ranking. FALSE en el nivel '
    'jerárquico redundante, que se conserva como referencia metodológica.';

-- ---------------------------------------------------------------------------
-- THE Latam: los cinco pilares ponderan; sus diecisiete componentes, no.
-- ---------------------------------------------------------------------------

WITH jerarquia (componente, pilar) AS (VALUES
    ('Teaching reputation',          'Teaching'),
    ('Doctorate staff ratio',        'Teaching'),
    ('Student staff ratio',          'Teaching'),
    ('Institutional income',         'Teaching'),
    ('Doctorate bachelor ratio',     'Teaching'),
    ('Research reputation',          'Research Environment'),
    ('Research income',              'Research Environment'),
    ('Research productivity',        'Research Environment'),
    ('Citation impact',              'Research Quality'),
    ('Research strength',            'Research Quality'),
    ('Research excellence',          'Research Quality'),
    ('Research influence',           'Research Quality'),
    ('International students',       'International Outlook'),
    ('International staff',          'International Outlook'),
    ('International co-authorship',  'International Outlook'),
    ('Industry income',              'Industry'),
    ('Patents',                      'Industry')
)
UPDATE metrica c
   SET id_metrica_padre = p.id_metrica,
       pondera = FALSE
  FROM jerarquia j
  JOIN ranking r ON r.nombre_ranking = 'THE Latam'
  JOIN metrica p ON p.id_ranking = r.id_ranking AND p.nombre_metrica = j.pilar
 WHERE c.id_ranking = r.id_ranking
   AND c.nombre_metrica = j.componente;

-- ---------------------------------------------------------------------------
-- Scimago Latam: aquí el agregador es el que no pondera, porque las partes son
-- las que tienen observaciones.
-- ---------------------------------------------------------------------------

UPDATE metrica c
   SET id_metrica_padre = p.id_metrica,
       pondera = TRUE
  FROM ranking r
  JOIN metrica p ON p.id_ranking = r.id_ranking
                AND p.nombre_metrica = 'Altmetrics (PlumX and Mendeley)'
 WHERE r.nombre_ranking = 'Scimago Latam'
   AND c.id_ranking = r.id_ranking
   AND c.nombre_metrica IN ('Plumx', 'Mendeley');

UPDATE metrica m
   SET pondera = FALSE
  FROM ranking r
 WHERE r.nombre_ranking = 'Scimago Latam'
   AND m.id_ranking = r.id_ranking
   AND m.nombre_metrica = 'Altmetrics (PlumX and Mendeley)';

-- ---------------------------------------------------------------------------
-- Verificación: aborta si el reparto no deja THE Latam en 100 % o si queda
-- algún componente ponderando junto a su agregador.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    suma NUMERIC;
    solapes INTEGER;
BEGIN
    SELECT COALESCE(sum(m.peso_metrica), 0) INTO suma
      FROM metrica m JOIN ranking r ON r.id_ranking = m.id_ranking
     WHERE r.nombre_ranking = 'THE Latam' AND m.pondera;

    IF suma <> 100 THEN
        RAISE EXCEPTION 'THE Latam suma % por ciento en lugar de 100 tras la migración', suma;
    END IF;

    SELECT count(*) INTO solapes
      FROM metrica c JOIN metrica p ON p.id_metrica = c.id_metrica_padre
     WHERE c.pondera AND p.pondera;

    IF solapes > 0 THEN
        RAISE EXCEPTION '% métricas ponderan a la vez que su agregador', solapes;
    END IF;
END $$;

COMMIT;
