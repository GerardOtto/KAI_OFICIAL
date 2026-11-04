-- 020_puntaje_total.sql
--
-- El puntaje total de cada universidad, en todos los rankings, como una métrica
-- más: «Puntaje total» (tipo «Puntaje»). Hasta ahora solo QS Global y QS por
-- Disciplina lo traían —como «Overall»— y la plataforma mostraba en su lugar una
-- suma ponderada propia que, en varios rankings, no coincidía con la de la fuente.
--
-- Qué se carga en cada ranking, y de dónde sale:
--
--   THE Latam       el Overall publicado. Bajo cierto puesto THE solo publica una
--                   banda (p. ej. «13.2–24.5»); ahí se calcula con los pesos de su
--                   metodología latinoamericana, que reproducen los publicados con
--                   un error máximo de 0,08 puntos. Cada valor calculado cae dentro
--                   de la banda que THE publicó para esa universidad.
--   QS Latam        el Overall publicado. QS solo lo publica para las mejor
--   QS Global       clasificadas (22 de 41 chilenas en QS Latam, 5 de 17 en QS
--                   Global): el resto queda sin total, porque la fuente no lo da y
--                   su reescalado no es exactamente lineal (no se reconstruye sin
--                   un error de hasta 1,2 puntos).
--   QS Disciplina   el Overall publicado, que ya estaba cargado.
--   Shanghai GRAS   la suma de los puntajes de los indicadores, que GRAS publica ya
--                   ponderados: es su total por definición (coincide con el
--                   publicado para las 50 primeras de cada disciplina, ±0,2).
--   Shanghai ARWU   la suma ponderada de los seis indicadores como porcentaje de la
--                   de la primera del mundo, igual que ARWU. Solo lo publica para
--                   las 100 primeras; el cálculo reproduce esos con ±0,1. La
--                   edición 2003 usó otra metodología y queda sin total.
--   Scimago Latam   SCImago no publica total, solo la posición: es la suma
--                   ponderada de los puntajes, la misma que ordena el Resumen.
--   Ranking KAI     la suma ponderada de sus diez métricas, por definición.
--
-- Además corrige tres errores que la verificación encontró:
--
--   1. QS Global 2026 quedó con cuatro columnas corridas: esa edición agregó
--      «International Students Diversity» y lo que se guardó como International
--      Research Network era ese indicador; como Employment Outcomes, el IRN; como
--      Sustainability, el Employment Outcomes; y como Overall, el Sustainability
--      (69,5 para la U. de Concepción, cuyo total publicado es 27,8). Las otras
--      ediciones coinciden con la planilla oficial celda por celda.
--   2. QS Global guardaba 0 como total donde QS no lo publica. Un cero se leía
--      como el peor puntaje posible; ahora esas filas no existen.
--   3. THE Latam ponderaba sus pilares 30/30/30/0/10, los pesos del ranking
--      mundial. Los del latinoamericano, deducidos de los totales publicados, son
--      Teaching 35, Research Environment 33,5, Research Quality 20, Industry 4 e
--      International Outlook 7,5 desde 2024 (36/34/20/2,5/7,5 hasta 2023). Con los
--      anteriores, el puntaje del Resumen se alejaba hasta 8 puntos del oficial.
--
-- Y declara `ranking.puntajes_ponderados`: en Shanghai GRAS el puntaje de cada
-- indicador ya incluye su peso (el de Q1 va de 0 a 100, el de CNCI de 0 a 50…),
-- así que el total es la suma, sin volver a multiplicar por el peso. Multiplicarlo
-- de nuevo, como hacía el Resumen, daba un total que no era el de GRAS.
--
-- Los totales de Scimago y del Ranking KAI dependen de los puntajes de sus
-- métricas: quien los recargue debe recalcularlos (cargar_ranking_kai.py ya lo
-- hace). La batería del backend comprueba que coincidan.
--
-- Idempotente: los valores se escriben con ON CONFLICT y las métricas solo se
-- crean si faltan. Requiere la 005 (pondera) y la 009 (Ranking KAI).

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'metrica' AND column_name = 'pondera') THEN
        RAISE EXCEPTION 'La 020 necesita la 005. Aplica antes 005_jerarquia_de_metricas.sql.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM ranking WHERE nombre_ranking = 'Ranking KAI') THEN
        RAISE EXCEPTION 'La 020 necesita la 009. Aplica antes 009_ranking_kai.sql.';
    END IF;
END $$;


-- ------------------------------------------- Shanghai GRAS: puntajes ponderados

ALTER TABLE ranking ADD COLUMN IF NOT EXISTS puntajes_ponderados BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN ranking.puntajes_ponderados IS
  'El puntaje de cada métrica ya incluye su peso (Shanghai GRAS): el total es la '
  'suma de los puntajes. Si es falso, el total es la suma de puntaje × peso / 100.';

UPDATE ranking SET puntajes_ponderados = (nombre_ranking = 'Shanghai GRAS')
WHERE puntajes_ponderados IS DISTINCT FROM (nombre_ranking = 'Shanghai GRAS');


-- --------------------------------------------- THE Latam: pesos latinoamericanos

UPDATE metrica m SET peso_metrica = v.peso
FROM (VALUES ('Teaching', 35), ('Research Environment', 33.5), ('Research Quality', 20),
             ('Industry', 4), ('International Outlook', 7.5)) AS v(nombre, peso),
     ranking r
WHERE r.id_ranking = m.id_ranking AND r.nombre_ranking = 'THE Latam'
  AND m.pondera AND m.nombre_metrica = v.nombre
  AND m.peso_metrica IS DISTINCT FROM v.peso;


-- ------------------------------------- QS Global 2026: columnas corridas en uno

