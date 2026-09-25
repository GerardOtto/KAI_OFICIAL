import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";

/** Permiso para generar un informe de un módulo.
 *
 * El plan gratuito incluye un PDF y un XLSX por módulo, una sola vez. La cuenta
 * la lleva el servidor —un contador en el navegador se pierde al cambiar de
 * equipo—, así que hay que pedirle permiso antes de componer el archivo, y solo
 * seguir si lo concede.
 *
 * Devuelve además `agotado`, para que el botón pueda mostrarse deshabilitado en
 * lugar de fallar al pulsarlo.
 */
export function useDescarga(modulo) {
  const { capacidades, pedirDescarga } = useAuth();
  const [error, setError] = useState("");

  const limite = capacidades?.descargas?.limite ?? null;
  // Se memoriza porque entra en las dependencias de `agotado`: sin ello el
  // objeto sería nuevo en cada dibujo y la retrollamada se recrearía siempre.
  const usadas = useMemo(() => capacidades?.descargas?.usadas?.[modulo] || {},
                         [capacidades, modulo]);

  const agotado = useCallback(
    (formato) => limite !== null && (usadas[formato] || 0) >= limite,
    [limite, usadas],
  );

  const permitir = useCallback(async (formato) => {
    setError("");
    try {
      await pedirDescarga(modulo, formato);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, [modulo, pedirDescarga]);

  return { permitir, agotado, error, limite, usadas };
}

/** Texto del botón cuando el plan ya gastó su descarga. */
export function motivoAgotado(formato) {
  return `Tu plan incluye un informe ${formato.toUpperCase()} de este módulo y ya lo descargaste. `
       + "Los planes de pago no tienen límite.";
}
