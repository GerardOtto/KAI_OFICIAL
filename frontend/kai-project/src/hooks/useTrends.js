import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
export function useTrends(rankingId, metricaId, universidades) {
    const [data, setData] = useState([]);
    const [min, setMin] = useState(0);
    const [max, setMax] = useState(1);
  
    useEffect(() => {
      if (!rankingId || !metricaId) return;
  
      const query = new URLSearchParams({
        ranking_id: rankingId,
        metrica_id: metricaId,
        universidades: universidades?.join(",") || ""
      });
  
      fetch(`${import.meta.env.VITE_API_URL}/trends?${query}`, { headers: cabeceraAuth() })
        .then(res => res.json())
        .then(res => {
          // El endpoint devuelve {data, min, max}; ante un rechazo llega
          // {detail}, y la vista debe quedarse vacía en vez de romperse.
          setData(Array.isArray(res?.data) ? res.data : []);
          setMin(res?.min ?? 0);
          setMax(res?.max ?? 0);
        })
        .catch(console.error);
  
    }, [rankingId, metricaId, universidades]);
  
    return { data, min, max };
  }