CREATE TEMP TABLE qs_global_2026 (universidad TEXT, metrica TEXT, valor NUMERIC) ON COMMIT DROP;
INSERT INTO qs_global_2026 VALUES
('Pontificia Universidad Catolica de Chile', 'Employment Outcomes', 99.9),
('Pontificia Universidad Catolica de Chile', 'International Research Network', 81.2),
('Pontificia Universidad Catolica de Chile', 'Sustainability', 80.0),
('Pontificia Universidad Catolica de Valparaiso', 'Employment Outcomes', 12.2),
('Pontificia Universidad Catolica de Valparaiso', 'International Research Network', 43.3),
('Pontificia Universidad Catolica de Valparaiso', 'Sustainability', 36.9),
('Universidad Adolfo Ibanez', 'Employment Outcomes', 60.7),
('Universidad Adolfo Ibanez', 'International Research Network', 34.4),
('Universidad Adolfo Ibanez', 'Sustainability', 40.0),
('Universidad Andres Bello', 'Employment Outcomes', 2.5),
('Universidad Andres Bello', 'International Research Network', 60.9),
('Universidad Andres Bello', 'Sustainability', 56.9),
('Universidad Austral de Chile', 'Employment Outcomes', 4.8),
('Universidad Austral de Chile', 'International Research Network', 45.8),
('Universidad Austral de Chile', 'Sustainability', 44.0),
('Universidad Autonoma de Chile', 'Employment Outcomes', 2.5),
('Universidad Autonoma de Chile', 'International Research Network', 38.9),
('Universidad Autonoma de Chile', 'Sustainability', 35.9),
('Universidad Catolica de Temuco', 'Employment Outcomes', 2.5),
('Universidad Catolica de Temuco', 'International Research Network', 21.9),
('Universidad Catolica de Temuco', 'Sustainability', 26.7),
('Universidad Catolica del Norte', 'Employment Outcomes', 2.5),
('Universidad Catolica del Norte', 'International Research Network', 45.0),
('Universidad Catolica del Norte', 'Sustainability', 53.0),
('Universidad Diego Portales', 'Employment Outcomes', 8.8),
('Universidad Diego Portales', 'International Research Network', 37.1),
('Universidad Diego Portales', 'Sustainability', 36.4),
('Universidad Tecnica Federico Santa Maria', 'Employment Outcomes', 17.7),
('Universidad Tecnica Federico Santa Maria', 'International Research Network', 46.3),
('Universidad Tecnica Federico Santa Maria', 'Sustainability', 42.7),
('Universidad de Chile', 'Employment Outcomes', 97.6),
('Universidad de Chile', 'International Research Network', 77.9),
('Universidad de Chile', 'Sustainability', 69.5),
('Universidad de Concepcion', 'Employment Outcomes', 16.9),
('Universidad de Concepcion', 'International Research Network', 64.1),
('Universidad de Concepcion', 'Sustainability', 69.5),
('Universidad de Santiago de Chile', 'Employment Outcomes', 17.5),
('Universidad de Santiago de Chile', 'International Research Network', 53.9),
('Universidad de Santiago de Chile', 'Sustainability', 53.7),
('Universidad de Talca', 'Employment Outcomes', 2.5),
('Universidad de Talca', 'International Research Network', 46.4),
('Universidad de Talca', 'Sustainability', 29.4),
('Universidad de Tarapaca', 'Employment Outcomes', 2.5),
('Universidad de Tarapaca', 'International Research Network', 49.6),
('Universidad de Tarapaca', 'Sustainability', 21.0),
('Universidad de Valparaiso', 'Employment Outcomes', 4.8),
('Universidad de Valparaiso', 'International Research Network', 34.3),
('Universidad de Valparaiso', 'Sustainability', 39.7),
('Universidad de la Frontera', 'Employment Outcomes', 2.7),
('Universidad de la Frontera', 'International Research Network', 44.0),
('Universidad de la Frontera', 'Sustainability', 32.3),
('Universidad de los Andes', 'Employment Outcomes', 45.2),
('Universidad de los Andes', 'International Research Network', 17.9),
('Universidad de los Andes', 'Sustainability', 28.9),
('Universidad del Bio-Bio', 'Employment Outcomes', 2.5),
('Universidad del Bio-Bio', 'International Research Network', 32.1),
('Universidad del Bio-Bio', 'Sustainability', 24.0),
('Universidad del Desarrollo', 'Employment Outcomes', 6.8),
('Universidad del Desarrollo', 'International Research Network', 18.3),
('Universidad del Desarrollo', 'Sustainability', 47.5);

UPDATE metrica_universidad mu SET valor_metrica = c.valor
FROM qs_global_2026 c
JOIN universidad u ON u.nombre_universidad = c.universidad
JOIN metrica m ON m.nombre_metrica = c.metrica
JOIN ranking r ON r.id_ranking = m.id_ranking AND r.nombre_ranking = 'QS Global'
WHERE mu.id_metrica = m.id_metrica AND mu.id_universidad = u.id_universidad
  AND mu.anio_metrica = 2026
  AND mu.valor_metrica IS DISTINCT FROM c.valor;


-- ------------------------------------------------- la métrica «Puntaje total»

-- La que ya existía en QS se llamaba «Overall» y, en QS por Disciplina, tenía el
-- tipo de una dimensión (Investigación) y entraba al reparto de pesos con peso 0:
-- en Simulación aparecía como una métrica más que no movía nada.
UPDATE metrica m SET nombre_metrica = 'Puntaje total', tipo_metrica = 'Puntaje',
                     pondera = false, peso_metrica = 0, sentido = 'mayor'
FROM ranking r
WHERE r.id_ranking = m.id_ranking AND r.nombre_ranking IN ('QS Global', 'QS por Disciplina')
  AND m.nombre_metrica = 'Overall';

-- Una por ranking y, en los multidisciplinarios, una por disciplina. En QS por
-- Disciplina solo existe en las disciplinas en que QS publicó algún total.
INSERT INTO metrica (id_ranking, nombre_metrica, tipo_metrica, peso_metrica, disciplina, pondera, sentido)
SELECT DISTINCT r.id_ranking, 'Puntaje total', 'Puntaje', 0, m.disciplina, false, 'mayor'
FROM ranking r
JOIN metrica m ON m.id_ranking = r.id_ranking AND m.pondera
WHERE r.nombre_ranking IN ('THE Latam', 'QS Latam', 'Scimago Latam', 'Shanghai GRAS',
                           'Shanghai ARWU', 'Ranking KAI')
  AND NOT EXISTS (SELECT 1 FROM metrica t
                  WHERE t.id_ranking = r.id_ranking AND t.tipo_metrica = 'Puntaje'
                    AND t.disciplina IS NOT DISTINCT FROM m.disciplina);

-- Lo que el glosario muestra al pasar el cursor: de dónde sale el número.
UPDATE metrica m SET descripcion_metrica = d.texto
FROM ranking r, (VALUES
  ('THE Latam', 'Puntaje global (Overall) que publica THE. Para las universidades que THE agrupa en bandas solo publica un rango; ahí KAI lo calcula con los pesos de la metodología de cada edición, que reproducen los totales publicados con un error máximo de 0,1 punto, y el resultado cae dentro de la banda publicada.'),
  ('QS Latam', 'Puntaje global (Overall) que publica QS. QS solo lo publica para las universidades mejor clasificadas; para las demás no informa un total y la celda queda vacía.'),
  ('QS Global', 'Puntaje global (Overall) que publica QS. QS solo lo publica para las universidades mejor clasificadas; para las demás no informa un total y la celda queda vacía.'),
  ('QS por Disciplina', 'Puntaje global de la disciplina (Overall) que publica QS, solo para las universidades mejor clasificadas en ella.'),
  ('Scimago Latam', 'SCImago no publica un puntaje total, solo la posición. KAI lo calcula como la suma de los puntajes de cada indicador por su peso en la metodología.'),
  ('Shanghai GRAS', 'Puntaje total de la disciplina: la suma de los puntajes de sus indicadores, que ShanghaiRanking publica ya ponderados. Solo lo muestra para las 50 primeras de cada disciplina; KAI aplica la misma suma a las demás.'),
  ('Shanghai ARWU', 'Puntaje total de ARWU: la suma ponderada de sus seis indicadores como porcentaje de la de la primera universidad del mundo, que recibe 100. ARWU solo lo publica para las 100 primeras; KAI aplica el mismo cálculo a las demás. La edición 2003 usó otra metodología y no tiene total.'),
  ('Ranking KAI', 'Suma de los puntajes de las diez métricas por su peso.')
) AS d(ranking, texto)
WHERE r.id_ranking = m.id_ranking AND r.nombre_ranking = d.ranking
  AND m.tipo_metrica = 'Puntaje'
  AND m.descripcion_metrica IS DISTINCT FROM d.texto;


-- -------------------------------------------------------- valores publicados

