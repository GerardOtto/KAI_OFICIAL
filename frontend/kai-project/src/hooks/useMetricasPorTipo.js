import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";
export function useMetricasPorTipo(tipo) {
  const [data, setData] = useState([]);
  useEffect(() => {
    if (!tipo) return;
    fetch(`${import.meta.env.VITE_API_URL}/metricas-por-tipo?tipo=${encodeURIComponent(tipo)}`, { headers: cabeceraAuth() })
      .then(r => r.json())
      .then(d => setData(comoLista(d)))
      .catch(console.error);
  }, [tipo]);
  return data;
}
