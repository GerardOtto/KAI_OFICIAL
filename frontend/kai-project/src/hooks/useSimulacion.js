import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";
export function useSimulacion(rankingId, anio, universidades) {
  const [data, setData] = useState([]);
  useEffect(() => {
    if (!rankingId || !anio) return;
    const params = new URLSearchParams({ ranking_id: rankingId, anio });
    if (universidades?.length) params.append("universidades", universidades.join(","));
    fetch(`${import.meta.env.VITE_API_URL}/simulacion?${params}`, { headers: cabeceraAuth() })
      .then(r => r.json())
      .then(d => setData(comoLista(d)))
      .catch(console.error);
  }, [rankingId, anio, universidades?.join(",")]);
  return data;
}
