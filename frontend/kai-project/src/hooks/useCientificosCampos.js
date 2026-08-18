import { useEffect, useState } from "react";

export function useCientificosCampos() {
  const [campos, setCampos] = useState([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/cientificos-campos`)
      .then(r => r.json())
      .then(setCampos)
      .catch(console.error);
  }, []);

  return campos;
}
