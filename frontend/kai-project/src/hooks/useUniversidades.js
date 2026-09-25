import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";

export function useUniversidades() {
  const [universidades, setUniversidades] = useState([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/universidades`, { headers: cabeceraAuth() }) //  usa este endpoint
      .then(res => res.json())
      .then(data => {
        setUniversidades(comoLista(data));
      })
      .catch(err => console.error(err));
  }, []);

  return { universidades };
}
