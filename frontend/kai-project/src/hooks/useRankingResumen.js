import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";

export function useRankingResumen(rankingId, anio) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!rankingId || !anio) return;
    setLoading(true);
    fetch(`${import.meta.env.VITE_API_URL}/ranking-resumen?ranking_id=${rankingId}&anio=${anio}`, { headers: cabeceraAuth() })
      .then(r => r.json())
      .then(d => { setData(comoLista(d)); setLoading(false); })
      .catch(console.error);
  }, [rankingId, anio]);

  return { data, loading };
}
