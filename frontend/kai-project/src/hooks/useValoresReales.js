import { useEffect, useState } from "react";
import { conNombres } from "../utils/universidades";
import { leer, pedir } from "./cache";

const NOMBRE = "valores-reales";
// Un rechazo trae su motivo en `detail`; la caché no lo guarda (solo las
// respuestas correctas), así que se vuelve a intentar la próxima vez.
const transformar = (cuerpo, r) => (r.ok
  ? { datos: { ...cuerpo, valores: conNombres(cuerpo?.valores) }, error: null }
  : { datos: null, error: cuerpo?.detail || `Error ${r.status}` });

/** Valores medidos de un ranking en un año, para el modo numérico.
 *
 * Como en el reponderado, el resultado queda ligado a la petición que lo
 * produjo: al cambiar de ranking o de año lo anterior deja de valer solo, sin
 * vaciarlo dentro del efecto. Con caché: el Resumen lo pide aunque se esté en
 * «Puntajes», y al pasar a «Valores» la tabla ya está.
 */
export function useValoresReales(rankingId, anio, activo) {
  const [estado, setEstado] = useState({ ruta: "", datos: null, error: null });
  const ruta = activo && rankingId && anio ? `/valores-reales?ranking_id=${rankingId}&anio=${anio}` : "";
  const enCache = leer(ruta, NOMBRE);

  useEffect(() => {
    if (!ruta || leer(ruta, NOMBRE) !== undefined) return;
    let vigente = true;
    pedir(ruta, transformar, NOMBRE)
      .then(({ datos, error }) => vigente && setEstado({ ruta, datos, error }))
      .catch((e) => vigente && setEstado({ ruta, datos: null, error: e.message }));
    return () => { vigente = false; };
  }, [ruta]);

  if (enCache !== undefined) return { ...enCache, loading: false };
  const vigente = ruta && estado.ruta === ruta;
  return {
    datos: vigente ? estado.datos : null,
    error: vigente ? estado.error : null,
    loading: Boolean(ruta) && !vigente,
  };
}
