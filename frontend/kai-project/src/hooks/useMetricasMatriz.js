import { useEffect, useMemo, useState } from "react";
import { comoLista } from "./respuesta";
import { leer, pedir } from "./cache";

const SIN_MATRIZ = {};
const NOMBRE = "metricas-por-tipo";
const rutaTipo = (tipo) => `/metricas-por-tipo?tipo=${encodeURIComponent(tipo)}`;

// Trae, en paralelo, las métricas de cada tipo (dimensión) — reutiliza el
// mismo endpoint /metricas-por-tipo que ya usa la vista por categorías,
// solo que aquí se piden todos los tipos a la vez para armar la matriz
// completa (filas = dimensión, columnas = ranking). Con caché: volver al
// glosario no repite las peticiones.
export function useMetricasMatriz(tipos) {
  const [estado, setEstado] = useState({ clave: "", matriz: SIN_MATRIZ });
  const clave = tipos.join("~");
  const completo = tipos.length > 0 && tipos.every(t => leer(rutaTipo(t), NOMBRE) !== undefined);
  const desdeCache = useMemo(
    () => (completo ? Object.fromEntries(clave.split("~").map(t => [t, leer(rutaTipo(t), NOMBRE)])) : null),
    [completo, clave]
  );

  useEffect(() => {
    if (!clave || completo) return;
    let vigente = true;
    Promise.all(
      clave.split("~").map(tipo =>
        pedir(rutaTipo(tipo), comoLista, NOMBRE)
          .then(data => [tipo, data])
          .catch(() => [tipo, []]))
    ).then(entries => vigente && setEstado({ clave, matriz: Object.fromEntries(entries) }));
    return () => { vigente = false; };
  }, [clave, completo]);

  if (desdeCache) return { matriz: desdeCache, loading: false };
  const vigente = clave && estado.clave === clave;
  return { matriz: vigente ? estado.matriz : SIN_MATRIZ, loading: Boolean(clave) && !vigente };
}
