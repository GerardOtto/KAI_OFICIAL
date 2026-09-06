import { useEffect, useState } from "react";

// Vista "Comparación anual": N instituciones x M métricas en un solo año.
// El backend devuelve también el techo observado de cada métrica para poder
// normalizar en un mismo eje escalas distintas (0-100, 0-5, conteos).
export function useTendenciasComparacion(rankingId, anio, metricaIds, universidadIds) {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);

  const metKey = (metricaIds || []).join(",");
  const uniKey = (universidadIds || []).join(",");

  useEffect(() => {
    if (!rankingId || !anio || !metKey || !uniKey) {
      setFilas([]);
      return;
    }
    const query = new URLSearchParams({
      ranking_id: rankingId,
      anio,
      metricas: metKey,
      universidades: uniKey,
    });

    let cancelado = false;
    setLoading(true);
    fetch(`${import.meta.env.VITE_API_URL}/tendencias-comparacion?${query}`)
      .then(r => r.json())
      .then(res => {
        if (cancelado) return;
        setFilas(Array.isArray(res) ? res : []);
        setLoading(false);
      })
      .catch(err => {
        if (cancelado) return;
        console.error(err);
        setFilas([]);
        setLoading(false);
      });

    return () => { cancelado = true; };
  }, [rankingId, anio, metKey, uniKey]);

  return { filas, loading };
}