CREATE TEMP TABLE total_publicado (ranking TEXT, anio INT, universidad TEXT, valor NUMERIC) ON COMMIT DROP;
INSERT INTO total_publicado VALUES
('THE Latam', 2016, 'Pontificia Universidad Catolica de Chile', 80.2),
('THE Latam', 2016, 'Pontificia Universidad Catolica de Valparaiso', 41.4),  -- calculado, banda 40.2-44.2
('THE Latam', 2016, 'Universidad Austral de Chile', 52.8),
('THE Latam', 2016, 'Universidad Diego Portales', 35.0),  -- calculado, banda 31.1-35.0
('THE Latam', 2016, 'Universidad Tecnica Federico Santa Maria', 58.7),
('THE Latam', 2016, 'Universidad de Chile', 75.4),
('THE Latam', 2016, 'Universidad de Concepcion', 58.5),
('THE Latam', 2016, 'Universidad de Santiago de Chile', 52.5),
('THE Latam', 2016, 'Universidad de Talca', 46.1),
('THE Latam', 2016, 'Universidad de la Frontera', 40.2),  -- calculado, banda 40.2-44.2
('THE Latam', 2016, 'Universidad del Desarrollo', 28.0),  -- calculado, banda 28.0-29.9
('THE Latam', 2017, 'Pontificia Universidad Catolica de Chile', 85.7),
('THE Latam', 2017, 'Pontificia Universidad Catolica de Valparaiso', 59.1),
('THE Latam', 2017, 'Universidad Adolfo Ibanez', 51.6),  -- calculado, banda 49.6-51.6
('THE Latam', 2017, 'Universidad Andres Bello', 43.2),  -- calculado, banda 43.1-44.0
('THE Latam', 2017, 'Universidad Austral de Chile', 58.3),
('THE Latam', 2017, 'Universidad Autonoma de Chile', 34.5),  -- calculado, banda 30.9-38.3
('THE Latam', 2017, 'Universidad Catolica de Temuco', 22.5),  -- calculado, banda 18.1-26.8
('THE Latam', 2017, 'Universidad Catolica del Norte', 45.2),  -- calculado, banda 44.7-46.5
('THE Latam', 2017, 'Universidad Diego Portales', 49.5),  -- calculado, banda 46.7-49.5
('THE Latam', 2017, 'Universidad Tecnica Federico Santa Maria', 58.6),
('THE Latam', 2017, 'Universidad de Chile', 81.1),
('THE Latam', 2017, 'Universidad de Concepcion', 63.9),
('THE Latam', 2017, 'Universidad de Santiago de Chile', 53.6),  -- calculado, banda 53.1-54.9
('THE Latam', 2017, 'Universidad de Talca', 49.6),  -- calculado, banda 49.6-51.6
('THE Latam', 2017, 'Universidad de Valparaiso', 51.0),  -- calculado, banda 49.6-51.6
('THE Latam', 2017, 'Universidad de la Frontera', 49.9),  -- calculado, banda 49.6-51.6
('THE Latam', 2017, 'Universidad de los Andes', 46.0),  -- calculado, banda 44.7-46.5
('THE Latam', 2017, 'Universidad del Desarrollo', 47.0),  -- calculado, banda 46.7-49.5
('THE Latam', 2018, 'Pontificia Universidad Catolica de Chile', 85.7),
('THE Latam', 2018, 'Pontificia Universidad Catolica de Valparaiso', 63.5),
('THE Latam', 2018, 'Universidad Adolfo Ibanez', 49.4),  -- calculado, banda 49.4-53.4
('THE Latam', 2018, 'Universidad Andres Bello', 41.9),  -- calculado, banda 41.9-45.2
('THE Latam', 2018, 'Universidad Austral de Chile', 63.2),
('THE Latam', 2018, 'Universidad Autonoma de Chile', 40.5),  -- calculado, banda 38.8-41.8
('THE Latam', 2018, 'Universidad Catolica de Temuco', 22.2),  -- calculado, banda 12.9-30.7
('THE Latam', 2018, 'Universidad Catolica de la Santisima Concepcion', 30.5),  -- calculado, banda 12.9-30.7
('THE Latam', 2018, 'Universidad Catolica del Norte', 40.5),  -- calculado, banda 38.8-41.8
('THE Latam', 2018, 'Universidad Diego Portales', 50.1),  -- calculado, banda 49.4-53.4
('THE Latam', 2018, 'Universidad Mayor', 29.7),  -- calculado, banda 12.9-30.7
('THE Latam', 2018, 'Universidad Tecnica Federico Santa Maria', 64.7),
('THE Latam', 2018, 'Universidad de Antofagasta', 28.3),  -- calculado, banda 12.9-30.7
('THE Latam', 2018, 'Universidad de Chile', 81.5),
('THE Latam', 2018, 'Universidad de Concepcion', 69.9),
('THE Latam', 2018, 'Universidad de La Serena', 31.8),  -- calculado, banda 30.9-38.0
('THE Latam', 2018, 'Universidad de Magallanes', 35.4),  -- calculado, banda 30.9-38.0
('THE Latam', 2018, 'Universidad de Playa Ancha', 33.6),  -- calculado, banda 30.9-38.0
('THE Latam', 2018, 'Universidad de Santiago de Chile', 64.8),
('THE Latam', 2018, 'Universidad de Talca', 53.4),  -- calculado, banda 49.4-53.4
('THE Latam', 2018, 'Universidad de Tarapaca', 36.4),  -- calculado, banda 30.9-38.0
('THE Latam', 2018, 'Universidad de Valparaiso', 55.7),
('THE Latam', 2018, 'Universidad de la Frontera', 48.2),  -- calculado, banda 45.4-48.9
('THE Latam', 2018, 'Universidad de los Andes', 53.9),
('THE Latam', 2018, 'Universidad del Bio-Bio', 28.0),  -- calculado, banda 12.9-30.7
('THE Latam', 2018, 'Universidad del Desarrollo', 45.6),  -- calculado, banda 45.4-48.9
('THE Latam', 2019, 'Pontificia Universidad Catolica de Chile', 88.6),
('THE Latam', 2019, 'Pontificia Universidad Catolica de Valparaiso', 67.6),
('THE Latam', 2019, 'Universidad Adolfo Ibanez', 52.4),  -- calculado, banda 49.1-53.0
('THE Latam', 2019, 'Universidad Andres Bello', 41.4),  -- calculado, banda 36.4-41.4
('THE Latam', 2019, 'Universidad Arturo Prat', 19.2),  -- calculado, banda 15.1-33.4
('THE Latam', 2019, 'Universidad Austral de Chile', 49.1),  -- calculado, banda 49.1-53.0
('THE Latam', 2019, 'Universidad Autonoma de Chile', 44.6),  -- calculado, banda 41.8-45.6
('THE Latam', 2019, 'Universidad Bernardo O''Higgins', 17.3),  -- calculado, banda 15.1-33.4
('THE Latam', 2019, 'Universidad Catolica de Temuco', 25.8),  -- calculado, banda 15.1-33.4
('THE Latam', 2019, 'Universidad Catolica de la Santisima Concepcion', 30.3),  -- calculado, banda 15.1-33.4
('THE Latam', 2019, 'Universidad Catolica del Norte', 45.8),  -- calculado, banda 45.7-48.5
('THE Latam', 2019, 'Universidad Diego Portales', 49.5),  -- calculado, banda 49.1-53.0
('THE Latam', 2019, 'Universidad Finis Terrae', 22.8),  -- calculado, banda 15.1-33.4
('THE Latam', 2019, 'Universidad Mayor', 21.8),  -- calculado, banda 15.1-33.4
('THE Latam', 2019, 'Universidad San Sebastian', 26.9),  -- calculado, banda 15.1-33.4
('THE Latam', 2019, 'Universidad Tecnica Federico Santa Maria', 51.9),  -- calculado, banda 49.1-53.0
('THE Latam', 2019, 'Universidad de Antofagasta', 38.9),  -- calculado, banda 36.4-41.4
('THE Latam', 2019, 'Universidad de Atacama', 19.6),  -- calculado, banda 15.1-33.4
('THE Latam', 2019, 'Universidad de Chile', 83.0),
('THE Latam', 2019, 'Universidad de Concepcion', 55.5),
('THE Latam', 2019, 'Universidad de La Serena', 30.3),  -- calculado, banda 15.1-33.4
('THE Latam', 2019, 'Universidad de Los Lagos', 36.4),  -- calculado, banda 36.4-41.4
('THE Latam', 2019, 'Universidad de Santiago de Chile', 67.5),
('THE Latam', 2019, 'Universidad de Talca', 43.6),  -- calculado, banda 41.8-45.6
('THE Latam', 2019, 'Universidad de Tarapaca', 33.2),  -- calculado, banda 15.1-33.4
('THE Latam', 2019, 'Universidad de Valparaiso', 56.8),
('THE Latam', 2019, 'Universidad de la Frontera', 58.5),
('THE Latam', 2019, 'Universidad de los Andes', 54.6),
('THE Latam', 2019, 'Universidad del Bio-Bio', 35.9),  -- calculado, banda 34.1-35.9
('THE Latam', 2019, 'Universidad del Desarrollo', 41.2),  -- calculado, banda 36.4-41.4
('THE Latam', 2020, 'Pontificia Universidad Catolica de Chile', 89.7),
('THE Latam', 2020, 'Pontificia Universidad Catolica de Valparaiso', 67.0),
('THE Latam', 2020, 'Universidad Adolfo Ibanez', 47.6),
('THE Latam', 2020, 'Universidad Andres Bello', 38.1),
('THE Latam', 2020, 'Universidad Arturo Prat', 18.8),  -- calculado, banda 15.1-29.3
('THE Latam', 2020, 'Universidad Austral de Chile', 54.9),
('THE Latam', 2020, 'Universidad Autonoma de Chile', 47.5),
('THE Latam', 2020, 'Universidad Bernardo O''Higgins', 20.8),  -- calculado, banda 15.1-29.3
('THE Latam', 2020, 'Universidad Catolica de Temuco', 23.9),  -- calculado, banda 15.1-29.3
('THE Latam', 2020, 'Universidad Catolica de la Santisima Concepcion', 36.8),
('THE Latam', 2020, 'Universidad Catolica del Norte', 39.5),
('THE Latam', 2020, 'Universidad Diego Portales', 48.8),
('THE Latam', 2020, 'Universidad Finis Terrae', 21.5),  -- calculado, banda 15.1-29.3
('THE Latam', 2020, 'Universidad Mayor', 27.4),  -- calculado, banda 15.1-29.3
('THE Latam', 2020, 'Universidad San Sebastian', 26.8),  -- calculado, banda 15.1-29.3
('THE Latam', 2020, 'Universidad Tecnica Federico Santa Maria', 46.7),
('THE Latam', 2020, 'Universidad de Antofagasta', 39.4),
('THE Latam', 2020, 'Universidad de Chile', 82.0),
('THE Latam', 2020, 'Universidad de Concepcion', 55.0),
('THE Latam', 2020, 'Universidad de La Serena', 33.8),  -- calculado, banda 30.0-36.0
('THE Latam', 2020, 'Universidad de Los Lagos', 35.0),  -- calculado, banda 30.0-36.0
('THE Latam', 2020, 'Universidad de Playa Ancha', 23.9),  -- calculado, banda 15.1-29.3
('THE Latam', 2020, 'Universidad de Santiago de Chile', 65.1),
('THE Latam', 2020, 'Universidad de Talca', 39.7),
('THE Latam', 2020, 'Universidad de Tarapaca', 36.6),
('THE Latam', 2020, 'Universidad de Valparaiso', 51.9),
('THE Latam', 2020, 'Universidad de la Frontera', 55.3),
('THE Latam', 2020, 'Universidad de los Andes', 56.3),
('THE Latam', 2020, 'Universidad del Bio-Bio', 33.0),  -- calculado, banda 30.0-36.0
('THE Latam', 2020, 'Universidad del Desarrollo', 43.6),
('THE Latam', 2021, 'Pontificia Universidad Catolica de Chile', 90.3),
('THE Latam', 2021, 'Pontificia Universidad Catolica de Valparaiso', 65.8),
('THE Latam', 2021, 'Universidad Adolfo Ibanez', 46.8),
('THE Latam', 2021, 'Universidad Andres Bello', 35.3),  -- calculado, banda 31.0-37.1
('THE Latam', 2021, 'Universidad Arturo Prat', 20.5),  -- calculado, banda 14.6-24.7
('THE Latam', 2021, 'Universidad Austral de Chile', 58.8),
('THE Latam', 2021, 'Universidad Autonoma de Chile', 52.4),
('THE Latam', 2021, 'Universidad Bernardo O''Higgins', 23.4),  -- calculado, banda 14.6-24.7
('THE Latam', 2021, 'Universidad Catolica de Temuco', 31.7),  -- calculado, banda 31.0-37.1
('THE Latam', 2021, 'Universidad Catolica de la Santisima Concepcion', 42.1),
('THE Latam', 2021, 'Universidad Catolica del Norte', 38.7),
('THE Latam', 2021, 'Universidad Diego Portales', 51.4),
('THE Latam', 2021, 'Universidad Finis Terrae', 21.8),  -- calculado, banda 14.6-24.7
('THE Latam', 2021, 'Universidad Mayor', 32.0),  -- calculado, banda 31.0-37.1
('THE Latam', 2021, 'Universidad San Sebastian', 26.4),  -- calculado, banda 24.9-30.3
('THE Latam', 2021, 'Universidad Tecnica Federico Santa Maria', 54.3),
('THE Latam', 2021, 'Universidad de Chile', 82.1),
('THE Latam', 2021, 'Universidad de Concepcion', 51.6),
('THE Latam', 2021, 'Universidad de La Serena', 38.0),
('THE Latam', 2021, 'Universidad de Los Lagos', 38.6),
('THE Latam', 2021, 'Universidad de Santiago de Chile', 62.7),
('THE Latam', 2021, 'Universidad de Talca', 46.2),
('THE Latam', 2021, 'Universidad de Tarapaca', 37.1),  -- calculado, banda 31.0-37.1
('THE Latam', 2021, 'Universidad de Valparaiso', 47.9),
('THE Latam', 2021, 'Universidad de la Frontera', 50.9),
('THE Latam', 2021, 'Universidad de los Andes', 54.0),
('THE Latam', 2021, 'Universidad del Bio-Bio', 29.2),  -- calculado, banda 24.9-30.3
('THE Latam', 2021, 'Universidad del Desarrollo', 46.5),
('THE Latam', 2022, 'Pontificia Universidad Catolica de Chile', 90.5),
('THE Latam', 2022, 'Pontificia Universidad Catolica de Valparaiso', 62.0),
('THE Latam', 2022, 'Universidad Adolfo Ibanez', 51.7),
('THE Latam', 2022, 'Universidad Andres Bello', 45.0),
('THE Latam', 2022, 'Universidad Arturo Prat', 24.0),  -- calculado, banda 16.1-28.7
('THE Latam', 2022, 'Universidad Austral de Chile', 64.7),
('THE Latam', 2022, 'Universidad Autonoma de Chile', 52.2),
('THE Latam', 2022, 'Universidad Bernardo O''Higgins', 25.1),  -- calculado, banda 16.1-28.7
('THE Latam', 2022, 'Universidad Catolica de Temuco', 31.9),  -- calculado, banda 28.8-34.1
('THE Latam', 2022, 'Universidad Catolica de la Santisima Concepcion', 42.5),
('THE Latam', 2022, 'Universidad Catolica del Norte', 50.9),
('THE Latam', 2022, 'Universidad Diego Portales', 53.6),
('THE Latam', 2022, 'Universidad Finis Terrae', 27.2),  -- calculado, banda 16.1-28.7
('THE Latam', 2022, 'Universidad Mayor', 34.2),  -- calculado, banda 34.2-39.9
('THE Latam', 2022, 'Universidad San Sebastian', 30.4),  -- calculado, banda 28.8-34.1
('THE Latam', 2022, 'Universidad Santo Tomas', 20.0),  -- calculado, banda 16.1-28.7
('THE Latam', 2022, 'Universidad Tecnica Federico Santa Maria', 56.9),
('THE Latam', 2022, 'Universidad de Antofagasta', 44.0),
('THE Latam', 2022, 'Universidad de Chile', 83.7),
('THE Latam', 2022, 'Universidad de Concepcion', 65.9),
('THE Latam', 2022, 'Universidad de La Serena', 36.9),  -- calculado, banda 34.2-39.9
('THE Latam', 2022, 'Universidad de Los Lagos', 44.6),
('THE Latam', 2022, 'Universidad de Santiago de Chile', 63.1),
('THE Latam', 2022, 'Universidad de Talca', 48.9),
('THE Latam', 2022, 'Universidad de Tarapaca', 45.6),
('THE Latam', 2022, 'Universidad de Valparaiso', 47.7),
('THE Latam', 2022, 'Universidad de la Frontera', 51.1),
('THE Latam', 2022, 'Universidad de los Andes', 54.9),
('THE Latam', 2022, 'Universidad del Bio-Bio', 28.2),  -- calculado, banda 16.1-28.7
('THE Latam', 2022, 'Universidad del Desarrollo', 50.4),
('THE Latam', 2023, 'Pontificia Universidad Catolica de Chile', 90.3),
('THE Latam', 2023, 'Pontificia Universidad Catolica de Valparaiso', 59.0),
('THE Latam', 2023, 'Universidad Adolfo Ibanez', 53.3),
('THE Latam', 2023, 'Universidad Andres Bello', 47.3),
('THE Latam', 2023, 'Universidad Arturo Prat', 25.7),  -- calculado, banda 16.1-29.3
('THE Latam', 2023, 'Universidad Austral de Chile', 58.5),
('THE Latam', 2023, 'Universidad Autonoma de Chile', 54.2),
('THE Latam', 2023, 'Universidad Bernardo O''Higgins', 29.1),  -- calculado, banda 16.1-29.3
('THE Latam', 2023, 'Universidad Catolica de Temuco', 27.8),  -- calculado, banda 16.1-29.3
('THE Latam', 2023, 'Universidad Catolica de la Santisima Concepcion', 41.8),
('THE Latam', 2023, 'Universidad Catolica del Maule', 36.1),  -- calculado, banda 34.0-39.9
('THE Latam', 2023, 'Universidad Catolica del Norte', 47.5),
('THE Latam', 2023, 'Universidad Diego Portales', 51.8),
('THE Latam', 2023, 'Universidad Finis Terrae', 35.4),  -- calculado, banda 34.0-39.9
('THE Latam', 2023, 'Universidad Mayor', 35.0),  -- calculado, banda 34.0-39.9
('THE Latam', 2023, 'Universidad San Sebastian', 26.1),  -- calculado, banda 16.1-29.3
('THE Latam', 2023, 'Universidad Santo Tomas', 23.0),  -- calculado, banda 16.1-29.3
('THE Latam', 2023, 'Universidad Tecnica Federico Santa Maria', 50.7),
('THE Latam', 2023, 'Universidad de Antofagasta', 42.7),
('THE Latam', 2023, 'Universidad de Chile', 81.6),
('THE Latam', 2023, 'Universidad de Concepcion', 66.8),
('THE Latam', 2023, 'Universidad de La Serena', 41.4),
('THE Latam', 2023, 'Universidad de Los Lagos', 40.9),
('THE Latam', 2023, 'Universidad de Magallanes', 46.3),
('THE Latam', 2023, 'Universidad de Santiago de Chile', 61.2),
('THE Latam', 2023, 'Universidad de Talca', 44.9),
('THE Latam', 2023, 'Universidad de Tarapaca', 54.2),
('THE Latam', 2023, 'Universidad de Valparaiso', 44.5),
('THE Latam', 2023, 'Universidad de la Frontera', 51.6),
('THE Latam', 2023, 'Universidad de los Andes', 59.4),
('THE Latam', 2023, 'Universidad del Bio-Bio', 36.1),  -- calculado, banda 34.0-39.9
('THE Latam', 2023, 'Universidad del Desarrollo', 49.5),
('THE Latam', 2024, 'Pontificia Universidad Catolica de Chile', 82.5),
('THE Latam', 2024, 'Pontificia Universidad Catolica de Valparaiso', 53.3),
('THE Latam', 2024, 'Universidad Adolfo Ibanez', 48.4),
('THE Latam', 2024, 'Universidad Alberto Hurtado', 38.9),
('THE Latam', 2024, 'Universidad Andres Bello', 41.7),
('THE Latam', 2024, 'Universidad Arturo Prat', 22.8),  -- calculado, banda 13.2-24.5
('THE Latam', 2024, 'Universidad Austral de Chile', 46.1),
('THE Latam', 2024, 'Universidad Autonoma de Chile', 48.0),
('THE Latam', 2024, 'Universidad Bernardo O''Higgins', 23.8),  -- calculado, banda 13.2-24.5
('THE Latam', 2024, 'Universidad Catolica de Temuco', 26.2),  -- calculado, banda 24.7-29.1
('THE Latam', 2024, 'Universidad Catolica de la Santisima Concepcion', 44.8),
('THE Latam', 2024, 'Universidad Catolica del Maule', 36.7),
('THE Latam', 2024, 'Universidad Catolica del Norte', 38.5),
('THE Latam', 2024, 'Universidad Diego Portales', 38.2),
('THE Latam', 2024, 'Universidad Finis Terrae', 22.1),  -- calculado, banda 13.2-24.5
('THE Latam', 2024, 'Universidad Mayor', 24.3),  -- calculado, banda 13.2-24.5
('THE Latam', 2024, 'Universidad Santo Tomas', 20.6),  -- calculado, banda 13.2-24.5
('THE Latam', 2024, 'Universidad Tecnica Federico Santa Maria', 45.0),
('THE Latam', 2024, 'Universidad de Antofagasta', 29.1),  -- calculado, banda 24.7-29.1
('THE Latam', 2024, 'Universidad de Chile', 77.0),
('THE Latam', 2024, 'Universidad de Concepcion', 57.3),
('THE Latam', 2024, 'Universidad de La Serena', 26.7),  -- calculado, banda 24.7-29.1
('THE Latam', 2024, 'Universidad de Los Lagos', 34.3),  -- calculado, banda 29.3-35.3
('THE Latam', 2024, 'Universidad de Magallanes', 26.8),  -- calculado, banda 24.7-29.1
('THE Latam', 2024, 'Universidad de Santiago de Chile', 58.2),
('THE Latam', 2024, 'Universidad de Talca', 40.3),
('THE Latam', 2024, 'Universidad de Tarapaca', 41.9),
('THE Latam', 2024, 'Universidad de Valparaiso', 38.3),
('THE Latam', 2024, 'Universidad de la Frontera', 42.8),
('THE Latam', 2024, 'Universidad de los Andes', 57.7),
('THE Latam', 2024, 'Universidad del Bio-Bio', 33.5),  -- calculado, banda 29.3-35.3
('THE Latam', 2024, 'Universidad del Desarrollo', 38.1),
('THE Latam', 2026, 'Pontificia Universidad Catolica de Chile', 50.0),
('THE Latam', 2026, 'Pontificia Universidad Catolica de Valparaiso', 29.6),
('THE Latam', 2026, 'Universidad Adolfo Ibanez', 30.8),
('THE Latam', 2026, 'Universidad Alberto Hurtado', 24.4),
('THE Latam', 2026, 'Universidad Andres Bello', 24.3),
('THE Latam', 2026, 'Universidad Arturo Prat', 18.1),  -- calculado, banda 18.1-20.6
('THE Latam', 2026, 'Universidad Austral de Chile', 26.8),
('THE Latam', 2026, 'Universidad Autonoma de Chile', 23.3),
('THE Latam', 2026, 'Universidad Bernardo O''Higgins', 17.4),  -- calculado, banda 17.3-18.0
('THE Latam', 2026, 'Universidad Catolica de Temuco', 20.6),  -- calculado, banda 18.1-20.6
('THE Latam', 2026, 'Universidad Catolica de la Santisima Concepcion', 23.9),
('THE Latam', 2026, 'Universidad Catolica del Maule', 25.3),
('THE Latam', 2026, 'Universidad Catolica del Norte', 25.8),
('THE Latam', 2026, 'Universidad Diego Portales', 25.5),
('THE Latam', 2026, 'Universidad Finis Terrae', 19.4),  -- calculado, banda 18.1-20.6
('THE Latam', 2026, 'Universidad Mayor', 19.7),  -- calculado, banda 18.1-20.6
('THE Latam', 2026, 'Universidad Santo Tomas', 17.6),  -- calculado, banda 17.3-18.0
('THE Latam', 2026, 'Universidad Tecnica Federico Santa Maria', 26.5),
('THE Latam', 2026, 'Universidad de Antofagasta', 21.6),
('THE Latam', 2026, 'Universidad de Chile', 38.4),
('THE Latam', 2026, 'Universidad de Concepcion', 28.3),
('THE Latam', 2026, 'Universidad de La Serena', 23.2),
('THE Latam', 2026, 'Universidad de Los Lagos', 22.8),
('THE Latam', 2026, 'Universidad de Santiago de Chile', 27.0),
('THE Latam', 2026, 'Universidad de Talca', 26.4),
('THE Latam', 2026, 'Universidad de Tarapaca', 34.0),
('THE Latam', 2026, 'Universidad de Valparaiso', 22.6),
('THE Latam', 2026, 'Universidad de la Frontera', 27.8),
('THE Latam', 2026, 'Universidad de los Andes', 28.8),
('THE Latam', 2026, 'Universidad del Bio-Bio', 18.0),  -- calculado, banda 17.3-18.0
('THE Latam', 2026, 'Universidad del Desarrollo', 24.6),
('QS Latam', 2024, 'Pontificia Universidad Catolica de Chile', 99.1),
('QS Latam', 2024, 'Pontificia Universidad Catolica de Valparaiso', 68.8),
('QS Latam', 2024, 'Universidad Adolfo Ibanez', 66.9),
('QS Latam', 2024, 'Universidad Andres Bello', 48.7),
('QS Latam', 2024, 'Universidad Austral de Chile', 60.2),
('QS Latam', 2024, 'Universidad Autonoma de Chile', 33.4),
('QS Latam', 2024, 'Universidad Catolica del Norte', 38.7),
('QS Latam', 2024, 'Universidad Diego Portales', 61.3),
('QS Latam', 2024, 'Universidad Tecnica Federico Santa Maria', 61.9),
('QS Latam', 2024, 'Universidad de Antofagasta', 33.4),
('QS Latam', 2024, 'Universidad de Chile', 94.9),
('QS Latam', 2024, 'Universidad de Concepcion', 84.1),
('QS Latam', 2024, 'Universidad de La Serena', 31.3),
('QS Latam', 2024, 'Universidad de Santiago de Chile', 77.6),
('QS Latam', 2024, 'Universidad de Talca', 51.7),
('QS Latam', 2024, 'Universidad de Tarapaca', 30.9),
('QS Latam', 2024, 'Universidad de Valparaiso', 46.4),
('QS Latam', 2024, 'Universidad de la Frontera', 49.9),
('QS Latam', 2024, 'Universidad de los Andes', 52.6),
('QS Latam', 2024, 'Universidad del Bio-Bio', 39.8),
('QS Latam', 2024, 'Universidad del Desarrollo', 42.6),
('QS Latam', 2025, 'Pontificia Universidad Catolica de Chile', 99.7),
('QS Latam', 2025, 'Pontificia Universidad Catolica de Valparaiso', 74.6),
('QS Latam', 2025, 'Universidad Adolfo Ibanez', 75.5),
('QS Latam', 2025, 'Universidad Alberto Hurtado', 36.9),
('QS Latam', 2025, 'Universidad Andres Bello', 56.2),
('QS Latam', 2025, 'Universidad Austral de Chile', 65.8),
('QS Latam', 2025, 'Universidad Autonoma de Chile', 39.7),
('QS Latam', 2025, 'Universidad Catolica del Norte', 42.3),
('QS Latam', 2025, 'Universidad Diego Portales', 66.1),
('QS Latam', 2025, 'Universidad Tecnica Federico Santa Maria', 64.5),
('QS Latam', 2025, 'Universidad de Antofagasta', 34.4),
('QS Latam', 2025, 'Universidad de Chile', 93.9),
('QS Latam', 2025, 'Universidad de Concepcion', 87.8),
('QS Latam', 2025, 'Universidad de La Serena', 35.9),
('QS Latam', 2025, 'Universidad de Santiago de Chile', 81.9),
('QS Latam', 2025, 'Universidad de Talca', 58.6),
('QS Latam', 2025, 'Universidad de Tarapaca', 37.9),
('QS Latam', 2025, 'Universidad de Valparaiso', 50.2),
('QS Latam', 2025, 'Universidad de la Frontera', 56.3),
('QS Latam', 2025, 'Universidad de los Andes', 60.7),
('QS Latam', 2025, 'Universidad del Bio-Bio', 46.4),
('QS Latam', 2025, 'Universidad del Desarrollo', 48.7),
('QS Latam', 2026, 'Pontificia Universidad Catolica de Chile', 100.0),
('QS Latam', 2026, 'Pontificia Universidad Catolica de Valparaiso', 76.4),
('QS Latam', 2026, 'Universidad Adolfo Ibanez', 77.1),
('QS Latam', 2026, 'Universidad Alberto Hurtado', 38.1),
('QS Latam', 2026, 'Universidad Andres Bello', 58.9),
('QS Latam', 2026, 'Universidad Austral de Chile', 67.2),
('QS Latam', 2026, 'Universidad Autonoma de Chile', 43.3),
('QS Latam', 2026, 'Universidad Catolica del Norte', 43.0),
('QS Latam', 2026, 'Universidad Diego Portales', 64.6),
('QS Latam', 2026, 'Universidad Tecnica Federico Santa Maria', 62.5),
('QS Latam', 2026, 'Universidad de Antofagasta', 36.2),
('QS Latam', 2026, 'Universidad de Chile', 92.5),
('QS Latam', 2026, 'Universidad de Concepcion', 87.1),
('QS Latam', 2026, 'Universidad de La Serena', 36.3),
('QS Latam', 2026, 'Universidad de Santiago de Chile', 81.4),
('QS Latam', 2026, 'Universidad de Talca', 62.0),
('QS Latam', 2026, 'Universidad de Tarapaca', 40.4),
('QS Latam', 2026, 'Universidad de Valparaiso', 50.8),
('QS Latam', 2026, 'Universidad de la Frontera', 60.5),
('QS Latam', 2026, 'Universidad de los Andes', 63.4),
('QS Latam', 2026, 'Universidad del Bio-Bio', 49.5),
('QS Latam', 2026, 'Universidad del Desarrollo', 51.6),
('QS Global', 2024, 'Pontificia Universidad Catolica de Chile', 59.9),
('QS Global', 2024, 'Universidad Adolfo Ibanez', 20.8),
('QS Global', 2024, 'Universidad de Chile', 50.2),
('QS Global', 2024, 'Universidad de Santiago de Chile', 27.2),
('QS Global', 2025, 'Pontificia Universidad Catolica de Chile', 61.5),
('QS Global', 2025, 'Universidad Adolfo Ibanez', 21.4),
('QS Global', 2025, 'Universidad de Chile', 53.7),
('QS Global', 2025, 'Universidad de Santiago de Chile', 26.1),
('QS Global', 2026, 'Pontificia Universidad Catolica de Chile', 66.1),
('QS Global', 2026, 'Universidad Adolfo Ibanez', 29.0),
('QS Global', 2026, 'Universidad de Chile', 59.1),
('QS Global', 2026, 'Universidad de Concepcion', 27.8),
('QS Global', 2026, 'Universidad de Santiago de Chile', 32.7),
('QS Global', 2027, 'Pontificia Universidad Catolica de Chile', 65.6),
('QS Global', 2027, 'Universidad Adolfo Ibanez', 26.8),
('QS Global', 2027, 'Universidad de Chile', 57.1),
('QS Global', 2027, 'Universidad de Concepcion', 26.6),
('QS Global', 2027, 'Universidad de Santiago de Chile', 29.8);

