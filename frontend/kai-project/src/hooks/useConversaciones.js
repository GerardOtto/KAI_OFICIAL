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
    const err = new Error(detalle);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

/** Listado de conversaciones del usuario y operaciones sobre ellas. */
export function useConversaciones(autenticado) {
  const [conversaciones, setConversaciones] = useState([]);
  const [cargando, setCargando] = useState(false);

  const recargar = useCallback(async () => {
    if (!autenticado) { setConversaciones([]); return; }
    setCargando(true);
    try {
      setConversaciones(await pedir("/conversaciones"));
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }, [autenticado]);

  useEffect(() => { recargar(); }, [recargar]);

  const eliminar = useCallback(async (id) => {
    await pedir(`/conversaciones/${id}`, { method: "DELETE" });
    setConversaciones((prev) => prev.filter((c) => c.id_conversacion !== id));
  }, []);

  const renombrar = useCallback(async (id, titulo) => {
    await pedir(`/conversaciones/${id}`, { method: "PATCH", body: JSON.stringify({ titulo }) });
    setConversaciones((prev) =>
      prev.map((c) => (c.id_conversacion === id ? { ...c, titulo } : c)));
  }, []);

  const abrir = useCallback((id) => pedir(`/conversaciones/${id}`), []);

  return { conversaciones, cargando, recargar, eliminar, renombrar, abrir };
}

/** Envía un mensaje al asistente. Devuelve la respuesta y la cuota actualizada. */
export async function enviarMensaje(mensaje, idConversacion) {
  return pedir("/chat", {
    method: "POST",
    body: JSON.stringify({ mensaje, id_conversacion: idConversacion ?? null }),
  });
}
