import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

/** Catálogo de instituciones, pedido una vez por carga de la aplicación.
 *
 * Son todas las universidades del sistema, tengan datos cargados o no: una
 * persona pertenece a la suya con independencia de cuántas mediciones tengamos
 * de ella, y una lista recortada obligaría a quien no aparece a elegir una
 * institución que no es la suya.
 *
 * Se cachea en el módulo porque el registro y el aviso de institución pendiente
 * montan el mismo desplegable y no tiene sentido pedirlo dos veces.
 */
let cache = null;

export function useInstituciones() {
  const [instituciones, setInstituciones] = useState(cache || []);
  const [error, setError] = useState("");

  useEffect(() => {
    if (cache) return undefined;
    let vigente = true;
    fetch(`${API}/instituciones`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no disponible"))))
      .then((d) => {
        cache = d;
        if (vigente) setInstituciones(d);
      })
      .catch(() => { if (vigente) setError("No se pudo cargar la lista de instituciones."); });
    return () => { vigente = false; };
  }, []);

  return { instituciones, error };
}