-- En QS Global se reemplaza todo: así desaparecen los ceros y el total corrido de 2026.
DELETE FROM metrica_universidad mu
USING metrica m JOIN ranking r ON r.id_ranking = m.id_ranking
WHERE mu.id_metrica = m.id_metrica AND r.nombre_ranking = 'QS Global' AND m.tipo_metrica = 'Puntaje'
  AND NOT EXISTS (SELECT 1 FROM total_publicado t JOIN universidad u ON u.nombre_universidad = t.universidad
                  WHERE t.ranking = 'QS Global' AND t.anio = mu.anio_metrica
                    AND u.id_universidad = mu.id_universidad);

INSERT INTO metrica_universidad (id_metrica, id_universidad, valor_metrica, anio_metrica)
SELECT m.id_metrica, u.id_universidad, t.valor, t.anio
FROM total_publicado t
JOIN universidad u ON u.nombre_universidad = t.universidad
JOIN ranking r ON r.nombre_ranking = t.ranking
JOIN metrica m ON m.id_ranking = r.id_ranking AND m.tipo_metrica = 'Puntaje' AND m.disciplina = 'General'
ON CONFLICT (id_metrica, id_universidad, anio_metrica)
DO UPDATE SET valor_metrica = EXCLUDED.valor_metrica
WHERE metrica_universidad.valor_metrica IS DISTINCT FROM EXCLUDED.valor_metrica;


