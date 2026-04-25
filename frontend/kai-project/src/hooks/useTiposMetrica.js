import { useEffect, useState } from "react";
export function useTiposMetrica() {
  const [tipos, setTipos] = useState([]);
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/tipos-metrica`)
      .then(r => r.json())
      .then(setTipos)
      .catch(console.error);
  }, []);
  return tipos;
}