import { useEffect, useState } from "react";
export function useTiposMetrica() {
  const [tipos, setTipos] = useState([]);
  useEffect(() => {
    fetch("http://localhost:8000/tipos-metrica")
    //fetch(`${import.meta.env.VITE_API_URL}/api/datos`);
      .then(r => r.json())
      .then(setTipos)
      .catch(console.error);
  }, []);
  return tipos;
}