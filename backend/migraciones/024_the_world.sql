-- 024_the_world.sql
--
-- Agrega THE World University Rankings, el ranking mundial de Times Higher
-- Education, junto a THE Latam. Tiene los mismos cinco pilares; cambian los
-- pesos y el universo (más de 3.000 universidades, 33 chilenas en 2027).
--
-- Solo crea el ranking y sus métricas. Los datos los carga el cargador de rankings
-- desde las instantáneas de datos/rankings/the-world, tomadas del JSON público de
-- THE (`/json/ranking_tables/world_university_rankings/<edición>`):
--
--     python tools/rankings/cargar.py --escribir
--
-- Los pesos son los de la metodología vigente (WUR 3.0, desde 2024): Teaching
-- 29,5, Research Environment 29, Research Quality 30, Industry 4 e International
-- Outlook 7,5. Hasta 2023 (WUR 2.0) eran 30/30/30/2,5/7,5: el cargador calcula
-- el total de cada edición con los suyos, y la base guarda un peso por métrica.
--
-- Como todo «THE …», queda reservado a los planes de pago (acceso.py). Requiere la
-- 020 (Puntaje total). Idempotente.

BEGIN;

INSERT INTO ranking (nombre_ranking, descripcion_ranking, nivel_ranking, categoria_ranking, pais_ranking,
                     metodologia_ranking, pesos_editables, valores_son_crudos, normalizacion)
SELECT 'THE World',
       'Times Higher Education World University Rankings: el ranking mundial de THE, con más de 3.000 universidades de más de 100 países.',
       'Internacional', 'Docencia e investigación', 'Reino Unido',
       'Evalúa a las universidades intensivas en investigación con 18 indicadores agrupados en cinco pilares: Docencia (29,5 %), Entorno de investigación (29 %), Calidad de la investigación (30 %), Perspectiva internacional (7,5 %) e Industria (4 %). Usa datos bibliométricos de Scopus, encuestas de reputación académica y datos que declaran las propias instituciones. THE publica el puntaje total exacto de las 200 primeras y, de las demás, una banda.',
       false, false, 'propia'
WHERE NOT EXISTS (SELECT 1 FROM ranking WHERE nombre_ranking = 'THE World');

INSERT INTO metrica (id_ranking, nombre_metrica, descripcion_metrica, tipo_metrica, peso_metrica,
                     disciplina, pondera, sentido)
SELECT r.id_ranking, v.nombre, v.descripcion, v.tipo, v.peso, 'General', v.pondera, 'mayor'
FROM ranking r, (VALUES
  ('Teaching', 'Pilar de docencia: reputación docente, razón estudiantes por académico, doctorados otorgados y su razón con las licenciaturas, e ingreso institucional.', 'Academicos', 29.5, true),
  ('Research Environment', 'Pilar de entorno de investigación: reputación investigativa, ingreso por investigación y productividad científica.', 'Reputacion', 29, true),
  ('Research Quality', 'Pilar de calidad de la investigación: impacto de citas, fortaleza, excelencia e influencia de la investigación.', 'Articulos', 30, true),
  ('Industry', 'Pilar de industria: ingreso desde la industria y patentes.', 'Financiero', 4, true),
  ('International Outlook', 'Pilar de perspectiva internacional: estudiantes y académicos internacionales, y coautoría internacional.', 'Internacional', 7.5, true),
  ('Puntaje total', 'Puntaje global (Overall) que publica THE. Para las universidades que THE agrupa en bandas —todas las chilenas— solo publica un rango; ahí KAI lo calcula con los pesos de la metodología de cada edición, que reproducen los totales exactos de las 200 primeras, y el resultado cae dentro de la banda publicada.', 'Puntaje', 0, false)
) AS v(nombre, descripcion, tipo, peso, pondera)
WHERE r.nombre_ranking = 'THE World'
  AND NOT EXISTS (SELECT 1 FROM metrica m WHERE m.id_ranking = r.id_ranking AND m.nombre_metrica = v.nombre);

DO $$
DECLARE
    n INTEGER;
    suma NUMERIC;
BEGIN
    SELECT count(*), sum(m.peso_metrica) FILTER (WHERE m.pondera) INTO n, suma
    FROM metrica m JOIN ranking r USING (id_ranking) WHERE r.nombre_ranking = 'THE World';
    IF n <> 6 THEN RAISE EXCEPTION 'THE World debe tener 6 métricas y tiene %', n; END IF;
    IF suma <> 100 THEN RAISE EXCEPTION 'Los pilares de THE World suman % y no 100', suma; END IF;
    RAISE NOTICE 'THE World listo: cinco pilares y su puntaje total. Carga sus ediciones con tools/rankings/cargar.py --escribir';
END $$;

COMMIT;
