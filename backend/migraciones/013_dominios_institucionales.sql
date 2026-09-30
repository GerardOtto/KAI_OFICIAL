-- Migración: la institución se deduce del correo institucional verificado.
--
-- Hasta ahora la institución la elegía el propio usuario en un selector, también
-- quien entraba con una cuenta @pucv.cl: se le preguntaba algo que su correo ya
-- decía, y la respuesta no acreditaba nada. Desde esta migración, cuando alguien
-- entra con Google —que garantiza que el correo es suyo— y el dominio figura en
-- `dominio_institucion`, la institución se asigna sola y no se puede cambiar. El
-- selector queda para los correos que no identifican institución (Gmail y
-- otros) y para el registro con contraseña, cuyo correo no se verifica.
--
-- Un dominio cubre sus subdominios: `pucv.cl` reconoce `mail.pucv.cl`, y `uc.cl`
-- reconoce `estudiante.uc.cl`. Solo se listan aparte los dominios que no cuelgan
-- del principal (`miuandes.cl`, `uandresbello.edu`, `inacapmail.cl`…).
--
-- Cada dominio se verificó el 29-09-2026 contra sus registros MX y contra el
-- sitio o las páginas de ayuda de la propia universidad. Quedan fuera, a
-- propósito, las universidades cerradas cuyo dominio ya no es suyo: un correo
-- «verificado» en un dominio revendido no acredita afiliación alguna.
--   ARCIS (uarcis.cl redirige a un portal de empleo), Del Pacífico (upacifico.cl
--   es un sitio de cursos), UNICIT (unicit.cl comparte servidor de correo con
--   esos dos), UCINF (cerrada; su sitio no es institucional), Del Mar, La
--   República y Los Leones (sus dominios no reciben correo).
-- «Universidad de Artes, Ciencias y Comunicacion» (id 20) es la misma UNIACC que
-- «Universidad UNIACC»: sus dominios apuntan a esta última, que es el nombre con
-- que la registra el SIES.
--
-- santotomas.cl e inacap.cl los comparten la universidad y el instituto
-- profesional y el centro de formación técnica de cada grupo; el catálogo solo
-- tiene la universidad, y a ella se asignan.
--
-- También fija la institución de las cuentas de Google ya creadas cuyo dominio
-- se reconoce. Idempotente: puede ejecutarse varias veces sin efecto acumulado.
BEGIN;

