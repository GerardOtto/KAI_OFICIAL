import { useEffect, useState } from "react";

// Vista "Evolución": una métrica a lo largo de los años, una serie por institución.
// Reusa /trends, pero acotando el payload a las instituciones seleccionadas y
// con dependencias estables (la lista viaja como string, no como array).
export function useSeriesEvolucion(rankingId, metricaId, universidadIds) {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);

  const uniKey = (universidadIds || []).join(",");

  useEffect(() => {
    if (!rankingId || !metricaId || !uniKey) {
      setFilas([]);
      return;
    }
    const query = new URLSearchParams({
      ranking_id: rankingId,
      metrica_id: metricaId,
      universidades: uniKey,
    });

    let cancelado = false;
    setLoading(true);
    fetch(`${import.meta.env.VITE_API_URL}/trends?${query}`)
      .then(r => r.json())
      .then(res => {
        if (cancelado) return;
        setFilas(Array.isArray(res?.data) ? res.data : []);
        setLoading(false);
      })
      .catch(err => {
        if (cancelado) return;
        console.error(err);
        setFilas([]);
        setLoading(false);
      });

    return () => { cancelado = true; };
  }, [rankingId, metricaId, uniKey]);

  return { filas, loading };
}
