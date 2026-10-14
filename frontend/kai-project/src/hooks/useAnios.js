import { useEffect, useState } from "react";
import { comoLista } from "./respuesta";
import { leer, otroModo, pedir, precargar } from "./cache";

const SIN_ANIOS = [];
export const NOMBRE_ANIOS = "anios";
const NOMBRE = NOMBRE_ANIOS;

export const rutaAnios = (rankingId, modo) => `/anios?ranking_id=${rankingId}&modo=${modo}`;

/** Años con datos de un ranking en el modo pedido, del más reciente al más antiguo.
 *
 * Pasa por la caché compartida (hooks/cache.js) y deja pedido el otro modo, para
 * que alternar Puntajes y Valores no espere al servidor. El resultado queda
 * ligado a la petición: al cambiar de ranking no se ven, ni por un instante, los
 * años del anterior.
 */
export function useAnios(rankingId, modo = "puntajes") {
  const [estado, setEstado] = useState({ ruta: "", anios: SIN_ANIOS });
  const ruta = rankingId ? rutaAnios(rankingId, modo) : "";
  const enCache = leer(ruta, NOMBRE);

  useEffect(() => {
    if (!rankingId) return;
    precargar(rutaAnios(rankingId, otroModo(modo)), comoLista, NOMBRE);
    if (leer(ruta, NOMBRE) !== undefined) return;
    let vigente = true;
    pedir(ruta, comoLista, NOMBRE)
      .then(d => vigente && setEstado({ ruta, anios: d }))
      .catch(console.error);
    return () => { vigente = false; };
  }, [ruta, rankingId, modo]);

  if (enCache !== undefined) return enCache;
  return ruta && estado.ruta === ruta ? estado.anios : SIN_ANIOS;
}