-- --------------------------------------------------------- valores calculados

-- Shanghai GRAS: la suma de los indicadores de cada disciplina.
INSERT INTO metrica_universidad (id_metrica, id_universidad, valor_metrica, anio_metrica)
SELECT t.id_metrica, mu.id_universidad, round(sum(mu.valor_metrica), 1), mu.anio_metrica
FROM metrica_universidad mu
JOIN metrica m ON m.id_metrica = mu.id_metrica AND m.pondera
JOIN ranking r ON r.id_ranking = m.id_ranking AND r.nombre_ranking = 'Shanghai GRAS'
JOIN metrica t ON t.id_ranking = m.id_ranking AND t.tipo_metrica = 'Puntaje'
              AND t.disciplina IS NOT DISTINCT FROM m.disciplina
WHERE mu.valor_metrica IS NOT NULL
GROUP BY t.id_metrica, mu.id_universidad, mu.anio_metrica
ON CONFLICT (id_metrica, id_universidad, anio_metrica)
DO UPDATE SET valor_metrica = EXCLUDED.valor_metrica
WHERE metrica_universidad.valor_metrica IS DISTINCT FROM EXCLUDED.valor_metrica;

-- Shanghai ARWU: 100 × suma ponderada / la de la primera del mundo ese año, que
-- no está en la base (solo hay chilenas) y se tomó de la API de ShanghaiRanking.
INSERT INTO metrica_universidad (id_metrica, id_universidad, valor_metrica, anio_metrica)
SELECT t.id_metrica, mu.id_universidad,
       round(100 * sum(mu.valor_metrica * m.peso_metrica / 100.0) / p.suma_primera, 1), mu.anio_metrica
