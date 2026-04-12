import { useEffect, useState } from "react";

export function useRankingResumen(rankingId, anio) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!rankingId || !anio) return;
    setLoading(true);
    fetch(`http://localhost:8000/ranking-resumen?ranking_id=${rankingId}&anio=${anio}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(console.error);
  }, [rankingId, anio]);

  return { data, loading };
}