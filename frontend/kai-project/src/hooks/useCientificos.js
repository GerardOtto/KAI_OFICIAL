import { useEffect, useState } from "react";

export function useCientificos({ fuente, campo, universidadId, q, topico } = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fuente) params.set("fuente", fuente);
    if (campo) params.set("campo", campo);
    if (universidadId) params.set("universidad_id", universidadId);
    if (q) params.set("q", q);
    if (topico) params.set("topico", topico);

    fetch(`${import.meta.env.VITE_API_URL}/cientificos?${params.toString()}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(console.error);
  }, [fuente, campo, universidadId, q, topico]);

  return { data, loading };
}
