import { useEffect, useState } from "react";
export function useAnios(rankingId) {
  const [anios, setAnios] = useState([]);
  useEffect(() => {
    if (!rankingId) return;
    fetch(`${import.meta.env.VITE_API_URL}/anios?ranking_id=${rankingId}`)
      .then(r => r.json())
      .then(setAnios)
      .catch(console.error);
  }, [rankingId]);
  return anios;
}