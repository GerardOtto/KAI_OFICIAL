import { useCallback, useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";

const API = import.meta.env.VITE_API_URL;

async function pedir(ruta, opciones = {}) {
  const res = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers: { "Content-Type": "application/json", ...cabeceraAuth(), ...(opciones.headers || {}) },
  });
  if (!res.ok) {
    let detalle = `HTTP ${res.status}`;
    try { detalle = (await res.json())?.detail || detalle; } catch { /* respuesta sin JSON */ }
    throw new Error(detalle);
  }
  return res.status === 204 ? null : res.json();
}

// Una sola copia por pestaña: Tendencias y Simulación muestran los mismos grupos,
// y guardar en una vista debe verse en la otra sin volver a pedirlos.
// Se asocia a la sesión que la pidió: si en la misma pestaña entra otra cuenta,
// se vuelve a pedir en vez de mostrarle los grupos de la anterior.
let compartidos = null;
let sesion = null;
const oyentes = new Set();
const publicar = (lista) => { compartidos = lista; oyentes.forEach(f => f(lista)); };

/** Grupos de comparación guardados por la cuenta (migración 022). */
export function useGrupos() {
  const actual = cabeceraAuth().Authorization || "";
  const [grupos, setGrupos] = useState(sesion === actual ? compartidos || [] : []);
  const [error, setError] = useState("");

  useEffect(() => {
    oyentes.add(setGrupos);
    if (compartidos === null || sesion !== actual) {
      sesion = actual;
      compartidos = null;
      pedir("/grupos").then(publicar).catch(() => publicar([]));
    }
    return () => { oyentes.delete(setGrupos); };
  }, [actual]);

  const guardar = useCallback(async (nombre, universidades) => {
    setError("");
    try {
      const nuevo = await pedir("/grupos", { method: "POST", body: JSON.stringify({ nombre, universidades }) });
      const resto = (compartidos || []).filter(g => g.nombre.toLowerCase() !== nuevo.nombre.toLowerCase());
      publicar([...resto, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, []);

  const eliminar = useCallback(async (id) => {
    setError("");
    try {
      await pedir(`/grupos/${id}`, { method: "DELETE" });
      publicar((compartidos || []).filter(g => g.id_grupo !== id));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  return { grupos, guardar, eliminar, error };
}
