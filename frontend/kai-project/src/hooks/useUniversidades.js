import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";
import { conNombres } from "../utils/universidades";

export function useUniversidades() {
  const [universidades, setUniversidades] = useState([]);

  useEffect(() => {
    let vigente = true;
    fetch(`${import.meta.env.VITE_API_URL}/universidades`, { headers: cabeceraAuth() })
      .then(res => res.json())
      // Con sus tildes: la base guarda los nombres sin ellas (ver utils/universidades).
      .then(data => vigente && setUniversidades(conNombres(comoLista(data))))
      .catch(err => console.error(err));
    return () => { vigente = false; };
  }, []);

  return { universidades };
}
