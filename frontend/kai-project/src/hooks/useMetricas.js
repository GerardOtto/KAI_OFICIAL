import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";
export function useMetricas(rankingId) {
  const [metricas, setMetricas] = useState([]);
  useEffect(() => {
    if (!rankingId) return;
    fetch(`${import.meta.env.VITE_API_URL}/metricas-con-datos?ranking_id=${rankingId}`, { headers: cabeceraAuth() })
      .then(r => r.json())
      .then(d => setMetricas(comoLista(d)))
      .catch(console.error);
  }, [rankingId]);
  return metricas;
}
