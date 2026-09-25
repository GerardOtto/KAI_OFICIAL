import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";
export function useRankings() {
  const [rankings, setRankings] = useState([]);
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/rankings`, { headers: cabeceraAuth() })
      .then(r => r.json())
      .then(d => setRankings(comoLista(d)))
      .catch(console.error);
  }, []);
  return rankings;
}
