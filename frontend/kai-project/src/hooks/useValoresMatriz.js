import { useEffect, useState } from "react";

// Mismo patrón que useMetricasMatriz: pide /valores-metrica-universidad por
// cada tipo en paralelo para poblar los valores de la institución elegida
// en toda la matriz, no solo en una categoría a la vez.
export function useValoresMatriz(tipos, universidadId, anio) {
  const [valoresMap, setValoresMap] = useState({});
  const [loading, setLoading] = useState(false);

  const tiposKey = tipos.join(",");

  useEffect(() => {
    if (!tipos.length || !universidadId || !anio) {
      setValoresMap({});
      return;
    }
    setLoading(true);
    Promise.all(
      tipos.map(tipo =>
        fetch(`${import.meta.env.VITE_API_URL}/valores-metrica-universidad?tipo=${encodeURIComponent(tipo)}&universidad_id=${universidadId}&anio=${anio}`)
          .then(r => r.json())
          .catch(() => [])
      )
    ).then(porTipo => {
      const map = {};
      porTipo.flat().forEach(v => { map[v.id_metrica] = v.valor_metrica; });
      setValoresMap(map);
      setLoading(false);
    });
  }, [tiposKey, universidadId, anio]);

  return { valoresMap, loading };
}
