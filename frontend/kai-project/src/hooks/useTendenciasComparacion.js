import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { conNombres } from "../utils/universidades";

const SIN_FILAS = [];

// Vista "Comparación anual": N instituciones x M métricas en un solo año.
// El backend devuelve también el techo observado de cada métrica para poder
// normalizar en un mismo eje escalas distintas (0-100, 0-5, conteos).
//
// Como useSeriesEvolucion: una respuesta tardía se descarta, y solo sumar o quitar
// instituciones conserva el gráfico mientras llega lo nuevo.
export function useTendenciasComparacion(rankingId, anio, metricaIds, universidadIds, modo = "puntajes") {
  const [estado, setEstado] = useState({ base: "", filas: SIN_FILAS, pedida: "" });

  const metKey = (metricaIds || []).join(",");
  const uniKey = (universidadIds || []).join(",");
  const base = rankingId && anio && metKey && uniKey ? `${rankingId}|${anio}|${modo}|${metKey}` : "";

  useEffect(() => {
    if (!base) return;
    const [id, a, m, metricas] = base.split("|");
    const query = new URLSearchParams({
      ranking_id: id,
      anio: a,
      metricas,
      universidades: uniKey,
      modo: m,
    });

    let vigente = true;
    fetch(`${import.meta.env.VITE_API_URL}/tendencias-comparacion?${query}`, { headers: cabeceraAuth() })
      .then(r => r.json())
      .then(res => vigente && setEstado({ base, pedida: uniKey, filas: conNombres(Array.isArray(res) ? res : []) }))
      .catch(err => {
        if (!vigente) return;
        console.error(err);
        setEstado({ base, pedida: uniKey, filas: SIN_FILAS });
      });

    return () => { vigente = false; };
  }, [base, uniKey]);

  const vigente = base && estado.base === base;
  return {
    filas: vigente ? estado.filas : SIN_FILAS,
    loading: Boolean(base) && !(vigente && estado.pedida === uniKey),
  };
}
