-- 009_ranking_kai.sql
--
-- El Ranking KAI: un índice propio, construido solo con datos medidos en fuentes
-- oficiales chilenas y bibliométricas abiertas, con pesos que el usuario puede
-- cambiar en la misma pantalla del ranking.
--
-- Requiere la 008 (valor_real_universidad).
--
-- Cómo se acomoda a lo que ya existe, que es lo delicado de esta migración:
--
--   * Las diez métricas son planas: todas `pondera = true`, sin pilares. La
--     batería de pesos exige que ninguna métrica de referencia tenga
--     observaciones, y `/ranking-resumen` suma todo lo que tenga valor.
--
--   * En `metrica_universidad` se guarda un PUNTAJE de 0 a 100, igual que en los
--     demás rankings, para que ranking, tendencias, simulación, glosario y
--     asistente funcionen sin cambios. El valor medido —la razón, el porcentaje,
--     los pesos por académico— va en `valor_real_universidad`, con la misma
--     clave. Mezclar ambos en una tabla es exactamente el error que la 008 evita.
--
--   * El puntaje es un percentil: la proporción de las demás universidades
--     elegibles de ese año a las que supera. 100 es la mejor, 0 la peor. Se eligió
--     frente a la normalización por máximo —que la Universidad del Mar, con nueve
--     documentos, rompería en impacto— y frente a la normal ajustada de THE, que
--     comprime a casi todas en las variables muy sesgadas, como los fondos. Y se
--     explica en una frase: «supera al 80 % de las universidades chilenas».
--
--   * Toda universidad elegible tiene las diez métricas cada año. El ranking
--     trata un hueco como cero; un índice con huecos castigaría la falta de un
--     dato como si fuera un mal desempeño.
--
-- Los datos no van en este archivo: los calcula y carga
-- `tools/recoleccion/cargar_ranking_kai.py`, que es la única fuente de las
-- fórmulas. Aquí solo quedan el esquema y la definición de cada métrica.
--
-- Idempotente.

BEGIN;

DO $$
BEGIN
    IF to_regclass('public.valor_real_universidad') IS NULL THEN
        RAISE EXCEPTION 'La 009 necesita la 008 (valor_real_universidad). Aplica antes 008_valores_reales.sql.';
    END IF;
END $$;


-- ------------------------------------------------------------------ esquema

-- Qué rankings dejan que el usuario cambie los pesos. THE, QS y los demás
-- publican los suyos y cambiarlos daría un ranking que no existe con su nombre;
-- el Ranking KAI es de KAI y sus pesos son una opinión que el usuario puede
-- reemplazar por la suya. Es una columna y no un nombre escrito en el código
-- para que la interfaz no tenga que saber cómo se llama.
ALTER TABLE ranking
    ADD COLUMN IF NOT EXISTS pesos_editables BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN ranking.pesos_editables IS
  'Verdadero si la interfaz deja al usuario reponderar las métricas. Solo en '
  'rankings propios de KAI: los externos publican sus pesos.';

-- Hacia dónde es mejor el valor medido. Los puntajes de metrica_universidad ya
-- vienen orientados —más es mejor—, pero el valor real no: menos estudiantes por
-- académico es mejor. Quien muestre el valor medido necesita saberlo.
ALTER TABLE metrica
    ADD COLUMN IF NOT EXISTS sentido TEXT
        CONSTRAINT metrica_sentido_check CHECK (sentido IN ('mayor', 'menor'));

COMMENT ON COLUMN metrica.sentido IS
  'mayor | menor: si un valor real más alto es mejor o peor. Nulo en las '
  'métricas que solo tienen puntaje.';


-- ------------------------------------------------------------------ ranking

-- Las secuencias de `ranking` y `metrica` están atrasadas: los datos originales
-- se cargaron con identificadores explícitos y la secuencia nunca avanzó. El
-- primer INSERT sin id choca con la clave primaria. Se ponen al día antes de
-- insertar; en una base donde ya estén bien, no cambia nada.
SELECT setval(pg_get_serial_sequence('ranking', 'id_ranking'),
              (SELECT COALESCE(max(id_ranking), 1) FROM ranking));
