import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";
export function useTiposMetrica() {
  const [tipos, setTipos] = useState([]);
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/tipos-metrica`, { headers: cabeceraAuth() })
      .then(r => r.json())
      .then(d => setTipos(comoLista(d)))
      .catch(console.error);
  }, []);
  return tipos;
}
