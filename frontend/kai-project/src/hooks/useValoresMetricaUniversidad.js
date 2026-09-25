import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";
export function useValoresMetricaUniversidad(tipo, universidadId, anio) {
  const [data, setData] = useState([]);
  useEffect(() => {
    if (!tipo || !universidadId || !anio) { setData([]); return; }
    fetch(`${import.meta.env.VITE_API_URL}/valores-metrica-universidad?tipo=${encodeURIComponent(tipo)}&universidad_id=${universidadId}&anio=${anio}`, { headers: cabeceraAuth() })
      .then(r => r.json())
      .then(d => setData(comoLista(d)))
      .catch(console.error);
  }, [tipo, universidadId, anio]);
  return data;
}
