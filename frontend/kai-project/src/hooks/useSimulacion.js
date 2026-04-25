import { useEffect, useState } from "react";
export function useSimulacion(rankingId, anio, universidades) {
  const [data, setData] = useState([]);
  useEffect(() => {
    if (!rankingId || !anio) return;
    const params = new URLSearchParams({ ranking_id: rankingId, anio });
    if (universidades?.length) params.append("universidades", universidades.join(","));
    fetch(`${import.meta.env.VITE_API_URL}/simulacion?${params}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, [rankingId, anio, universidades?.join(",")]);
  return data;
}