FROM metrica_universidad mu
JOIN metrica m ON m.id_metrica = mu.id_metrica AND m.pondera
JOIN ranking r ON r.id_ranking = m.id_ranking AND r.nombre_ranking = 'Shanghai ARWU'
JOIN metrica t ON t.id_ranking = m.id_ranking AND t.tipo_metrica = 'Puntaje'
JOIN (VALUES
    (2004, 95.92),
    (2005, 97.24),
    (2006, 97.36),
    (2007, 97.3),
    (2008, 97.41),
    (2009, 97.48),
    (2010, 96.92),
    (2011, 97.05),
    (2012, 97.11),
    (2013, 97.25),
    (2014, 97.53),
    (2015, 97.66),
    (2016, 97.92),
    (2017, 97.95),
    (2018, 97.96),
    (2019, 97.82),
    (2020, 97.93),
    (2021, 98.05),
    (2022, 97.79),
    (2023, 97.19),
    (2024, 97.99),
    (2025, 97.05)
) AS p(anio, suma_primera) ON p.anio = mu.anio_metrica
WHERE mu.valor_metrica IS NOT NULL
GROUP BY t.id_metrica, mu.id_universidad, mu.anio_metrica, p.suma_primera
ON CONFLICT (id_metrica, id_universidad, anio_metrica)
DO UPDATE SET valor_metrica = EXCLUDED.valor_metrica
WHERE metrica_universidad.valor_metrica IS DISTINCT FROM EXCLUDED.valor_metrica;

