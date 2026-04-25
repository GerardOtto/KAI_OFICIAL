import { useEffect, useState } from "react";
export function useMetricasPorTipo(tipo) {
  const [data, setData] = useState([]);
  useEffect(() => {
    if (!tipo) return;
    fetch(`${import.meta.env.VITE_API_URL}/metricas-por-tipo?tipo=${encodeURIComponent(tipo)}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, [tipo]);
  return data;
}