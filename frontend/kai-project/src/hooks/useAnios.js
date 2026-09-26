import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";
export function useAnios(rankingId, modo = "puntajes") {
  const [anios, setAnios] = useState([]);
  useEffect(() => {
    if (!rankingId) return;
    fetch(`${import.meta.env.VITE_API_URL}/anios?ranking_id=${rankingId}&modo=${modo}`, { headers: cabeceraAuth() })
      .then(r => r.json())
      .then(d => setAnios(comoLista(d)))
      .catch(console.error);
  }, [rankingId, modo]);
  return anios;
}
