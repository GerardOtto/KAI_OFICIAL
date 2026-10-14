import { useEffect, useMemo, useState } from "react";
import { comoLista } from "./respuesta";
import { leer, otroModo, pedir, precargar } from "./cache";
import { NOMBRE_ANIOS, rutaAnios } from "./useAnios";

const SIN_ANIOS = {};

/** Años con datos de varios rankings a la vez, en el modo pedido: { id_ranking: [años] }.
 *
 * El glosario cruza todos los rankings, y cada uno tiene sus propias ediciones:
 * el selector de año ofrece la unión, y cada columna dice si tiene la elegida.
 * Conviene pasar solo los rankings que el plan abre: los demás responden 403.
 * Comparte la caché de useAnios y deja pedido el otro modo.
 */
export function useAniosPorRanking(ids, modo = "puntajes") {
  const [estado, setEstado] = useState({ clave: "", mapa: SIN_ANIOS });
  const clave = ids.length ? `${ids.join(",")}|${modo}` : "";
  const rutas = useMemo(
    () => (clave ? ids.map(id => ({ id, ruta: rutaAnios(id, modo) })) : []),
    [clave, ids, modo]
  );
  const completo = rutas.length > 0 && rutas.every(r => leer(r.ruta, NOMBRE_ANIOS) !== undefined);
  const desdeCache = useMemo(
    () => (completo ? Object.fromEntries(rutas.map(r => [r.id, leer(r.ruta, NOMBRE_ANIOS)])) : null),
    [completo, rutas]
  );

  useEffect(() => {
    if (!clave) return;
    ids.forEach(id => precargar(rutaAnios(id, otroModo(modo)), comoLista, NOMBRE_ANIOS));
    if (completo) return;
    let vigente = true;
    Promise.all(rutas.map(({ id, ruta }) =>
      pedir(ruta, comoLista, NOMBRE_ANIOS).then(d => [id, d]).catch(() => [id, []])))
      .then(pares => vigente && setEstado({ clave, mapa: Object.fromEntries(pares) }));
    return () => { vigente = false; };
  }, [clave, completo, rutas, ids, modo]);

  if (desdeCache) return desdeCache;
  return clave && estado.clave === clave ? estado.mapa : SIN_ANIOS;
}
