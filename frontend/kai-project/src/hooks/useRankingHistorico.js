import { useEffect, useState } from "react";

const MAX_ANIOS = 6;

// Trae el resumen de hasta los últimos MAX_ANIOS años de un ranking y arma,
// por universidad, su serie de posiciones (para el sparkline) y su Δ vs el
// año anterior. Pide los años en paralelo y ordena en el cliente — sin
// endpoint histórico dedicado en el backend (ver handoff de diseño 2a).
export function useRankingHistorico(rankingId, anios) {
  const [historicoMap, setHistoricoMap] = useState({});
  const [loading, setLoading] = useState(false);

  const aniosKey = anios.slice(0, MAX_ANIOS).sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (!rankingId || !aniosKey) {
      setHistoricoMap({});
      return;
    }
    const aniosOrdenados = aniosKey.split(",").map(Number);
    setLoading(true);

    Promise.all(
      aniosOrdenados.map(anio =>
        fetch(`${import.meta.env.VITE_API_URL}/ranking-resumen?ranking_id=${rankingId}&anio=${anio}`)
          .then(r => r.json())
          .then(rows => ({ anio, rows }))
          .catch(() => ({ anio, rows: [] }))
      )
    ).then(porAnio => {
      const map = {};
      porAnio.forEach(({ anio, rows }) => {
        const ordenado = [...rows].sort((a, b) => b.score_total - a.score_total);
        ordenado.forEach((row, i) => {
          const posicion = i + 1;
          if (!map[row.id_universidad]) map[row.id_universidad] = { historico: [] };
          map[row.id_universidad].historico.push({ anio, posicion, score: row.score_total });
        });
      });

      Object.values(map).forEach(entry => {
        entry.historico.sort((a, b) => a.anio - b.anio);
        const n = entry.historico.length;
        entry.posicionAnterior = n >= 2 ? entry.historico[n - 2].posicion : null;
      });

      setHistoricoMap(map);
      setLoading(false);
    });
  }, [rankingId, aniosKey]);

  return { historicoMap, loading };
}