CREATE TABLE IF NOT EXISTS dominio_institucion (
    dominio        TEXT PRIMARY KEY
                   CHECK (dominio = lower(dominio) AND dominio ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
    id_universidad INT  NOT NULL REFERENCES universidad(id_universidad) ON DELETE CASCADE,
    uso            TEXT NOT NULL CHECK (uso IN ('institucional', 'estudiantes')),
    verificado_en  DATE NOT NULL DEFAULT CURRENT_DATE
);

COMMENT ON TABLE dominio_institucion IS
    'Dominios de correo que acreditan la institución de una cuenta de Google. Cubren sus subdominios.';

CREATE TEMP TABLE dominios_verificados (universidad TEXT, dominio TEXT, uso TEXT) ON COMMIT DROP;
INSERT INTO dominios_verificados VALUES
    ('Pontificia Universidad Catolica de Chile',                'uc.cl',            'institucional'),
    ('Pontificia Universidad Catolica de Valparaiso',           'pucv.cl',          'institucional'),
    ('Universidad Academia de Humanismo Cristiano',             'academia.cl',      'institucional'),
    ('Universidad Adolfo Ibanez',                               'uai.cl',           'institucional'),
    ('Universidad Adventista de Chile',                         'unach.cl',         'institucional'),
    ('Universidad Alberto Hurtado',                             'uahurtado.cl',     'institucional'),
    ('Universidad Andres Bello',                                'unab.cl',          'institucional'),
    ('Universidad Andres Bello',                                'uandresbello.edu', 'estudiantes'),
    ('Universidad Arturo Prat',                                 'unap.cl',          'institucional'),
    ('Universidad Austral de Chile',                            'uach.cl',          'institucional'),
    ('Universidad Autonoma de Chile',                           'uautonoma.cl',     'institucional'),
    ('Universidad Bernardo O''Higgins',                         'ubo.cl',           'institucional'),
    ('Universidad Bolivariana de Chile',                        'ubolivariana.cl',  'institucional'),
    ('Universidad Catolica Cardenal Raul Silva Henriquez',      'ucsh.cl',          'institucional'),
    ('Universidad Catolica Cardenal Raul Silva Henriquez',      'miucsh.cl',        'estudiantes'),
    ('Universidad Catolica de la Santisima Concepcion',         'ucsc.cl',          'institucional'),
    ('Universidad Catolica de Temuco',                          'uct.cl',           'institucional'),
    ('Universidad Catolica del Maule',                          'ucm.cl',           'institucional'),
    ('Universidad Catolica del Norte',                          'ucn.cl',           'institucional'),
    ('Universidad Central de Chile',                            'ucentral.cl',      'institucional'),
    ('Universidad de Antofagasta',                              'uantof.cl',        'institucional'),
    ('Universidad de Antofagasta',                              'ua.cl',            'institucional'),
    ('Universidad UNIACC',                                      'uniacc.cl',        'institucional'),
    ('Universidad UNIACC',                                      'uniacc.edu',       'estudiantes'),
    ('Universidad de Atacama',                                  'uda.cl',           'institucional'),
    ('Universidad de Chile',                                    'uchile.cl',        'institucional'),
    ('Universidad de Concepcion',                               'udec.cl',          'institucional'),
    ('Universidad de la Frontera',                              'ufrontera.cl',     'institucional'),
    ('Universidad de La Serena',                                'userena.cl',       'institucional'),
    ('Universidad de Las Americas',                             'udla.cl',          'institucional'),
    ('Universidad de los Andes',                                'uandes.cl',        'institucional'),
    ('Universidad de los Andes',                                'miuandes.cl',      'estudiantes'),
    ('Universidad de Los Lagos',                                'ulagos.cl',        'institucional'),
    ('Universidad de Magallanes',                               'umag.cl',          'institucional'),
    ('Universidad de Playa Ancha',                              'upla.cl',          'institucional'),
    ('Universidad de Santiago de Chile',                        'usach.cl',         'institucional'),
    ('Universidad de Talca',                                    'utalca.cl',        'institucional'),
    ('Universidad de Tarapaca',                                 'uta.cl',           'institucional'),
    ('Universidad de Valparaiso',                               'uv.cl',            'institucional'),
    ('Universidad de Vina del Mar',                             'uvm.cl',           'institucional'),
    ('Universidad del Bio-Bio',                                 'ubiobio.cl',       'institucional'),
    ('Universidad del Desarrollo',                              'udd.cl',           'institucional'),
    ('Universidad Diego Portales',                              'udp.cl',           'institucional'),
    ('Universidad Finis Terrae',                                'uft.cl',           'institucional'),
    ('Universidad Finis Terrae',                                'uft.edu',          'estudiantes'),
    ('Universidad Gabriela Mistral',                            'ugm.cl',           'institucional'),
    ('Universidad Internacional SEK Chile',                     'usek.cl',          'institucional'),
    ('Universidad Mayor',                                       'umayor.cl',        'institucional'),
    ('Universidad Mayor',                                       'mayor.cl',         'estudiantes'),
    ('Universidad Metropolitana de Ciencias de la Educacion',   'umce.cl',          'institucional'),
    ('Universidad Miguel de Cervantes',                         'umcervantes.cl',   'institucional'),
    -- Desde 2021 se llama Universidad del Alba; el personal conserva @upv.cl.
    ('Universidad Pedro de Valdivia',                           'udalba.cl',        'institucional'),
    ('Universidad Pedro de Valdivia',                           'upv.cl',           'institucional'),
    ('Universidad San Sebastian',                               'uss.cl',           'institucional'),
    ('Universidad Santo Tomas',                                 'santotomas.cl',    'institucional'),
    ('Universidad Tecnica Federico Santa Maria',                'usm.cl',           'institucional'),
    ('Universidad Tecnica Federico Santa Maria',                'utfsm.cl',         'institucional'),
    ('Universidad Tecnologica de Chile',                        'inacap.cl',        'institucional'),
    ('Universidad Tecnologica de Chile',                        'inacapmail.cl',    'estudiantes'),
    ('Universidad Tecnologica Metropolitana',                   'utem.cl',          'institucional');

DO $$
DECLARE
    sin_universidad TEXT;
BEGIN
    SELECT string_agg(d.universidad, ', ') INTO sin_universidad
      FROM dominios_verificados d
      LEFT JOIN universidad u ON u.nombre_universidad = d.universidad
     WHERE u.id_universidad IS NULL;
    IF sin_universidad IS NOT NULL THEN
        RAISE EXCEPTION 'Universidades que no están en el catálogo: %', sin_universidad;
    END IF;
END $$;

INSERT INTO dominio_institucion (dominio, id_universidad, uso, verificado_en)
SELECT d.dominio, u.id_universidad, d.uso, DATE '2026-09-29'
  FROM dominios_verificados d
  JOIN universidad u ON u.nombre_universidad = d.universidad
ON CONFLICT (dominio) DO UPDATE
   SET id_universidad = EXCLUDED.id_universidad,
       uso            = EXCLUDED.uso,
       verificado_en  = EXCLUDED.verificado_en;

-- Una sola regla para el backend y para esta migración: el dominio exacto o
-- cualquiera de sus subdominios, y ante dos coincidencias gana la más específica.
-- Se toma lo que sigue a la última @, y el punto que precede al dominio es
-- obligatorio: `fakepucv.cl` no es `pucv.cl`.
CREATE OR REPLACE FUNCTION institucion_por_correo(correo TEXT) RETURNS TEXT
LANGUAGE sql STABLE AS $$
    SELECT u.nombre_universidad
      FROM dominio_institucion d
      JOIN universidad u USING (id_universidad)
     WHERE lower(trim(substring(correo FROM '@([^@]+)$'))) = d.dominio
        OR lower(trim(substring(correo FROM '@([^@]+)$'))) LIKE '%.' || d.dominio
     ORDER BY length(d.dominio) DESC
     LIMIT 1
$$;

-- Cuentas de Google ya creadas: su correo está verificado, así que su dominio
-- manda sobre lo que hubieran elegido en el selector.
DO $$
DECLARE
    fijadas INT;
BEGIN
    UPDATE usuario
       SET institucion_usuario = institucion_por_correo(correo_usuario)
     WHERE google_sub IS NOT NULL
       AND institucion_por_correo(correo_usuario) IS NOT NULL
       AND institucion_usuario IS DISTINCT FROM institucion_por_correo(correo_usuario);
    GET DIAGNOSTICS fijadas = ROW_COUNT;
    RAISE NOTICE 'dominios: % universidades con dominio; % cuentas de Google con su institución fijada',
        (SELECT count(DISTINCT id_universidad) FROM dominio_institucion), fijadas;
END $$;

COMMIT;

-- Verificación ---------------------------------------------------------------
DO $$
DECLARE
    pucv CONSTANT TEXT := 'Pontificia Universidad Catolica de Valparaiso';
BEGIN
    IF (SELECT count(*) FROM dominio_institucion) < 60 THEN
        RAISE EXCEPTION 'Faltan dominios: hay %', (SELECT count(*) FROM dominio_institucion);
    END IF;
    IF institucion_por_correo('ana@pucv.cl') IS DISTINCT FROM pucv
       OR institucion_por_correo('Ana@Mail.PUCV.cl') IS DISTINCT FROM pucv THEN
        RAISE EXCEPTION 'pucv.cl y sus subdominios no se reconocen';
    END IF;
    IF institucion_por_correo('ana@fakepucv.cl') IS NOT NULL
       OR institucion_por_correo('ana@pucv.cl.ejemplo.com') IS NOT NULL
       OR institucion_por_correo('ana@gmail.com') IS NOT NULL
       OR institucion_por_correo('sin-arroba') IS NOT NULL THEN
        RAISE EXCEPTION 'Se reconoce un dominio que no es institucional';
    END IF;
    IF EXISTS (SELECT 1 FROM usuario
                WHERE google_sub IS NOT NULL
                  AND institucion_por_correo(correo_usuario) IS NOT NULL
                  AND institucion_usuario IS DISTINCT FROM institucion_por_correo(correo_usuario)) THEN
        RAISE EXCEPTION 'Quedan cuentas de Google con una institución distinta de la de su dominio';
    END IF;
END $$;
