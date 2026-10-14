import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";
import { conNombres } from "../utils/universidades";

const SIN_FILAS = [];

/** Puntaje total de cada universidad en un año de un ranking.
 *
 * `disciplina` acota los rankings multidisciplinarios (Shanghai GRAS, QS por
 * Disciplina): sin ella se sumaban todas sus disciplinas en un solo total.
 * Ligado a la petición que lo produjo: al cambiar de ranking o de año, la tabla
 * no muestra ni por un instante los puntajes del anterior.
 */
export function useRankingResumen(rankingId, anio, disciplina = null) {
  const [estado, setEstado] = useState({ clave: "", data: SIN_FILAS });
  const clave = rankingId && anio ? `${rankingId}|${anio}|${disciplina ?? ""}` : "";

  useEffect(() => {
    if (!clave) return;
    const [id, a, d] = clave.split("|");
    const params = new URLSearchParams({ ranking_id: id, anio: a });
    if (d) params.append("disciplina", d);
    let vigente = true;
    fetch(`${import.meta.env.VITE_API_URL}/ranking-resumen?${params}`, { headers: cabeceraAuth() })
      .then(r => r.json())
      .then(filas => vigente && setEstado({ clave, data: conNombres(comoLista(filas)) }))
      .catch(console.error);
    return () => { vigente = false; };
  }, [clave]);

  const vigente = clave && estado.clave === clave;
  return { data: vigente ? estado.data : SIN_FILAS, loading: Boolean(clave) && !vigente };
}
