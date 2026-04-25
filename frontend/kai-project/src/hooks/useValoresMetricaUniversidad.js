import { useEffect, useState } from "react";
export function useValoresMetricaUniversidad(tipo, universidadId, anio) {
  const [data, setData] = useState([]);
  useEffect(() => {
    if (!tipo || !universidadId || !anio) { setData([]); return; }
    fetch(`${import.meta.env.VITE_API_URL}/valores-metrica-universidad?tipo=${encodeURIComponent(tipo)}&universidad_id=${universidadId}&anio=${anio}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, [tipo, universidadId, anio]);
  return data;
}