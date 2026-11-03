-- 018_catalogo_de_universidades.sql
--
-- Dos correcciones al catálogo de universidades, las que propuso la auditoría
-- de la recolección (docs/hallazgos-recoleccion.md, hallazgo 5). Importan porque
-- el registro obliga a elegir la institución de este catálogo: lo que esté mal
-- aquí lo ve cada persona que se registra.
--
--   1. UNIACC estaba dos veces. «Universidad de Artes, Ciencias y Comunicacion»
--      (la del nombre largo, con los datos de Scimago) y «Universidad UNIACC»
--      (la de QS, el Ranking KAI, el SIES y los dominios de correo) son la misma
--      institución. Se conserva «Universidad UNIACC», que es el nombre con que la
--      registra el SIES y al que ya apuntan sus dominios (migración 013), y se le
--      traspasan las filas de la otra. Las dos no comparten ninguna clave —ningún
--      ranking las medía a ambas en la misma métrica y año—, así que no hay cifra
--      que elegir: se juntan. Si alguna vez chocaran, la migración se niega en vez
--      de descartar una en silencio.
--
--   2. Faltaban la Universidad de O'Higgins y la Universidad de Aysén, las dos
--      estatales creadas por ley en 2015. Sin ellas, nadie de esas instituciones
--      podía registrarse. Entran sin datos: se cargan con la recolección, cuyo
--      archivo de nombres (tools/recoleccion/nombres_universidades.csv) ya las
--      reconoce. Sus dominios de correo no se agregan aquí: la 013 verificó cada
--      dominio contra sus registros MX y el sitio de la universidad, y estos aún
--      no se verifican.
--
-- Los nombres van sin tildes, como el resto del catálogo; la interfaz los
-- muestra con ellas (frontend/kai-project/src/utils/universidades.js).
--
-- Solo datos, sin cambios de esquema. El backend no depende de ella: se puede
-- aplicar antes o después de desplegar. Idempotente.

BEGIN;

DO $$
DECLARE
    larga      CONSTANT TEXT := 'Universidad de Artes, Ciencias y Comunicacion';
    corta      CONSTANT TEXT := 'Universidad UNIACC';
    id_larga   INTEGER;
    id_corta   INTEGER;
    choques    INTEGER;
    filas_mu   BIGINT;
    filas_vr   BIGINT;
    cuentas    INTEGER;
BEGIN
    SELECT id_universidad INTO id_larga FROM universidad WHERE nombre_universidad = larga;
    SELECT id_universidad INTO id_corta FROM universidad WHERE nombre_universidad = corta;

    IF id_larga IS NULL THEN
        RAISE NOTICE 'UNIACC ya figura una sola vez: no se fusiona nada.';
        RETURN;
    END IF;
    IF id_corta IS NULL THEN
        -- Sin la fila corta basta con renombrar la larga.
        UPDATE universidad SET nombre_universidad = corta WHERE id_universidad = id_larga;
        UPDATE usuario SET institucion_usuario = corta WHERE institucion_usuario = larga;
        RAISE NOTICE 'UNIACC renombrada a «%».', corta;
        RETURN;
    END IF;

    SELECT (SELECT count(*) FROM metrica_universidad a JOIN metrica_universidad b
              ON b.id_metrica = a.id_metrica AND b.anio_metrica = a.anio_metrica
            WHERE a.id_universidad = id_larga AND b.id_universidad = id_corta)
         + (SELECT count(*) FROM valor_real_universidad a JOIN valor_real_universidad b
              ON b.id_metrica = a.id_metrica AND b.anio_edicion = a.anio_edicion
            WHERE a.id_universidad = id_larga AND b.id_universidad = id_corta)
      INTO choques;
    IF choques > 0 THEN
        RAISE EXCEPTION 'Las dos filas de UNIACC tienen % valores con la misma clave: hay que decidir cuál vale antes de fusionarlas.', choques;
    END IF;

    -- Cuántas filas hay antes de mover, para comprobar al final que no se pierde
    -- ninguna: borrar la universidad antes de tiempo las arrastraría en cascada.
    SELECT count(*) INTO filas_mu FROM metrica_universidad;
    SELECT count(*) INTO filas_vr FROM valor_real_universidad;

    UPDATE metrica_universidad    SET id_universidad = id_corta WHERE id_universidad = id_larga;
    UPDATE valor_real_universidad SET id_universidad = id_corta WHERE id_universidad = id_larga;
    UPDATE cientifico             SET id_universidad = id_corta WHERE id_universidad = id_larga;
    UPDATE dominio_institucion    SET id_universidad = id_corta WHERE id_universidad = id_larga;
    -- La institución de una cuenta se guarda por nombre, no por identificador.
    UPDATE usuario SET institucion_usuario = corta WHERE institucion_usuario = larga;
    GET DIAGNOSTICS cuentas = ROW_COUNT;

    DELETE FROM universidad WHERE id_universidad = id_larga;

    IF (SELECT count(*) FROM metrica_universidad) <> filas_mu
       OR (SELECT count(*) FROM valor_real_universidad) <> filas_vr THEN
        RAISE EXCEPTION 'La fusión de UNIACC perdió filas de puntajes o de cifras.';
    END IF;

    RAISE NOTICE 'UNIACC fusionada en «%» (id %); % cuentas cambiaron de nombre de institución.',
        corta, id_corta, cuentas;
END $$;


-- Las dos estatales que faltaban. La secuencia se pone al día antes de insertar,
-- por si en esta base quedó atrasada (ver la 009).
SELECT setval(pg_get_serial_sequence('universidad', 'id_universidad'),
              (SELECT COALESCE(max(id_universidad), 1) FROM universidad));

INSERT INTO universidad (nombre_universidad, pais_universidad)
SELECT n.nombre, 'Chile'
FROM (VALUES ('Universidad de O''Higgins'), ('Universidad de Aysen')) AS n(nombre)
WHERE NOT EXISTS (SELECT 1 FROM universidad u WHERE u.nombre_universidad = n.nombre);


-- ------------------------------------------------------------------ verificación

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM universidad WHERE nombre_universidad = 'Universidad de Artes, Ciencias y Comunicacion') THEN
        RAISE EXCEPTION 'UNIACC sigue figurando con su nombre largo';
    END IF;
    IF (SELECT count(*) FROM universidad WHERE nombre_universidad = 'Universidad UNIACC') <> 1 THEN
        RAISE EXCEPTION 'UNIACC debe figurar exactamente una vez';
    END IF;
    IF EXISTS (SELECT 1 FROM usuario WHERE institucion_usuario = 'Universidad de Artes, Ciencias y Comunicacion') THEN
        RAISE EXCEPTION 'Quedan cuentas con el nombre largo de UNIACC';
    END IF;
    IF (SELECT count(*) FROM universidad
         WHERE nombre_universidad IN ('Universidad de O''Higgins', 'Universidad de Aysen')) <> 2 THEN
        RAISE EXCEPTION 'Faltan la Universidad de O''Higgins o la de Aysén';
    END IF;
    IF EXISTS (SELECT 1 FROM dominio_institucion d
                WHERE NOT EXISTS (SELECT 1 FROM universidad u WHERE u.id_universidad = d.id_universidad)) THEN
        RAISE EXCEPTION 'Hay dominios que apuntan a una universidad que ya no existe';
    END IF;
    RAISE NOTICE 'Catálogo: % universidades', (SELECT count(*) FROM universidad);
END $$;

COMMIT;
