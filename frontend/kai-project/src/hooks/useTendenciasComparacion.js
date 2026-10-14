import { useEffect, useState } from "react";
import { conNombres } from "../utils/universidades";
import { leer, pedir } from "./cache";

const SIN_FILAS = [];
export const NOMBRE_COMPARACION = "tendencias-comparacion";
export const transformarComparacion = (res) => conNombres(Array.isArray(res) ? res : []);

export const rutaComparacion = (rankingId, anio, metricaIds, universidadIds, modo) =>
  `/tendencias-comparacion?${new URLSearchParams({
    ranking_id: rankingId, anio, metricas: (metricaIds || []).join(","),
    universidades: (universidadIds || []).join(","), modo,
  })}`;

// Vista "Comparación anual": N instituciones x M métricas en un solo año.
// El backend devuelve también el techo observado de cada métrica para poder
// normalizar en un mismo eje escalas distintas (0-100, 0-5, conteos).
//
// Como useSeriesEvolucion: con caché, una respuesta tardía se descarta, y solo
// sumar o quitar instituciones conserva el gráfico mientras llega lo nuevo.
export function useTendenciasComparacion(rankingId, anio, metricaIds, universidadIds, modo = "puntajes") {
  const [estado, setEstado] = useState({ base: "", filas: SIN_FILAS, pedida: "" });

  const metKey = (metricaIds || []).join(",");
  const uniKey = (universidadIds || []).join(",");
  const base = rankingId && anio && metKey && uniKey ? `${rankingId}|${anio}|${modo}|${metKey}` : "";
  const ruta = base ? rutaComparacion(rankingId, anio, metricaIds, universidadIds, modo) : "";
  const enCache = leer(ruta, NOMBRE_COMPARACION);

  useEffect(() => {
    if (!ruta || leer(ruta, NOMBRE_COMPARACION) !== undefined) return;
    let vigente = true;
    pedir(ruta, transformarComparacion, NOMBRE_COMPARACION)
      .then(filas => vigente && setEstado({ base, pedida: ruta, filas }))
      .catch(err => {
        if (!vigente) return;
        console.error(err);
        setEstado({ base, pedida: ruta, filas: SIN_FILAS });
      });
    return () => { vigente = false; };
  }, [ruta, base]);

  if (enCache !== undefined) return { filas: enCache, loading: false };
  const vigente = base && estado.base === base;
  return {
    filas: vigente ? estado.filas : SIN_FILAS,
    loading: Boolean(base) && !(vigente && estado.pedida === ruta),
  };
}
