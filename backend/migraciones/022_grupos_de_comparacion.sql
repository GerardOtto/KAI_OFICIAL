-- 022_grupos_de_comparacion.sql
--
-- Grupos de comparación guardados: un conjunto de universidades con nombre
-- («Regionales», «Mis pares»…), por cuenta, para elegirlo de una vez en
-- Tendencias y en la simulación comparada en vez de buscar cada institución.
--
-- Son de la cuenta y no del navegador: se ven en cualquier equipo. Datos
-- personales: el rol del asistente (019) no tiene permiso sobre la tabla y el
-- guardián de la consulta libre la veta por nombre.
--
-- Idempotente. Requiere la 001 (usuario).

BEGIN;

CREATE TABLE IF NOT EXISTS grupo_comparacion (
    id_grupo      SERIAL PRIMARY KEY,
    id_usuario    INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    nombre        TEXT NOT NULL CHECK (length(btrim(nombre)) BETWEEN 1 AND 60),
    universidades INTEGER[] NOT NULL CHECK (cardinality(universidades) BETWEEN 1 AND 60),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id_usuario, nombre)
);

CREATE INDEX IF NOT EXISTS idx_grupo_comparacion_usuario ON grupo_comparacion (id_usuario);

COMMENT ON TABLE grupo_comparacion IS
  'Grupos de universidades guardados por cada cuenta para Tendencias y la simulación comparada.';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kai_asistente')
       AND has_table_privilege('kai_asistente', 'grupo_comparacion', 'SELECT') THEN
        RAISE EXCEPTION 'kai_asistente no debe poder leer grupo_comparacion';
    END IF;
    RAISE NOTICE 'grupo_comparacion lista';
END $$;

COMMIT;
