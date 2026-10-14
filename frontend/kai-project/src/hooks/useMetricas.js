import { useEffect, useState } from "react";
import { comoLista } from "./respuesta";
import { leer, otroModo, pedir, precargar } from "./cache";

const SIN_METRICAS = [];
const NOMBRE = "metricas-con-datos";

export const rutaMetricas = (rankingId, modo) => `/metricas-con-datos?ranking_id=${rankingId}&modo=${modo}`;

/** Métricas de un ranking que tienen datos en el modo pedido.
 *
 * Pasa por la caché compartida y deja pedido el otro modo: al alternar Puntajes
 * y Valores, el selector, el nombre de la métrica y su peso ya están, sin volver
 * al servidor. Una respuesta que llega tarde no pisa a la vigente.
 */
export function useMetricas(rankingId, modo = "puntajes") {
  const [estado, setEstado] = useState({ ruta: "", metricas: SIN_METRICAS });
  const ruta = rankingId ? rutaMetricas(rankingId, modo) : "";
  const enCache = leer(ruta, NOMBRE);

  useEffect(() => {
    if (!rankingId) return;
    precargar(rutaMetricas(rankingId, otroModo(modo)), comoLista, NOMBRE);
    if (leer(ruta, NOMBRE) !== undefined) return;
    let vigente = true;
    pedir(ruta, comoLista, NOMBRE)
      .then(d => vigente && setEstado({ ruta, metricas: d }))
      .catch(console.error);
    return () => { vigente = false; };
  }, [ruta, rankingId, modo]);

  if (enCache !== undefined) return enCache;
  return ruta && estado.ruta === ruta ? estado.metricas : SIN_METRICAS;
}
