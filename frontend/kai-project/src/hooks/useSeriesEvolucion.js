import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { conNombres } from "../utils/universidades";

const SIN_FILAS = [];

// Vista "Evolución": una métrica a lo largo de los años, una serie por institución.
// Reusa /trends, pero acotando el payload a las instituciones seleccionadas y
// con dependencias estables (la lista viaja como string, no como array).
//
// Una respuesta que llega tarde no pisa a la vigente. Al cambiar de ranking, de
// métrica o de modo lo anterior deja de valer en el acto; al sumar o quitar una
// institución, el gráfico conserva lo que tenía hasta que llega lo nuevo, en vez
// de vaciarse en cada clic.
export function useSeriesEvolucion(rankingId, metricaId, universidadIds, modo = "puntajes") {
  const [estado, setEstado] = useState({ base: "", filas: SIN_FILAS, pedida: "" });

  const uniKey = (universidadIds || []).join(",");
  const base = rankingId && metricaId && uniKey ? `${rankingId}|${metricaId}|${modo}` : "";

  useEffect(() => {
    if (!base) return;
    const [id, metrica, m] = base.split("|");
    const query = new URLSearchParams({
      ranking_id: id,
      metrica_id: metrica,
      universidades: uniKey,
      modo: m,
    });

    let vigente = true;
    fetch(`${import.meta.env.VITE_API_URL}/trends?${query}`, { headers: cabeceraAuth() })
      .then(r => r.json())
      .then(res => vigente && setEstado({
        base, pedida: uniKey, filas: conNombres(Array.isArray(res?.data) ? res.data : []) }))
      .catch(err => {
        if (!vigente) return;
        console.error(err);
        setEstado({ base, pedida: uniKey, filas: SIN_FILAS });
      });

    return () => { vigente = false; };
  }, [base, uniKey]);

  const vigente = base && estado.base === base;
  return {
    filas: vigente ? estado.filas : SIN_FILAS,
    loading: Boolean(base) && !(vigente && estado.pedida === uniKey),
  };
}
