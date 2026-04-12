import { useEffect, useState } from "react";
export function useRankings() {
  const [rankings, setRankings] = useState([]);
  useEffect(() => {
    fetch("http://localhost:8000/rankings")
      .then(r => r.json())
      .then(setRankings)
      .catch(console.error);
  }, []);
  return rankings;
}