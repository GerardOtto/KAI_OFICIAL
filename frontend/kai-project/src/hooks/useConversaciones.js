import { useCallback, useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";

const API = import.meta.env.VITE_API_URL;

/** El error de una respuesta fallida, con el motivo que da el servidor. */
async function errorDe(res) {
  let detalle = `HTTP ${res.status}`;
  try { detalle = (await res.json())?.detail || detalle; } catch { /* respuesta sin JSON */ }
  const err = new Error(detalle);
  err.status = res.status;
  return err;
}

async function pedir(ruta, opciones = {}) {
  const res = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers: { "Content-Type": "application/json", ...cabeceraAuth(), ...(opciones.headers || {}) },
  });
  if (!res.ok) throw await errorDe(res);
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

/** Catálogo de motores del asistente y cuál usar por defecto.
 *
 * El servidor es la única fuente: qué motores existen y cuáles tienen su clave
 * configurada depende del despliegue, no del cliente.
 */
export function useMotores(recargarCon) {
  const [motores, setMotores] = useState([]);
  const [porDefecto, setPorDefecto] = useState("claude");

  // `recargarCon` vuelve a pedir el catálogo cuando cambia algo que altera la
  // respuesta: con sesión iniciada, /motores informa además de si el plan del
  // usuario incluye cada motor, así que un cambio de plan o de sesión debe
  // reflejarse sin recargar la página.
  useEffect(() => {
    let vigente = true;
    pedir("/motores")
      .then((d) => {
        if (!vigente) return;
        setMotores(d.motores || []);
        if (d.por_defecto) setPorDefecto(d.por_defecto);
      })
      .catch((e) => console.error(e));
    return () => { vigente = false; };
  }, [recargarCon]);

  return { motores, porDefecto };
}

/** Planes que se ofrecen, para la portada. No requiere sesión. */
export function usePlanes() {
  const [planes, setPlanes] = useState([]);

  useEffect(() => {
    let vigente = true;
    pedir("/planes")
      .then((d) => { if (vigente) setPlanes(d || []); })
      .catch((e) => console.error(e));
    return () => { vigente = false; };
  }, []);

  return planes;
}

/** Envía un mensaje al asistente. Devuelve la respuesta y la cuota actualizada.
 *
 * `motor` solo se envía al abrir una conversación nueva; en una existente el
 * servidor usa el que quedó fijado y rechaza un motor distinto con un 409.
 */
export async function enviarMensaje(mensaje, idConversacion, motor) {
  return pedir("/chat", {
    method: "POST",
    body: JSON.stringify({
      mensaje,
      id_conversacion: idConversacion ?? null,
      motor: idConversacion == null ? motor : null,
    }),
  });
}

/** Igual que `enviarMensaje`, pero la respuesta llega en vivo (`/chat/stream`).
 *
 * `alEvento` recibe, a medida que llegan, los eventos `estado` (qué está
 * haciendo el modelo), `texto` (un trozo de la respuesta) y `reinicio` (descartar
 * el texto mostrado hasta ahora). La promesa se resuelve con el evento `fin`,
 * que trae lo mismo que devolvería `/chat` y es lo que vale: el texto en vivo es
 * una vista previa.
 *
 * Los rechazos previos al turno (sesión, plan, cuota, motor) llegan como un
 * error con su código HTTP, igual que en `enviarMensaje`.
 */
export async function enviarMensajeEnVivo(mensaje, idConversacion, motor, alEvento) {
  const res = await fetch(`${API}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cabeceraAuth() },
    body: JSON.stringify({
      mensaje,
      id_conversacion: idConversacion ?? null,
      motor: idConversacion == null ? motor : null,
    }),
  });
  if (!res.ok) throw await errorDe(res);

  const lector = res.body.getReader();
  const decodificador = new TextDecoder();
  let pendiente = "";
  let fin = null;
  try {
    for (;;) {
      const { value, done } = await lector.read();
      if (done) break;
      pendiente += decodificador.decode(value, { stream: true });
      // Cada evento SSE termina en una línea en blanco; lo que queda después
      // es un evento a medio llegar.
      let corte;
      while ((corte = pendiente.indexOf("\n\n")) >= 0) {
        const bloque = pendiente.slice(0, corte);
        pendiente = pendiente.slice(corte + 2);
        const datos = bloque.split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("\n");
        // Sin `data:` es un latido del servidor para mantener viva la conexión.
        if (!datos) continue;
        const evento = JSON.parse(datos);
        if (evento.tipo === "fin") fin = evento;
        else if (evento.tipo === "error") throw new Error(evento.detalle);
        else alEvento?.(evento);
      }
    }
  } catch (e) {
    if (e instanceof SyntaxError || e instanceof TypeError) throw conexionCortada();
    throw e;
  }
  if (!fin) throw conexionCortada();
  return fin;
}

/** El flujo terminó sin su cierre: se cayó la red o el servidor a mitad. El
 *  turno sigue en el servidor y, si termina, queda guardado. */
function conexionCortada() {
  const err = new Error(
    "Se cortó la conexión mientras llegaba la respuesta. Si el asistente alcanzó a terminarla, " +
    "aparecerá al abrir la conversación desde el historial.");
  err.cortada = true;
  return err;
}
