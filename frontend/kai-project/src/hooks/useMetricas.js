import { useEffect, useState } from "react";

export function useMetricas(rankingId) {
  const [metricas, setMetricas] = useState([]);

  useEffect(() => {
    if (!rankingId) return;

    fetch(`http://localhost:8000/metricas?ranking_id=${rankingId}`)
      .then(res => res.json())
      .then(setMetricas)
      .catch(console.error);

  }, [rankingId]);

  return metricas;
}