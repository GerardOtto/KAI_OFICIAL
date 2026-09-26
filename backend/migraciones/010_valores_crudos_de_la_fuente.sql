-- 010_valores_crudos_de_la_fuente.sql
--
-- Marca los rankings cuya tabla de observaciones ya guarda valores medidos y no
-- puntajes, y da unidad y sentido a sus métricas. Hoy es uno: Scimago Latam, que
-- publica conteos, porcentajes e índices tal cual —5.052 documentos, 67,8 % en
-- acceso abierto, 0,91 de impacto normalizado—, no puntajes de 0 a 100.
--
-- El modo numérico de la pantalla de ranking lo necesita para saber de dónde
-- leer: de `valor_real_universidad` en los rankings cuyos valores se midieron
-- aparte (THE, QS y el Ranking KAI), y de `metrica_universidad` en los que la
-- fuente ya publica el valor crudo. Sin esta marca habría que reconocer a Scimago
-- por su nombre en el código.
--
-- La marca deja constancia, de paso, de un defecto que esta migración NO corrige:
-- el total que la pantalla de ranking calcula para Scimago suma magnitudes
-- incomparables —documentos por 8 %, un índice cercano a 1 por 13 %— y ordena
-- básicamente por tamaño. Corregirlo cambia lo que muestran Tendencias y el
-- asistente, y queda como decisión aparte.
--
-- Idempotente.

BEGIN;

ALTER TABLE ranking
    ADD COLUMN IF NOT EXISTS valores_son_crudos BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN ranking.valores_son_crudos IS
  'Verdadero si metrica_universidad guarda, para este ranking, el valor medido que '
  'publica la fuente y no un puntaje normalizado. Hoy solo Scimago Latam.';

ALTER TABLE metrica
    ADD COLUMN IF NOT EXISTS unidad_valor TEXT;

COMMENT ON COLUMN metrica.unidad_valor IS
  'Unidad del valor medido, cuando la métrica lo guarda en metrica_universidad '
  '(rankings con valores_son_crudos). En los demás la unidad viaja con cada fila '
  'de valor_real_universidad.';

UPDATE ranking SET valores_son_crudos = true WHERE nombre_ranking = 'Scimago Latam';

-- Unidades tomadas de la descripción de cada métrica en la base y de la
-- recolección de SCImago. PlumX queda sin unidad: la fuente no la documenta con
-- precisión suficiente y es preferible no inventarla.
CREATE TEMP TABLE scimago_unidades (nombre, unidad) ON COMMIT DROP AS VALUES
    ('Scientific Output',            'documentos'),
    ('International Collaboration',  'documentos con coautoría internacional'),
    ('Normalized Impact',            'razón respecto del promedio mundial (1 = promedio)'),
    ('Number of Q1 Articles',        'documentos en revistas Q1'),
    ('Excellence',                   'documentos en el 10 % más citado'),
    ('Excellence with Leadership',   'documentos en el 10 % más citado, liderados'),
    ('Scientific Leadership',        'documentos liderados'),
    ('Patents',                      'solicitudes de patente'),
    ('Innovative Knowledge',         'documentos citados en patentes'),
    ('Technological Impact',         '% de la producción citada en patentes'),
    ('Open Access',                  '% de la producción en acceso abierto'),
    ('Female Scientific Pool',       'autoras'),
    ('Scientific Talent Pool',       'autores'),
    ('Mendeley',                     'lecturas en Mendeley'),
    ('Overton',                      'documentos citados en políticas públicas'),
    ('SDG-related Output',           'documentos asociados a ODS'),
    ('Output in External Journals',  'documentos en revistas externas'),
    ('Output in Own Journals',       'revistas propias');

UPDATE metrica m SET unidad_valor = u.unidad, sentido = 'mayor'
FROM ranking r, scimago_unidades u
WHERE r.nombre_ranking = 'Scimago Latam'
  AND m.id_ranking = r.id_ranking
  AND m.nombre_metrica = u.nombre;

-- Plumx no tiene unidad pero sí sentido: más menciones es más impacto.
UPDATE metrica m SET sentido = 'mayor'
FROM ranking r
WHERE r.nombre_ranking = 'Scimago Latam' AND m.id_ranking = r.id_ranking
  AND m.nombre_metrica = 'Plumx';

DO $$
DECLARE
    marcados   INTEGER;
    sin_datos  INTEGER;
BEGIN
    SELECT count(*) INTO marcados FROM ranking WHERE valores_son_crudos;
    IF marcados <> 1 THEN
        RAISE EXCEPTION 'Se esperaba un solo ranking con valores crudos y hay %', marcados;
    END IF;

    -- Toda métrica de Scimago con observaciones debe declarar su sentido.
    SELECT count(*) INTO sin_datos
    FROM metrica m JOIN ranking r ON r.id_ranking = m.id_ranking
    WHERE r.nombre_ranking = 'Scimago Latam' AND m.sentido IS NULL
      AND EXISTS (SELECT 1 FROM metrica_universidad mu WHERE mu.id_metrica = m.id_metrica);
    IF sin_datos > 0 THEN
        RAISE EXCEPTION '% métricas de Scimago con datos no declaran su sentido', sin_datos;
    END IF;

    RAISE NOTICE 'Scimago Latam marcado como ranking de valores crudos';
END $$;

COMMIT;
