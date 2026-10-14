import { useEffect, useState } from "react";
import { comoLista } from "./respuesta";
import { conNombres } from "../utils/universidades";
import { leer, pedir } from "./cache";

const RUTA = "/universidades";
const NOMBRE = "universidades";
const SIN_UNIVERSIDADES = [];
// Con sus tildes: la base guarda los nombres sin ellas (ver utils/universidades).
const transformar = (d) => conNombres(comoLista(d));

export function useUniversidades() {
  const [universidades, setUniversidades] = useState(SIN_UNIVERSIDADES);
  // El catálogo se pide una vez por sesión: cada módulo lo vuelve a leer de la caché.
  const enCache = leer(RUTA, NOMBRE);

  useEffect(() => {
    if (leer(RUTA, NOMBRE) !== undefined) return;
    let vigente = true;
    pedir(RUTA, transformar, NOMBRE)
      .then(d => vigente && setUniversidades(d))
      .catch(err => console.error(err));
    return () => { vigente = false; };
  }, []);

  return { universidades: enCache ?? universidades };
}
