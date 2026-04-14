import { useEffect, useState } from "react";
export function useMetricasPorTipo(tipo) {
  const [data, setData] = useState([]);
  useEffect(() => {
    if (!tipo) return;
    fetch(`http://localhost:8000/metricas-por-tipo?tipo=${encodeURIComponent(tipo)}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, [tipo]);
  return data;
}