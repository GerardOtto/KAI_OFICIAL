-- 017_scimago_por_edicion.sql
--
-- Scimago se guardaba con el año que CIERRA su ventana de publicaciones, no con
-- el de su edición. SCImago Institutions Rankings arma cada edición con los cinco
-- años que terminan dos antes: la edición 2025 usa las publicaciones 2019-2023, y
-- la descarga de la 2026 lo confirma (`year=2026` trae la ventana 2020-2024).
-- Como la base guardaba la ventana 2019-2023 como «2023», la plataforma decía que
-- lo más reciente de Scimago era 2023, cuando es la edición 2025. THE y QS ya
-- seguían la regla correcta: su año es el de la edición.
--
-- Esta migración corre dos años toda la serie de Scimago Latam —2018…2023 pasa a
-- 2020…2025— en las dos tablas que guardan el año:
--
--   metrica_universidad.anio_metrica      los percentiles (modo «Puntajes»)
--   valor_real_universidad.anio_edicion   las cifras (modo «Valores»)
--
-- `valor_real_universidad.anios_origen` no cambia: ya decía la ventana correcta
-- («publicaciones 2019-2023»), y es lo que permite reconocer una fila sin
-- corregir, porque su ventana cierra en el mismo año de su edición. Los
-- percentiles tampoco cambian: se calculan entre las universidades del mismo año,
-- y todas se mueven juntas.
--
-- El año es parte de la clave primaria de las dos tablas y PostgreSQL revisa la
-- unicidad fila por fila: sumar 2 de una vez chocaría con la fila del año que
-- aún no se ha movido (2018 → 2020 mientras 2020 sigue ahí). Por eso se pasa
-- primero por años negativos, que no chocan con ninguno.
--
-- Idempotente: solo corre si alguna cifra de Scimago tiene una ventana que cierra
-- en su propio año de edición. Una segunda ejecución no encuentra ninguna y no
-- mueve nada. Requiere la 011.

BEGIN;

DO $$
DECLARE
    sin_corregir INTEGER;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ranking' AND column_name = 'origen_valores') THEN
        RAISE EXCEPTION 'La 017 necesita la 011. Aplica antes 011_scimago_en_dos_modos.sql.';
    END IF;

    SELECT count(*) INTO sin_corregir
    FROM valor_real_universidad v
    JOIN metrica m ON m.id_metrica = v.id_metrica
    JOIN ranking r ON r.id_ranking = m.id_ranking
    WHERE r.nombre_ranking = 'Scimago Latam'
      AND v.anios_origen = 'publicaciones ' || (v.anio_edicion - 4) || '-' || v.anio_edicion;

    IF sin_corregir = 0 THEN
        RAISE NOTICE 'Scimago ya está guardado por edición: no se mueve nada.';
        RETURN;
    END IF;

    -- Paso 1: a negativo y ya corrido (2018 → -2020). Paso 2: de vuelta a positivo.
    UPDATE metrica_universidad mu SET anio_metrica = -(mu.anio_metrica + 2)
    FROM metrica m JOIN ranking r ON r.id_ranking = m.id_ranking
    WHERE mu.id_metrica = m.id_metrica AND r.nombre_ranking = 'Scimago Latam';
    UPDATE metrica_universidad mu SET anio_metrica = -mu.anio_metrica
    FROM metrica m JOIN ranking r ON r.id_ranking = m.id_ranking
    WHERE mu.id_metrica = m.id_metrica AND r.nombre_ranking = 'Scimago Latam'
      AND mu.anio_metrica < 0;

    UPDATE valor_real_universidad v SET anio_edicion = -(v.anio_edicion + 2), actualizado_en = now()
    FROM metrica m JOIN ranking r ON r.id_ranking = m.id_ranking
    WHERE v.id_metrica = m.id_metrica AND r.nombre_ranking = 'Scimago Latam';
    UPDATE valor_real_universidad v SET anio_edicion = -v.anio_edicion
    FROM metrica m JOIN ranking r ON r.id_ranking = m.id_ranking
    WHERE v.id_metrica = m.id_metrica AND r.nombre_ranking = 'Scimago Latam'
      AND v.anio_edicion < 0;

    RAISE NOTICE 'Scimago corrido dos años: % cifras estaban guardadas con el año de su ventana.', sin_corregir;
END $$;


-- ------------------------------------------------------------------ verificación

DO $$
DECLARE
    mal_ventana  INTEGER;
    sin_pareja   INTEGER;
    negativos    INTEGER;
    ultimo       INTEGER;
BEGIN
    -- Toda cifra de Scimago: ventana de cinco años que cierra dos antes de su edición.
    SELECT count(*) INTO mal_ventana
    FROM valor_real_universidad v
    JOIN metrica m ON m.id_metrica = v.id_metrica
    JOIN ranking r ON r.id_ranking = m.id_ranking
    WHERE r.nombre_ranking = 'Scimago Latam'
      AND v.anios_origen IS DISTINCT FROM
          'publicaciones ' || (v.anio_edicion - 6) || '-' || (v.anio_edicion - 2);
    IF mal_ventana > 0 THEN
        RAISE EXCEPTION '% cifras de Scimago no quedaron con su año de edición', mal_ventana;
    END IF;

    -- Cada percentil sigue junto a su cifra: las dos tablas se movieron igual.
    SELECT count(*) INTO sin_pareja
    FROM metrica_universidad mu
    JOIN metrica m ON m.id_metrica = mu.id_metrica
    JOIN ranking r ON r.id_ranking = m.id_ranking
    WHERE r.nombre_ranking = 'Scimago Latam' AND mu.valor_metrica IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM valor_real_universidad v
                      WHERE v.id_metrica = mu.id_metrica AND v.id_universidad = mu.id_universidad
                        AND v.anio_edicion = mu.anio_metrica);
    IF sin_pareja > 0 THEN
        RAISE EXCEPTION '% percentiles de Scimago quedaron sin su cifra del mismo año', sin_pareja;
    END IF;

    SELECT (SELECT count(*) FROM metrica_universidad WHERE anio_metrica < 0)
         + (SELECT count(*) FROM valor_real_universidad WHERE anio_edicion < 0)
      INTO negativos;
    IF negativos > 0 THEN
        RAISE EXCEPTION 'Quedaron % filas con año negativo', negativos;
    END IF;

    SELECT max(mu.anio_metrica) INTO ultimo
    FROM metrica_universidad mu
    JOIN metrica m ON m.id_metrica = mu.id_metrica
    JOIN ranking r ON r.id_ranking = m.id_ranking
    WHERE r.nombre_ranking = 'Scimago Latam';
    RAISE NOTICE 'Edición más reciente de Scimago Latam: %', ultimo;
END $$;

COMMIT;
