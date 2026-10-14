import { useEffect, useMemo, useState } from "react";
import { metricasDe } from "../utils/rankingPonderado";
import { leer, pedir } from "./cache";
import { NOMBRE_SIMULACION, rutaSimulacion, transformarSimulacion } from "./useSimulacion";

const VACIO = { porAnio: {}, metricas: [] };

const armar = (pares) => ({
  porAnio: Object.fromEntries(pares),
  metricas: metricasDe(pares.flatMap(([, filas]) => filas)),
});

/** Puntajes por métrica de cada año de un ranking, para reponderarlo en el cliente.
 *
 * Solo se activa en los rankings con pesos editables. Pide todos los años a la
 * vez: son pocos y pequeños —el Ranking KAI tiene diez métricas y unas cincuenta
 * universidades por año—, y tenerlos todos permite que la posición histórica y
 * la variación anual se recalculen con los mismos pesos que el año elegido. Si
 * no, la tabla mostraría el año con los pesos del usuario y el historial con los
 * de fábrica, y las flechas de subida o bajada no significarían nada.
 *
 * El resultado se guarda junto con la petición que lo produjo: así, al cambiar de
 * ranking, lo anterior deja de valer sin tener que vaciarlo a mano. Cada año pasa
 * por la caché compartida: volver al Ranking KAI no repite las peticiones.
 */
export function useRankingPonderado(rankingId, anios, activo) {
  const [estado, setEstado] = useState({ clave: "", ...VACIO });

  const clave = activo && rankingId && anios.length
    ? `${rankingId}|${[...anios].sort((a, b) => a - b).join(",")}` : "";
  const rutas = useMemo(
    () => (clave ? clave.split("|")[1].split(",").map(Number)
      .map(anio => ({ anio, ruta: rutaSimulacion(rankingId, anio, [], "puntajes") })) : []),
    [clave, rankingId]
  );
  const completo = rutas.length > 0 && rutas.every(r => leer(r.ruta, NOMBRE_SIMULACION) !== undefined);
  const desdeCache = useMemo(
    () => (completo ? armar(rutas.map(r => [r.anio, leer(r.ruta, NOMBRE_SIMULACION)])) : null),
    [completo, rutas]
  );

  useEffect(() => {
    if (!clave || completo) return;
    let vigente = true;
    Promise.all(
      rutas.map(({ anio, ruta }) =>
        pedir(ruta, transformarSimulacion, NOMBRE_SIMULACION)
          .then(filas => [anio, filas])
          .catch(() => [anio, []]))
    ).then((pares) => {
      // Si el usuario cambió de ranking mientras esto viajaba, se descarta.
      if (vigente) setEstado({ clave, ...armar(pares) });
    });
    return () => { vigente = false; };
  }, [clave, completo, rutas]);

  if (desdeCache) return { ...desdeCache, loading: false };
  const vigente = clave && estado.clave === clave;
  return {
    ...(vigente ? estado : VACIO),
    loading: Boolean(clave) && !vigente,
  };
}
