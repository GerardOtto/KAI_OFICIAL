import { useEffect, useState } from "react";
import { comoLista } from "./respuesta";
import { conNombres } from "../utils/universidades";
import { leer, pedir } from "./cache";

const SIN_FILAS = [];
export const NOMBRE_RESUMEN = "ranking-resumen";
export const transformarResumen = (d) => conNombres(comoLista(d));

/** Ruta del total de cada universidad en un año. La comparte useRankingHistorico,
 *  así que el año que ya pidió uno el otro lo lee de la caché. */
export function rutaResumen(rankingId, anio, disciplina = null) {
  const params = new URLSearchParams({ ranking_id: rankingId, anio });
  if (disciplina) params.append("disciplina", disciplina);
  return `/ranking-resumen?${params}`;
}

/** Puntaje total de cada universidad en un año de un ranking.
 *
 * `disciplina` acota los rankings multidisciplinarios (Shanghai GRAS, QS por
 * Disciplina): sin ella se sumaban todas sus disciplinas en un solo total.
 * Ligado a la petición que lo produjo, y con caché: volver a un ranking o a un
 * año ya visto no espera al servidor.
 */
export function useRankingResumen(rankingId, anio, disciplina = null) {
  const [estado, setEstado] = useState({ ruta: "", data: SIN_FILAS });
  const ruta = rankingId && anio ? rutaResumen(rankingId, anio, disciplina) : "";
  const enCache = leer(ruta, NOMBRE_RESUMEN);

  useEffect(() => {
    if (!ruta || leer(ruta, NOMBRE_RESUMEN) !== undefined) return;
    let vigente = true;
    pedir(ruta, transformarResumen, NOMBRE_RESUMEN)
      .then(filas => vigente && setEstado({ ruta, data: filas }))
      .catch(err => {
        console.error(err);
        if (vigente) setEstado({ ruta, data: SIN_FILAS });
      });
    return () => { vigente = false; };
  }, [ruta]);

  if (enCache !== undefined) return { data: enCache, loading: false };
  const vigente = ruta && estado.ruta === ruta;
  return { data: vigente ? estado.data : SIN_FILAS, loading: Boolean(ruta) && !vigente };
}
