import { useEffect, useState } from "react";
export function useAnios(rankingId) {
  const [anios, setAnios] = useState([]);
  useEffect(() => {
    if (!rankingId) return;
    fetch(`http://localhost:8000/anios?ranking_id=${rankingId}`)
      .then(r => r.json())
      .then(setAnios)
      .catch(console.error);
  }, [rankingId]);
  return anios;
}