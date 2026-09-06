import { useEffect, useState } from "react";

const MIN_CARACTERES = 2;
const RETARDO_MS = 180;

// Autocompletado del buscador de investigadores. Consulta ligera y con retardo:
// no dispara una petición por pulsación, y aborta la anterior si llega otra.
export function useSugerenciasCientificos(fuente, termino, { activo = true } = {}) {
  const [sugerencias, setSugerencias] = useState({ investigadores: [], topicos: [] });
  const [cargando, setCargando] = useState(false);

  const q = (termino || "").trim();

  useEffect(() => {
    if (!activo || !fuente || q.length < MIN_CARACTERES) {
      setSugerencias({ investigadores: [], topicos: [] });
      setCargando(false);
      return;
    }

    const control = new AbortController();
    setCargando(true);

    const id = setTimeout(() => {
      const params = new URLSearchParams({ fuente, q, limite: "6" });
      fetch(`${import.meta.env.VITE_API_URL}/cientificos-sugerencias?${params}`, {
        signal: control.signal,
      })
        .then(r => r.json())
        .then(d => {
          setSugerencias({
            investigadores: d?.investigadores ?? [],
            topicos: d?.topicos ?? [],
          });
          setCargando(false);
        })
        .catch(err => {
          if (err.name === "AbortError") return;
          console.error(err);
          setSugerencias({ investigadores: [], topicos: [] });
          setCargando(false);
        });
    }, RETARDO_MS);

    return () => { clearTimeout(id); control.abort(); };
  }, [fuente, q, activo]);

  return { sugerencias, cargando };
}
