import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";

const SIN_ANIOS = {};

/** Años con datos de varios rankings a la vez, en el modo pedido: { id_ranking: [años] }.
 *
 * El glosario cruza todos los rankings, y cada uno tiene sus propias ediciones:
 * el selector de año ofrece la unión, y cada columna dice si tiene la elegida.
 * Conviene pasar solo los rankings que el plan abre: los demás responden 403.
 */
export function useAniosPorRanking(ids, modo = "puntajes") {
  const [estado, setEstado] = useState({ clave: "", mapa: SIN_ANIOS });
  const clave = ids.length ? `${ids.join(",")}|${modo}` : "";

  useEffect(() => {
    if (!clave) return;
    const [lista, m] = clave.split("|");
    let vigente = true;
    Promise.all(
      lista.split(",").map(id =>
        fetch(`${import.meta.env.VITE_API_URL}/anios?ranking_id=${id}&modo=${m}`, { headers: cabeceraAuth() })
          .then(r => r.json())
          .then(d => [id, comoLista(d)])
          .catch(() => [id, []])
      )
    ).then(pares => vigente && setEstado({ clave, mapa: Object.fromEntries(pares) }));
    return () => { vigente = false; };
  }, [clave]);

  return clave && estado.clave === clave ? estado.mapa : SIN_ANIOS;
}
