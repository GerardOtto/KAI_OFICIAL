-- Migración: una cuenta vinculada a Google deja de admitir contraseña.
--
-- Desde este cambio, `/auth/google` borra la contraseña al vincular. Esta
-- migración aplica la misma regla a las cuentas vinculadas antes, que
-- conservaban la contraseña con la que se registraron.
--
-- El CHECK usuario_metodo_acceso_chk se sigue cumpliendo: todas estas filas
-- tienen google_sub.
--
-- Idempotente: puede ejecutarse varias veces sin efecto acumulado.
BEGIN;

UPDATE usuario
   SET clave_usuario = NULL
 WHERE google_sub IS NOT NULL
   AND clave_usuario IS NOT NULL;

COMMIT;
