import { useEffect, useState } from "react";
import { comoLista } from "./respuesta";
import { conNombres } from "../utils/universidades";
import { leer, pedir } from "./cache";

const SIN_FILAS = [];
export const NOMBRE_SIMULACION = "simulacion";
export const transformarSimulacion = (d) => conNombres(comoLista(d));

export function rutaSimulacion(rankingId, anio, universidades, modo = "puntajes") {
  const params = new URLSearchParams({ ranking_id: rankingId, anio, modo });
  if (universidades?.length) params.append("universidades", universidades.join(","));
  return `/simulacion?${params}`;
}

/** Valores por métrica de las universidades pedidas, en un año de un ranking.
 *
 * Con caché: volver a un ranking, un año o un modo ya vistos no espera al
 * servidor (Simulación deja pedido el otro modo, ver la página). Una respuesta
 * que llega tarde se descarta. Al cambiar de ranking, de año o de modo lo
 * anterior deja de valer en el acto, para no mezclar métricas de dos rankings;
 * al sumar o quitar una institución, la tabla conserva lo que tenía hasta que
 * llega lo nuevo, y no parpadea en cada clic.
 */
export function useSimulacion(rankingId, anio, universidades, modo = "puntajes") {
  const [estado, setEstado] = useState({ base: "", data: SIN_FILAS });
  const base = rankingId && anio ? `${rankingId}|${anio}|${modo}` : "";
  const ruta = base ? rutaSimulacion(rankingId, anio, universidades, modo) : "";
  const enCache = leer(ruta, NOMBRE_SIMULACION);

  useEffect(() => {
    if (!ruta || leer(ruta, NOMBRE_SIMULACION) !== undefined) return;
    let vigente = true;
    pedir(ruta, transformarSimulacion, NOMBRE_SIMULACION)
      .then(d => vigente && setEstado({ base, data: d }))
      .catch(console.error);
    return () => { vigente = false; };
  }, [ruta, base]);

  if (enCache !== undefined) return enCache;
  return base && estado.base === base ? estado.data : SIN_FILAS;
}
