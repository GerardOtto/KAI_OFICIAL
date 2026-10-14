import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";

const SIN_ANIOS = [];

/** Años con datos de un ranking en el modo pedido, del más reciente al más antiguo.
 *
 * Ligado a la petición que lo produjo, igual que useMetricas: al cambiar de
 * ranking no se ven, ni por un instante, los años del anterior.
 */
export function useAnios(rankingId, modo = "puntajes") {
  const [estado, setEstado] = useState({ clave: "", anios: SIN_ANIOS });
  const clave = rankingId ? `${rankingId}|${modo}` : "";

  useEffect(() => {
    if (!clave) return;
    const [id, m] = clave.split("|");
    let vigente = true;
    fetch(`${import.meta.env.VITE_API_URL}/anios?ranking_id=${id}&modo=${m}`, { headers: cabeceraAuth() })
      .then(r => r.json())
      .then(d => vigente && setEstado({ clave, anios: comoLista(d) }))
      .catch(console.error);
    return () => { vigente = false; };
  }, [clave]);

  return clave && estado.clave === clave ? estado.anios : SIN_ANIOS;
}
