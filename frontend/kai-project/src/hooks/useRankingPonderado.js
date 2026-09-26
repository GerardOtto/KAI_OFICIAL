import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";
import { metricasDe } from "../utils/rankingPonderado";

const VACIO = { porAnio: {}, metricas: [] };

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
 * ranking, lo anterior deja de valer sin tener que vaciarlo a mano.
 */
export function useRankingPonderado(rankingId, anios, activo) {
  const [estado, setEstado] = useState({ clave: "", ...VACIO });

  const clave = activo && rankingId && anios.length
    ? `${rankingId}|${[...anios].sort((a, b) => a - b).join(",")}` : "";

  useEffect(() => {
    if (!clave) return;
    const [id, lista] = clave.split("|");
    let vigente = true;

    Promise.all(
      lista.split(",").map(Number).map((anio) =>
        fetch(`${import.meta.env.VITE_API_URL}/simulacion?ranking_id=${id}&anio=${anio}`,
              { headers: cabeceraAuth() })
          .then((r) => r.json())
          .then((d) => [anio, comoLista(d)])
          .catch(() => [anio, []])
      )
    ).then((pares) => {
      // Si el usuario cambió de ranking mientras esto viajaba, se descarta.
      if (!vigente) return;
      setEstado({
        clave,
        porAnio: Object.fromEntries(pares),
        metricas: metricasDe(pares.flatMap(([, filas]) => filas)),
      });
    });

    return () => { vigente = false; };
  }, [clave]);

  const vigente = clave && estado.clave === clave;
  return {
    ...(vigente ? estado : VACIO),
    loading: Boolean(clave) && !vigente,
  };
}
