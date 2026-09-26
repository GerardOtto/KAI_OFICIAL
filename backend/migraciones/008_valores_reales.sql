-- 008_valores_reales.sql
--
-- Guarda el valor REAL de cada métrica junto al puntaje normalizado que la
-- plataforma ya tiene, sin tocar ninguno de los dos.
--
-- Por qué una tabla aparte y no una columna en `metrica_universidad`:
--
--   1. La clave primaria de esa tabla es (id_metrica, id_universidad,
--      anio_metrica). En QS, 806 de los valores recalculados caen justo encima
--      de un puntaje ya cargado, así que meterlos ahí exigiría cambiar la clave
--      primaria de una tabla con 15.138 filas.
--
--   2. Y sobre todo: `/ranking-universidades` calcula
--      `SUM(valor_metrica * peso/100)` sobre TODAS las métricas del ranking, sin
--      filtrar por `pondera`. Hoy funciona porque las 17 hojas de THE están
--      vacías. Si entraran valores reales en la misma tabla, el puntaje de la
--      PUCV pasaría de 46 a más de 900.000 —Research income son 16 millones de
--      pesos por académico, multiplicados por su peso de 5,5— y el módulo de
--      ranking daría un orden sin sentido, en silencio.
--
--   Una tabla separada hace que ese error sea imposible por construcción: la
--   consulta del ranking no puede ver lo que no consulta. El "modo numérico" es
--   otra consulta, no un filtro que alguien pueda olvidar.
--
-- Lo que carga esta migración:
--   A. La métrica Scimago «Excellence», que está definida y vacía, con los
--      conteos crudos de su propia fuente. Es del mismo tipo que sus 18
--      hermanas, así que va en `metrica_universidad` como las demás.
--   B. La estructura para los valores reales de THE y QS. Los datos entran
--      después con `tools/recoleccion/cargar_valores_reales.py`, para no pegar
--      siete mil INSERT en un archivo de migración.
--
-- Idempotente: se puede volver a ejecutar sin duplicar nada.

BEGIN;

-- ---------------------------------------------------------------- A
-- Scimago «Excellence»: documentos en el 10 % más citado del mundo.
--
-- No necesita nada nuevo. Es un conteo crudo igual que «Excellence with
-- Leadership» o «Number of Q1 Articles», que ya conviven en esa tabla. Los
-- valores se cargan desde `KAI/Datos reales/scimago/procesado.csv`
-- (variable `docs_top10_scimago`, 340 valores, 57 universidades, 2018-2023)
-- con el guion de carga; aquí solo se deja constancia de que la métrica existe
-- y de cómo se llena.

COMMENT ON TABLE metrica_universidad IS
  'Puntajes normalizados tal como los publica cada ranking. Los valores reales '
  'medidos —razones, conteos, porcentajes— viven en valor_real_universidad. '
  'Excepción: Scimago publica conteos crudos y no puntajes, así que sus '
  'métricas ya son valores reales y se quedan aquí.';


-- ---------------------------------------------------------------- B
-- Los valores reales de THE y QS.

