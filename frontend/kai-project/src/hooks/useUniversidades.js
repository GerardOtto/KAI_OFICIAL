import { useEffect, useState } from "react";

export function useUniversidades() {
  const [universidades, setUniversidades] = useState([]);

  useEffect(() => {
    fetch("http://localhost:8000/universidades") // ⚠️ usa este endpoint
      .then(res => res.json())
      .then(data => {
        setUniversidades(data); // ✅ sin transformar
      })
      .catch(err => console.error(err));
  }, []);

  return { universidades };
}