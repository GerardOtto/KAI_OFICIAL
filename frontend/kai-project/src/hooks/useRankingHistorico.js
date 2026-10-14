import { useEffect, useMemo, useState } from "react";
import { leer, pedir } from "./cache";
import { NOMBRE_RESUMEN, rutaResumen, transformarResumen } from "./useRankingResumen";

/** Cuántas ediciones, de la más reciente hacia atrás, entran en el historial. */
export const MAX_ANIOS_HISTORICO = 6;

const SIN_HISTORICO = {};

/** Posición de cada universidad en cada año, y la del año anterior. */
function armar(porAnio) {
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
  return map;
}

// Trae el resumen de hasta los últimos MAX_ANIOS_HISTORICO años de un ranking y
// arma, por universidad, su serie de posiciones (para el sparkline) y su Δ vs el
// año anterior. Pide los años en paralelo y ordena en el cliente — sin
// endpoint histórico dedicado en el backend (ver handoff de diseño 2a).
//
// `disciplina` acota los rankings multidisciplinarios, igual que en el resumen
// del año. Cada año pasa por la misma caché que useRankingResumen: el año que
// se está viendo ya está pedido, y volver a un ranking no repite nada.
export function useRankingHistorico(rankingId, anios, disciplina = null) {
  const [estado, setEstado] = useState({ clave: "", historicoMap: SIN_HISTORICO });

  const aniosKey = anios.slice(0, MAX_ANIOS_HISTORICO).sort((a, b) => a - b).join(",");
  const clave = rankingId && aniosKey ? `${rankingId}|${aniosKey}|${disciplina ?? ""}` : "";
  const rutas = useMemo(
    () => (clave ? aniosKey.split(",").map(a => ({ anio: Number(a), ruta: rutaResumen(rankingId, a, disciplina) })) : []),
    [clave, aniosKey, rankingId, disciplina]
  );
  const completo = rutas.length > 0 && rutas.every(r => leer(r.ruta, NOMBRE_RESUMEN) !== undefined);
  const desdeCache = useMemo(
    () => (completo ? armar(rutas.map(r => ({ anio: r.anio, rows: leer(r.ruta, NOMBRE_RESUMEN) }))) : null),
    [completo, rutas]
  );

  useEffect(() => {
    if (!clave || completo) return;
    let vigente = true;
    Promise.all(
      rutas.map(({ anio, ruta }) =>
        pedir(ruta, transformarResumen, NOMBRE_RESUMEN)
          .then(rows => ({ anio, rows }))
          .catch(() => ({ anio, rows: [] })))
    ).then(porAnio => vigente && setEstado({ clave, historicoMap: armar(porAnio) }));
    return () => { vigente = false; };
  }, [clave, completo, rutas]);

  if (desdeCache) return { historicoMap: desdeCache, loading: false };
  const vigente = clave && estado.clave === clave;
  return { historicoMap: vigente ? estado.historicoMap : SIN_HISTORICO, loading: Boolean(clave) && !vigente };
}
