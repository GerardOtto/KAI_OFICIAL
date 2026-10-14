import { useEffect, useState } from "react";
import { conNombres } from "../utils/universidades";
import { leer, pedir } from "./cache";

const SIN_FILAS = [];
export const NOMBRE_SERIES = "trends";
export const transformarSeries = (res) => conNombres(Array.isArray(res?.data) ? res.data : []);

export const rutaSeries = (rankingId, metricaId, universidadIds, modo) =>
  `/trends?${new URLSearchParams({
    ranking_id: rankingId, metrica_id: metricaId, universidades: (universidadIds || []).join(","), modo,
  })}`;

// Vista "Evolución": una métrica a lo largo de los años, una serie por institución.
// Reusa /trends, pero acotando el payload a las instituciones seleccionadas y
// con dependencias estables (la lista viaja como string, no como array).
//
// Con caché: Tendencias deja pedida la serie del otro modo, y alternar Puntajes y
// Valores no vuelve al servidor. Una respuesta que llega tarde no pisa a la
// vigente. Al cambiar de ranking, de métrica o de modo lo anterior deja de valer
// en el acto; al sumar o quitar una institución, el gráfico conserva lo que tenía
// hasta que llega lo nuevo, en vez de vaciarse en cada clic.
export function useSeriesEvolucion(rankingId, metricaId, universidadIds, modo = "puntajes") {
  const [estado, setEstado] = useState({ base: "", filas: SIN_FILAS, pedida: "" });

  const uniKey = (universidadIds || []).join(",");
  const base = rankingId && metricaId && uniKey ? `${rankingId}|${metricaId}|${modo}` : "";
  const ruta = base ? rutaSeries(rankingId, metricaId, universidadIds, modo) : "";
  const enCache = leer(ruta, NOMBRE_SERIES);

  useEffect(() => {
    if (!ruta || leer(ruta, NOMBRE_SERIES) !== undefined) return;
    let vigente = true;
    pedir(ruta, transformarSeries, NOMBRE_SERIES)
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