-- Scimago Latam y Ranking KAI: la suma ponderada.
INSERT INTO metrica_universidad (id_metrica, id_universidad, valor_metrica, anio_metrica)
SELECT t.id_metrica, mu.id_universidad, round(sum(mu.valor_metrica * m.peso_metrica / 100.0), 2),
       mu.anio_metrica
FROM metrica_universidad mu
JOIN metrica m ON m.id_metrica = mu.id_metrica AND m.pondera
JOIN ranking r ON r.id_ranking = m.id_ranking AND r.nombre_ranking IN ('Scimago Latam', 'Ranking KAI')
JOIN metrica t ON t.id_ranking = m.id_ranking AND t.tipo_metrica = 'Puntaje'
WHERE mu.valor_metrica IS NOT NULL
GROUP BY t.id_metrica, mu.id_universidad, mu.anio_metrica
ON CONFLICT (id_metrica, id_universidad, anio_metrica)
DO UPDATE SET valor_metrica = EXCLUDED.valor_metrica
WHERE metrica_universidad.valor_metrica IS DISTINCT FROM EXCLUDED.valor_metrica;


-- ------------------------------------------------------------------ verificación

DO $$
DECLARE
    n INTEGER;
    detalle TEXT;
BEGIN
    -- Cada valor de las listas encontró su universidad y su métrica.
    SELECT count(*) INTO n FROM total_publicado t
    WHERE NOT EXISTS (SELECT 1 FROM universidad u WHERE u.nombre_universidad = t.universidad);
    IF n > 0 THEN RAISE EXCEPTION '% totales publicados no encontraron su universidad', n; END IF;
    SELECT count(*) INTO n FROM qs_global_2026 c
    WHERE NOT EXISTS (SELECT 1 FROM metrica_universidad mu
                      JOIN metrica m ON m.id_metrica = mu.id_metrica
                      JOIN ranking r ON r.id_ranking = m.id_ranking AND r.nombre_ranking = 'QS Global'
                      JOIN universidad u ON u.id_universidad = mu.id_universidad
                      WHERE u.nombre_universidad = c.universidad AND m.nombre_metrica = c.metrica
                        AND mu.anio_metrica = 2026 AND mu.valor_metrica IS NOT DISTINCT FROM c.valor);
    IF n > 0 THEN RAISE EXCEPTION '% correcciones de QS Global 2026 no quedaron aplicadas', n; END IF;

    -- Los pilares de THE Latam suman 100.
    SELECT sum(m.peso_metrica) INTO n FROM metrica m JOIN ranking r USING (id_ranking)
    WHERE r.nombre_ranking = 'THE Latam' AND m.pondera;
    IF n <> 100 THEN RAISE EXCEPTION 'Los pilares de THE Latam suman % y no 100', n; END IF;

    -- Cobertura: en los rankings cuyo total existe para todos, ninguna universidad
    -- clasificada se queda sin él.
    SELECT count(*), string_agg(DISTINCT r.nombre_ranking || ' ' || mu.anio_metrica, ', ')
      INTO n, detalle
    FROM metrica_universidad mu
    JOIN metrica m ON m.id_metrica = mu.id_metrica AND m.pondera
    JOIN ranking r ON r.id_ranking = m.id_ranking
    WHERE r.nombre_ranking IN ('THE Latam', 'Scimago Latam', 'Shanghai GRAS', 'Shanghai ARWU', 'Ranking KAI')
      AND NOT (r.nombre_ranking = 'Shanghai ARWU' AND mu.anio_metrica = 2003)
      AND NOT EXISTS (SELECT 1 FROM metrica t
                      JOIN metrica_universidad tu ON tu.id_metrica = t.id_metrica
                      WHERE t.id_ranking = m.id_ranking AND t.tipo_metrica = 'Puntaje'
                        AND t.disciplina IS NOT DISTINCT FROM m.disciplina
                        AND tu.id_universidad = mu.id_universidad AND tu.anio_metrica = mu.anio_metrica);
    IF n > 0 THEN RAISE EXCEPTION '% puntajes sin total en: %', n, detalle; END IF;

    -- Ningún total queda vacío, y ninguno publicado vale 0: un cero de THE o QS
    -- sería un dato faltante con otro nombre. Uno calculado sí puede serlo: la U.
    -- Los Leones tiene percentil 0 en todos los indicadores de Scimago 2022.
    SELECT count(*) INTO n FROM metrica_universidad mu JOIN metrica m USING (id_metrica)
    JOIN ranking r USING (id_ranking)
    WHERE m.tipo_metrica = 'Puntaje'
      AND (mu.valor_metrica IS NULL
           OR (mu.valor_metrica <= 0 AND r.nombre_ranking IN ('THE Latam', 'QS Latam', 'QS Global', 'QS por Disciplina')));
    IF n > 0 THEN RAISE EXCEPTION '% puntajes totales vacíos, o publicados en cero', n; END IF;

    -- Ningún total entra al reparto de pesos.
    SELECT count(*) INTO n FROM metrica WHERE tipo_metrica = 'Puntaje' AND (pondera OR peso_metrica <> 0);
    IF n > 0 THEN RAISE EXCEPTION '% métricas de puntaje total ponderan', n; END IF;

    -- GRAS: la suma de los indicadores. Scimago y KAI: la suma ponderada.
    SELECT count(*) INTO n FROM (
        SELECT t.valor_metrica AS total,
               CASE WHEN r.puntajes_ponderados THEN round(sum(mu.valor_metrica), 1)
                    ELSE round(sum(mu.valor_metrica * m.peso_metrica / 100.0), 2) END AS suma
        FROM metrica_universidad mu
        JOIN metrica m ON m.id_metrica = mu.id_metrica AND m.pondera
        JOIN ranking r ON r.id_ranking = m.id_ranking
        JOIN metrica tm ON tm.id_ranking = m.id_ranking AND tm.tipo_metrica = 'Puntaje'
                       AND tm.disciplina IS NOT DISTINCT FROM m.disciplina
        JOIN metrica_universidad t ON t.id_metrica = tm.id_metrica
                                  AND t.id_universidad = mu.id_universidad AND t.anio_metrica = mu.anio_metrica
        WHERE r.nombre_ranking IN ('Shanghai GRAS', 'Scimago Latam', 'Ranking KAI')
        GROUP BY t.valor_metrica, r.puntajes_ponderados, t.id_metrica, mu.id_universidad, mu.anio_metrica
    ) x WHERE x.total <> x.suma;
    IF n > 0 THEN RAISE EXCEPTION '% totales calculados no coinciden con sus componentes', n; END IF;

    SELECT string_agg(r.nombre_ranking || ': ' || c, ', ' ORDER BY r.id_ranking) INTO detalle
    FROM ranking r
    JOIN LATERAL (SELECT count(*) AS c FROM metrica_universidad mu JOIN metrica m USING (id_metrica)
                  WHERE m.id_ranking = r.id_ranking AND m.tipo_metrica = 'Puntaje') x ON true;
    RAISE NOTICE 'puntajes totales cargados: %', detalle;
END $$;

COMMIT;
