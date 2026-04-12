import { useEffect, useState } from "react";

export function useUniversidades() {
  const [universidades, setUniversidades] = useState([]);

  useEffect(() => {
    fetch("http://localhost:8000/universidades")
      .then(res => res.json())
      .then(setUniversidades)
      .catch(console.error);
  }, []);

  return universidades;
}