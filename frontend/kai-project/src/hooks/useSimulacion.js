import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";
import { conNombres } from "../utils/universidades";

const SIN_FILAS = [];

/** Valores por métrica de las universidades pedidas, en un año de un ranking.
 *
 * Una respuesta que llega tarde —con la siguiente ya pedida— se descarta en vez
 * de reemplazar a la vigente. Al cambiar de ranking, de año o de modo lo anterior
 * deja de valer en el acto, para no mezclar métricas de dos rankings; al sumar o
 * quitar una institución, en cambio, la tabla conserva lo que tenía hasta que
 * llega lo nuevo, y no parpadea en cada clic.
 */
export function useSimulacion(rankingId, anio, universidades, modo = "puntajes") {
  const [estado, setEstado] = useState({ base: "", data: SIN_FILAS });
  const base = rankingId && anio ? `${rankingId}|${anio}|${modo}` : "";
  const ids = universidades?.length ? universidades.join(",") : "";

  useEffect(() => {
    if (!base) return;
    const [id, a, m] = base.split("|");
    const params = new URLSearchParams({ ranking_id: id, anio: a, modo: m });
    if (ids) params.append("universidades", ids);
    let vigente = true;
    fetch(`${import.meta.env.VITE_API_URL}/simulacion?${params}`, { headers: cabeceraAuth() })
      .then(r => r.json())
      .then(d => vigente && setEstado({ base, data: conNombres(comoLista(d)) }))
      .catch(console.error);
    return () => { vigente = false; };
  }, [base, ids]);

  return base && estado.base === base ? estado.data : SIN_FILAS;
}
