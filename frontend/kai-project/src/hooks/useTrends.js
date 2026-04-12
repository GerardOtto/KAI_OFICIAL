import { useEffect, useState } from "react";
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
  
      fetch(`http://localhost:8000/trends?${query}`)
        .then(res => res.json())
        .then(res => {
          setData(res.data);
          setMin(res.min);
          setMax(res.max);
        })
        .catch(console.error);
  
    }, [rankingId, metricaId, universidades]);
  
    return { data, min, max };
  }