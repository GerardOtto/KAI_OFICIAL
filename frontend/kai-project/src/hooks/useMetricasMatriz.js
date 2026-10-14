import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";

const SIN_MATRIZ = {};

// Trae, en paralelo, las métricas de cada tipo (dimensión) — reutiliza el
// mismo endpoint /metricas-por-tipo que ya usa la vista por categorías,
// solo que aquí se piden todos los tipos a la vez para armar la matriz
// completa (filas = dimensión, columnas = ranking).
export function useMetricasMatriz(tipos) {
  const [estado, setEstado] = useState({ clave: "", matriz: SIN_MATRIZ });
  const clave = tipos.join("~");

  useEffect(() => {
    if (!clave) return;
    let vigente = true;
    Promise.all(
      clave.split("~").map(tipo =>
        fetch(`${import.meta.env.VITE_API_URL}/metricas-por-tipo?tipo=${encodeURIComponent(tipo)}`, { headers: cabeceraAuth() })
          .then(r => r.json())
          .then(data => [tipo, comoLista(data)])
          .catch(() => [tipo, []])
      )
    ).then(entries => vigente && setEstado({ clave, matriz: Object.fromEntries(entries) }));
    return () => { vigente = false; };
  }, [clave]);

  const vigente = clave && estado.clave === clave;
  return { matriz: vigente ? estado.matriz : SIN_MATRIZ, loading: Boolean(clave) && !vigente };
}
