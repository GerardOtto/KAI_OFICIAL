import { useEffect, useMemo } from "react";
import { useRankings } from "./useRankings";

/** Los rankings del catálogo, sabiendo cuáles puede abrir este plan.
 *
 * El catálogo los devuelve todos —el plan gratuito ve que THE y QS existen, que
 * es el propósito— con una marca `restringido`. Este hook añade dos cosas que
 * si no habría que repetir en cada módulo: la comprobación de si uno concreto
 * está permitido, y la corrección de la selección inicial.
 *
 * Esa corrección importa: los módulos arrancan con el primer ranking, que es THE
 * Latam. Sin esto, un usuario del plan gratuito entraría a una vista que pide
 * datos que su plan no incluye y solo vería el error.
 */
export function useRankingsPermitidos(rankingId, setRankingId) {
  const rankings = useRankings();

  const permitidos = useMemo(() => rankings.filter((r) => !r.restringido), [rankings]);

  useEffect(() => {
    if (!rankings.length) return;
    const actual = rankings.find((r) => r.id_ranking === rankingId);
    // Sin selección válida, o con una que este plan no abre, se cae al primero
    // que sí puede consultar.
    if ((!actual || actual.restringido) && permitidos.length) {
      setRankingId(permitidos[0].id_ranking);
    }
  }, [rankings, permitidos, rankingId, setRankingId]);

  const restringido = (id) =>
    Boolean(rankings.find((r) => r.id_ranking === Number(id))?.restringido);

  return { rankings, permitidos, restringido };
}

/** Sufijo que distingue en un desplegable lo que el plan no incluye. */
export const ETIQUETA_RESERVADO = " · plan de pago";