CREATE TABLE IF NOT EXISTS valor_real_universidad (
    id_metrica      INTEGER NOT NULL REFERENCES metrica(id_metrica) ON DELETE CASCADE,
    id_universidad  INTEGER NOT NULL REFERENCES universidad(id_universidad) ON DELETE CASCADE,
    -- El año de la EDICIÓN del ranking, no el de los datos. Así una fila se
    -- alinea con el puntaje de `metrica_universidad` del mismo año. De qué años
    -- salieron los insumos se guarda en `anios_origen`, que no es lo mismo:
    -- la edición 2026 de THE se arma con el SIES 2023 y la bibliometría
    -- 2020-2024.
    anio_edicion    INTEGER NOT NULL,

    valor           DOUBLE PRECISION NOT NULL,
    unidad          TEXT NOT NULL,

    -- Cuánto se parece lo calculado a lo que el ranking mide. De esto depende
    -- la advertencia que ve el usuario, y por eso no puede ser opcional:
    --   directa     misma definición y misma fuente de datos
    --   aproximada  misma definición, universo distinto (OpenAlex por Scopus)
    --   parcial     solo una parte del concepto (ANID por el ingreso total)
    --   estimada    no se midió: sale de la recta de calibración de QS
    calidad         TEXT NOT NULL
                    CHECK (calidad IN ('directa', 'aproximada', 'parcial', 'estimada')),

    formula         TEXT NOT NULL,
    anios_origen    TEXT NOT NULL,
    fuentes         TEXT NOT NULL,

    -- Para los valores estimados: qué recta se usó y cuánto se equivoca.
    -- Vacíos en todo lo que se midió.
    r2              DOUBLE PRECISION,
    error_tipico    DOUBLE PRECISION,

    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (id_metrica, id_universidad, anio_edicion)
);

COMMENT ON TABLE valor_real_universidad IS
  'El valor real detrás del puntaje: la razón, el conteo o el porcentaje que el '
  'ranking normalizó. No se obtiene invirtiendo el puntaje —haría falta la media '
  'y la desviación de una población que los rankings no publican— sino '
  'recalculando la métrica con su fórmula sobre datos oficiales. '
  'Ver docs/estudio-desnormalizacion-rankings.md §4.5.';

COMMENT ON COLUMN valor_real_universidad.calidad IS
  'directa | aproximada | parcial | estimada. Solo «estimada» sale de una recta '
  'de calibración; las otras tres se midieron.';

COMMENT ON COLUMN valor_real_universidad.anio_edicion IS
  'Año de la edición del ranking, para alinear con metrica_universidad. Los años '
  'de los datos que lo alimentan están en anios_origen.';

CREATE INDEX IF NOT EXISTS idx_valor_real_universidad_anio
    ON valor_real_universidad (id_universidad, anio_edicion);

CREATE INDEX IF NOT EXISTS idx_valor_real_metrica
    ON valor_real_universidad (id_metrica, anio_edicion);


-- ---------------------------------------------------------------- C
-- Verificación. La migración se aborta a sí misma si deja el esquema en un
-- estado que rompería algo, en vez de dejar que se descubra en producción.

DO $$
DECLARE
    faltan_columnas INTEGER;
    hay_pk          INTEGER;
BEGIN
    SELECT count(*) INTO faltan_columnas
    FROM (VALUES ('id_metrica'), ('id_universidad'), ('anio_edicion'), ('valor'),
                 ('unidad'), ('calidad'), ('formula'), ('anios_origen'), ('fuentes')) AS c(nombre)
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'valor_real_universidad' AND column_name = c.nombre);

    IF faltan_columnas > 0 THEN
        RAISE EXCEPTION 'valor_real_universidad quedó sin % columnas obligatorias',
                        faltan_columnas;
    END IF;

    SELECT count(*) INTO hay_pk
    FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'valor_real_universidad' AND con.contype = 'p';

    IF hay_pk <> 1 THEN
        RAISE EXCEPTION 'valor_real_universidad necesita exactamente una clave primaria';
    END IF;

    -- La razón de ser de la tabla aparte: metrica_universidad no debe haber
    -- cambiado. Si alguien metió valores reales ahí, el ranking ya está roto.
    PERFORM 1 FROM metrica_universidad mu
    JOIN metrica m ON m.id_metrica = mu.id_metrica
    JOIN ranking r ON r.id_ranking = m.id_ranking
    WHERE r.nombre_ranking = 'THE Latam' AND m.pondera = false
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION
            'Hay valores en las hojas de THE dentro de metrica_universidad. '
            'El cálculo de score_total las sumaría con su peso y el ranking '
            'quedaría sin sentido. Muévelas a valor_real_universidad.';
    END IF;

    RAISE NOTICE 'valor_real_universidad creada y metrica_universidad intacta';
END $$;

COMMIT;
