import { useEffect, useState } from "react";
export function useMetricas(rankingId) {
  const [metricas, setMetricas] = useState([]);
  useEffect(() => {
    if (!rankingId) return;
    fetch(`${import.meta.env.VITE_API_URL}/metricas-con-datos?ranking_id=${rankingId}`)
      .then(r => r.json())
      .then(setMetricas)
      .catch(console.error);
  }, [rankingId]);
  return metricas;
}