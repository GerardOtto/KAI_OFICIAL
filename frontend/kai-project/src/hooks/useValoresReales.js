import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";

/** Valores medidos de un ranking en un año, para el modo numérico.
 *
 * Como en el reponderado, el resultado queda ligado a la petición que lo
 * produjo: al cambiar de ranking o de año lo anterior deja de valer solo, sin
 * vaciarlo dentro del efecto.
 */
export function useValoresReales(rankingId, anio, activo) {
  const [estado, setEstado] = useState({ clave: "", datos: null, error: null });
  const clave = activo && rankingId && anio ? `${rankingId}|${anio}` : "";

  useEffect(() => {
    if (!clave) return;
    const [id, a] = clave.split("|");
    let vigente = true;
    fetch(`${import.meta.env.VITE_API_URL}/valores-reales?ranking_id=${id}&anio=${a}`,
          { headers: cabeceraAuth() })
      .then(async (r) => {
        const cuerpo = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(cuerpo.detail || `Error ${r.status}`);
        return cuerpo;
      })
      .then((datos) => vigente && setEstado({ clave, datos, error: null }))
      .catch((e) => vigente && setEstado({ clave, datos: null, error: e.message }));
    return () => { vigente = false; };
  }, [clave]);

  const vigente = clave && estado.clave === clave;
  return {
    datos: vigente ? estado.datos : null,
    error: vigente ? estado.error : null,
    loading: Boolean(clave) && !vigente,
  };
}
