import { useEffect, useState } from "react";

export function useCientificoTopicos(idCientifico) {
  const [topicos, setTopicos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!idCientifico) {
      setTopicos([]);
      return;
    }
    setLoading(true);
    fetch(`${import.meta.env.VITE_API_URL}/cientificos/${idCientifico}/topicos`)
      .then(r => r.json())
      .then(d => { setTopicos(d); setLoading(false); })
      .catch(console.error);
  }, [idCientifico]);

  return { topicos, loading };
}
