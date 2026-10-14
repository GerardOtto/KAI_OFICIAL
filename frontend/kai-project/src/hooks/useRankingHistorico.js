import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";

/** Cuántas ediciones, de la más reciente hacia atrás, entran en el historial. */
export const MAX_ANIOS_HISTORICO = 6;

const SIN_HISTORICO = {};

// Trae el resumen de hasta los últimos MAX_ANIOS_HISTORICO años de un ranking y
// arma, por universidad, su serie de posiciones (para el sparkline) y su Δ vs el
// año anterior. Pide los años en paralelo y ordena en el cliente — sin
// endpoint histórico dedicado en el backend (ver handoff de diseño 2a).
//
// `disciplina` acota los rankings multidisciplinarios, igual que en el resumen
// del año: la posición histórica debe ser la de la misma clasificación. El
// resultado queda ligado a la petición que lo produjo.
export function useRankingHistorico(rankingId, anios, disciplina = null) {
  const [estado, setEstado] = useState({ clave: "", historicoMap: SIN_HISTORICO });

  const aniosKey = anios.slice(0, MAX_ANIOS_HISTORICO).sort((a, b) => a - b).join(",");
  const clave = rankingId && aniosKey ? `${rankingId}|${aniosKey}|${disciplina ?? ""}` : "";

  useEffect(() => {
    if (!clave) return;
    const [id, lista, d] = clave.split("|");
    let vigente = true;

    Promise.all(
      lista.split(",").map(Number).map(anio => {
        const params = new URLSearchParams({ ranking_id: id, anio });
        if (d) params.append("disciplina", d);
        return fetch(`${import.meta.env.VITE_API_URL}/ranking-resumen?${params}`, { headers: cabeceraAuth() })
          .then(r => r.json())
          .then(rows => ({ anio, rows: comoLista(rows) }))
          .catch(() => ({ anio, rows: [] }));
      })
    ).then(porAnio => {
      if (!vigente) return;
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

      setEstado({ clave, historicoMap: map });
    });

    return () => { vigente = false; };
  }, [clave]);

  const vigente = clave && estado.clave === clave;
  return { historicoMap: vigente ? estado.historicoMap : SIN_HISTORICO, loading: Boolean(clave) && !vigente };
}
