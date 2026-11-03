-- 019_rol_del_asistente.sql
--
-- Rol de base con el que corre la consulta SQL libre del asistente
-- (`consulta_sql` en app/herramientas.py): solo puede leer las tablas
-- académicas.
--
-- Hasta ahora la única defensa de esa herramienta era un filtro de texto sobre
-- la consulta. Se demostró que no bastaba: con funciones que ejecutan SQL
-- escrito como texto (ts_stat, query_to_xml) el nombre de la tabla se arma por
-- partes al ejecutar, el filtro no lo ve, y se leyeron correos de cuentas y
-- mensajes de conversaciones ajenas. El filtro ya rechaza esas funciones, pero
-- un filtro de texto siempre puede tener otro hueco. Con este rol, cualquier
-- tabla fuera de la lista da «permiso denegado» venga como venga, porque lo
-- decide PostgreSQL.
--
-- Una salvedad que no resuelve esta migración por sí sola: si el backend se
-- conecta como superusuario —lo habitual en Railway—, una consulta podría
-- recuperar los privilegios con set_config('role', ...). El filtro lo impide;
-- para que no dependa de él, dale al rol una contraseña y úsalo en una conexión
-- propia, `DATABASE_URL_ASISTENTE` (ver README de migraciones, «019»).
--
-- Los roles son de todo el servidor y no viajan en un pg_dump de la base: hay
-- que aplicar esta migración también después de cargar un volcado.
--
-- Aplicarla ANTES de desplegar el backend que la usa: sin el rol, la consulta
-- libre se niega (las demás herramientas siguen funcionando). Idempotente.

BEGIN;

DO $$
BEGIN
    IF to_regrole('kai_asistente') IS NULL THEN
        CREATE ROLE kai_asistente NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO kai_asistente;
GRANT SELECT ON ranking, universidad, metrica, metrica_universidad, valor_real_universidad,
                cientifico, cientifico_metrica, cientifico_topico
   TO kai_asistente;

-- Quien aplica la migración suele ser el mismo usuario con que se conecta el
-- backend. Un superusuario no lo necesita, pero un usuario corriente sí, para
-- poder asumir el rol con SET ROLE.
GRANT kai_asistente TO CURRENT_USER;

COMMIT;


-- ------------------------------------------------------------------ verificación

DO $$
DECLARE
    academicas CONSTANT TEXT[] := ARRAY['ranking', 'universidad', 'metrica', 'metrica_universidad',
                                        'valor_real_universidad', 'cientifico', 'cientifico_metrica',
                                        'cientifico_topico'];
    t TEXT;
BEGIN
    IF (SELECT rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls
          FROM pg_roles WHERE rolname = 'kai_asistente') THEN
        RAISE EXCEPTION 'kai_asistente no puede tener privilegios de administración';
    END IF;

    FOREACH t IN ARRAY academicas LOOP
        IF NOT has_table_privilege('kai_asistente', 'public.' || t, 'SELECT') THEN
            RAISE EXCEPTION 'kai_asistente no puede leer %', t;
        END IF;
    END LOOP;

    -- Ninguna otra tabla, incluidas las que se agreguen en el futuro con permisos
    -- para PUBLIC. Si esto aborta, revoca ese permiso o quita la tabla de la lista.
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
              AND tablename <> ALL(academicas) LOOP
        IF has_table_privilege('kai_asistente', 'public.' || quote_ident(t), 'SELECT') THEN
            RAISE EXCEPTION 'kai_asistente puede leer % y no debería (¿un permiso concedido a PUBLIC?)', t;
        END IF;
    END LOOP;

    RAISE NOTICE 'kai_asistente lee solo las % tablas académicas', array_length(academicas, 1);
END $$;
