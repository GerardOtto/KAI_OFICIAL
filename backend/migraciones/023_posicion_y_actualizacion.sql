-- 023_posicion_y_actualizacion.sql
--
-- Dos datos que la plataforma no tenía y que el cargador de rankings
-- (tools/rankings) ya conoce:
--
--   posicion_oficial  El puesto que publica cada ranking: «22», «=6», «151+»,
--                     «501-600». La plataforma ordenaba por un puntaje y nunca
--                     decía el puesto que la fuente le asignó a la universidad, que
--                     es lo primero que pregunta una autoridad. Se guarda el texto
--                     publicado y, para ordenar y comparar, su rango numérico
--                     (desde, hasta; hasta vacío si es «151+»).
--
--   estado_ranking    La última edición que cada ranking publicó, según la
--                     revisión mensual: detectada en la fuente (THE, ShanghaiRanking)
--                     o esperada por su calendario (QS, SCImago, cuyas páginas no se
--                     pueden consultar de forma automática). Con ella la página
--                     avisa cuando hay una edición publicada que aún no está
--                     cargada.
--
-- Las llena `python tools/rankings/cargar.py --escribir`, desde las instantáneas
-- de datos/rankings y su estado.json. Idempotente.

BEGIN;

CREATE TABLE IF NOT EXISTS posicion_oficial (
    id_ranking     INTEGER NOT NULL REFERENCES ranking(id_ranking) ON DELETE CASCADE,
    disciplina     TEXT NOT NULL DEFAULT 'General',
    id_universidad INTEGER NOT NULL REFERENCES universidad(id_universidad) ON DELETE CASCADE,
    anio           INTEGER NOT NULL,
    posicion       TEXT NOT NULL,
    desde          INTEGER,
    hasta          INTEGER,
    PRIMARY KEY (id_ranking, disciplina, id_universidad, anio),
    CHECK (hasta IS NULL OR desde IS NULL OR hasta >= desde)
);

COMMENT ON TABLE posicion_oficial IS
  'Puesto publicado por cada ranking, tal como lo escribe la fuente, y su rango numérico.';
COMMENT ON COLUMN posicion_oficial.hasta IS
  'Fin del rango publicado; igual a desde si es un puesto exacto y NULL si es abierto («151+»).';

CREATE TABLE IF NOT EXISTS estado_ranking (
    id_ranking       INTEGER PRIMARY KEY REFERENCES ranking(id_ranking) ON DELETE CASCADE,
    ultima_publicada INTEGER,
    como             TEXT CHECK (como IN ('fuente', 'calendario')),
    nota             TEXT,
    actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE estado_ranking IS
  'Última edición publicada de cada ranking según la revisión mensual (tools/rankings/actualizar.py).';

DO $$
BEGIN
    RAISE NOTICE 'posicion_oficial y estado_ranking listas: las llena tools/rankings/cargar.py --escribir';
END $$;

COMMIT;
