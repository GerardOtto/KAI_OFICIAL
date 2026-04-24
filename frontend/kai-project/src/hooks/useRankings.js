import { useEffect, useState } from "react";
export function useRankings() {
  const [rankings, setRankings] = useState([]);
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/rankings`)
      .then(r => r.json())
      .then(setRankings)
      .catch(console.error);
  }, []);
  return rankings;
}