SELECT setval(pg_get_serial_sequence('metrica', 'id_metrica'),
              (SELECT COALESCE(max(id_metrica), 1) FROM metrica));

INSERT INTO ranking (nombre_ranking)
SELECT 'Ranking KAI'
WHERE NOT EXISTS (SELECT 1 FROM ranking WHERE nombre_ranking = 'Ranking KAI');

UPDATE ranking SET
    nivel_ranking = 'Nacional',
    categoria_ranking = 'Gestión institucional',
    pais_ranking = 'Chile',
    pesos_editables = true,
    descripcion_ranking =
        'Índice propio de KAI, construido solo con datos medidos en fuentes '
        'oficiales: el SIES del Ministerio de Educación, la ANID y OpenAlex. Diez '
        'métricas con el mismo peso, que puedes cambiar para ordenar las '
        'universidades según tus propios criterios. No incluye encuestas de '
        'reputación: todas sus variables dependen de decisiones de la institución.',
    metodologia_ranking =
        'Diez métricas en cinco dimensiones: cuerpo académico (estudiantes por '
        'académico, académicos con doctorado), formación avanzada (doctorados '
        'otorgados, matrícula de posgrado), investigación (productividad, citas '
        'por publicación), financiamiento (fondos ANID, fondos con la industria) e '
        'internacionalización (colaboración internacional, académicos '
        'extranjeros). Cada una se mide con su fórmula y se convierte en un '
        'percentil: la proporción de las demás universidades elegibles de ese año '
        'a las que supera, de 0 a 100. El puntaje del ranking es el promedio '
        'ponderado de los diez percentiles; por defecto todos pesan 10 %. Los '
        'académicos se cuentan en jornadas completas equivalentes (JCE), porque el '
        'recuento de personas no es comparable entre universidades. La bibliometría '
        'usa la ventana de cinco años que termina en el año del ranking. Los flujos '
        '—fondos adjudicados y doctorados otorgados— se promedian en los tres '
        'últimos años, para que un centro plurianual adjudicado de una vez o una '
        'cohorte que se titula junta no produzcan un salto que no existió. '
        'Son elegibles las universidades con datos del SIES en el año, al menos '
        '1.000 estudiantes y 20 académicos JCE.'
WHERE nombre_ranking = 'Ranking KAI';


-- ------------------------------------------------------------------ métricas

-- Las definiciones se escriben una sola vez, en una tabla temporal, y de ahí se
-- insertan las que faltan y se actualizan las que ya estaban.
CREATE TEMP TABLE kai_definiciones (nombre, tipo, sentido, descripcion)
ON COMMIT DROP AS VALUES
    ('Estudiantes por académico', 'Alumnado', 'menor',
     'Estudiantes matriculados por cada académico en jornada completa equivalente. '
     'Menos es mejor. Fuente: SIES, matrícula y personal académico.'),
    ('Académicos con doctorado', 'Academicos', 'mayor',
     'Porcentaje de las jornadas académicas desempeñadas por doctores. '
     'Fuente: SIES, personal académico.'),
    ('Doctorados otorgados', 'Academicos', 'mayor',
     'Graduados de doctorado por cada 100 académicos JCE, promedio anual de los '
     'tres últimos años: una cohorte que se titula de una vez no debe hacer saltar '
     'a una universidad pequeña al primer lugar. Fuente: SIES, titulados.'),
    ('Matrícula de posgrado', 'Alumnado', 'mayor',
     'Porcentaje de la matrícula total que cursa magíster o doctorado. '
     'Fuente: SIES, matrícula.'),
    ('Productividad científica', 'Articulos', 'mayor',
     'Publicaciones por académico JCE al año, promedio de la ventana de cinco años '
     'que termina en el año del ranking. Fuente: OpenAlex y SIES.'),
    ('Citas por publicación', 'Articulos', 'mayor',
     'Citas recibidas por cada publicación de la ventana de cinco años. No corrige '
     'por disciplina: favorece a las áreas que citan más. Fuente: OpenAlex.'),
    ('Colaboración internacional', 'Internacional', 'mayor',
     'Porcentaje de las publicaciones de la ventana firmadas con instituciones de '
     'otro país. Fuente: OpenAlex.'),
    ('Fondos de investigación', 'Financiero', 'mayor',
     'Montos adjudicados por la ANID por académico JCE, promedio anual de los tres '
     'últimos años. Fuente: ANID y SIES.'),
    ('Fondos con la industria', 'Financiero', 'mayor',
     'Montos ANID de proyectos con aporte de empresas, por académico JCE, promedio '
     'anual de los tres últimos años. Fuente: ANID y SIES.'),
    ('Académicos extranjeros', 'Internacional', 'mayor',
     'Porcentaje de las jornadas académicas desempeñadas por extranjeros. '
     'Fuente: SIES, personal académico.');

