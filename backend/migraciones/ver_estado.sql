-- Qué migraciones de la 018 a la 024 tiene aplicadas esta base. No modifica nada.
--
--   psql "$URL" -f backend/migraciones/ver_estado.sql
--
-- Cada fila responde «sí» o «NO» según una huella que deja la migración en esta
-- base (una tabla, una columna, una fila o un permiso). Todas las migraciones son
-- idempotentes: volver a aplicar una que ya dice «sí» no cambia nada.
SELECT m.migracion, CASE WHEN m.aplicada THEN 'sí' ELSE 'NO' END AS aplicada
FROM (VALUES
  (1, '018 catálogo de universidades', EXISTS (SELECT 1 FROM universidad WHERE nombre_universidad = 'Universidad de O''Higgins')),
  (2, '019 rol del asistente',         CASE WHEN to_regrole('kai_asistente') IS NULL THEN false
                                            ELSE has_table_privilege('kai_asistente', 'public.metrica', 'SELECT') END),
  (3, '020 puntaje total',             EXISTS (SELECT 1 FROM metrica WHERE nombre_metrica = 'Puntaje total')),
  (4, '021 GRAS por edición',          EXISTS (SELECT 1 FROM information_schema.columns
                                               WHERE table_name = 'ranking' AND column_name = 'puntajes_ponderados_desde')),
  (5, '022 grupos de comparación',     to_regclass('public.grupo_comparacion') IS NOT NULL),
  (6, '023 puesto oficial y estado',   to_regclass('public.posicion_oficial') IS NOT NULL),
  (7, '024 THE World',                 EXISTS (SELECT 1 FROM ranking WHERE nombre_ranking = 'THE World'))
) AS m(orden, migracion, aplicada)
ORDER BY m.orden;
