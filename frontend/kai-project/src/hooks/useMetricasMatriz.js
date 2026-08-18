import { useEffect, useState } from "react";

// Trae, en paralelo, las métricas de cada tipo (dimensión) — reutiliza el
// mismo endpoint /metricas-por-tipo que ya usa la vista por categorías,
// solo que aquí se piden todos los tipos a la vez para armar la matriz
// completa (filas = dimensión, columnas = ranking).
export function useMetricasMatriz(tipos) {
  const [matriz, setMatriz] = useState({});
  const [loading, setLoading] = useState(false);

  const tiposKey = tipos.join(",");

  useEffect(() => {
    if (!tipos.length) {
      setMatriz({});
      return;
    }
    setLoading(true);
    Promise.all(
      tipos.map(tipo =>
        fetch(`${import.meta.env.VITE_API_URL}/metricas-por-tipo?tipo=${encodeURIComponent(tipo)}`)
          .then(r => r.json())
          .then(data => [tipo, data])
          .catch(() => [tipo, []])
      )
    ).then(entries => {
      setMatriz(Object.fromEntries(entries));
      setLoading(false);
    });
  }, [tiposKey]);

  return { matriz, loading };
}