INSERT INTO metrica (id_ranking, nombre_metrica, descripcion_metrica, tipo_metrica,
                     peso_metrica, disciplina, pondera, sentido)
SELECT r.id_ranking, d.nombre, d.descripcion, d.tipo, 10, 'General', true, d.sentido
FROM ranking r CROSS JOIN kai_definiciones d
WHERE r.nombre_ranking = 'Ranking KAI'
  AND NOT EXISTS (
    SELECT 1 FROM metrica m
    WHERE m.id_ranking = r.id_ranking AND m.nombre_metrica = d.nombre);

-- Una segunda ejecución con definiciones corregidas las actualiza, sin tocar
-- los pesos: esos los decide quien administre el ranking desde la base.
UPDATE metrica m SET
    descripcion_metrica = d.descripcion,
    tipo_metrica = d.tipo,
    sentido = d.sentido,
    disciplina = 'General',
    pondera = true,
    id_metrica_padre = NULL
FROM ranking r, kai_definiciones d
WHERE r.nombre_ranking = 'Ranking KAI'
  AND m.id_ranking = r.id_ranking
  AND m.nombre_metrica = d.nombre;


-- ------------------------------------------------------------------ verificación

DO $$
DECLARE
    n_metricas  INTEGER;
    suma_pesos  NUMERIC;
    pesos       INTEGER;
    sin_sentido INTEGER;
    editable    BOOLEAN;
BEGIN
    SELECT count(*), sum(m.peso_metrica), count(DISTINCT m.peso_metrica),
           count(*) FILTER (WHERE m.sentido IS NULL)
      INTO n_metricas, suma_pesos, pesos, sin_sentido
    FROM metrica m JOIN ranking r ON r.id_ranking = m.id_ranking
    WHERE r.nombre_ranking = 'Ranking KAI';

    SELECT pesos_editables INTO editable FROM ranking WHERE nombre_ranking = 'Ranking KAI';

    IF n_metricas <> 10 THEN
        RAISE EXCEPTION 'El Ranking KAI debe tener 10 métricas y tiene %', n_metricas;
    END IF;
    IF suma_pesos <> 100 THEN
        RAISE EXCEPTION 'Los pesos del Ranking KAI deben sumar 100 y suman %', suma_pesos;
    END IF;
    IF pesos <> 1 THEN
        RAISE EXCEPTION 'Los pesos por defecto del Ranking KAI deben ser parejos';
    END IF;
    IF sin_sentido > 0 THEN
        RAISE EXCEPTION '% métricas del Ranking KAI no declaran su sentido', sin_sentido;
    END IF;
    IF NOT editable THEN
        RAISE EXCEPTION 'El Ranking KAI debe permitir editar los pesos';
    END IF;

    PERFORM 1 FROM metrica m JOIN ranking r ON r.id_ranking = m.id_ranking
    WHERE r.nombre_ranking = 'Ranking KAI' AND NOT m.pondera;
    IF FOUND THEN
        RAISE EXCEPTION 'Todas las métricas del Ranking KAI deben ponderar';
    END IF;

    RAISE NOTICE 'Ranking KAI definido: 10 métricas, pesos parejos que suman 100';
END $$;

COMMIT;
