import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";

const SIN_METRICAS = [];

/** Métricas de un ranking que tienen datos en el modo pedido.
 *
 * El resultado queda ligado a la petición que lo produjo, como en
 * useValoresReales: al cambiar de ranking o de modo, la lista anterior deja de
 * valer en el acto, y una respuesta que llega tarde no pisa a la vigente. Sin
 * eso, alternar Puntajes y Valores deprisa podía dejar en pantalla las métricas
 * del modo equivocado.
 */
export function useMetricas(rankingId, modo = "puntajes") {
  const [estado, setEstado] = useState({ clave: "", metricas: SIN_METRICAS });
  const clave = rankingId ? `${rankingId}|${modo}` : "";

  useEffect(() => {
    if (!clave) return;
    const [id, m] = clave.split("|");
    let vigente = true;
    fetch(`${import.meta.env.VITE_API_URL}/metricas-con-datos?ranking_id=${id}&modo=${m}`, { headers: cabeceraAuth() })
      .then(r => r.json())
      .then(d => vigente && setEstado({ clave, metricas: comoLista(d) }))
      .catch(console.error);
    return () => { vigente = false; };
  }, [clave]);

  return clave && estado.clave === clave ? estado.metricas : SIN_METRICAS;
}
