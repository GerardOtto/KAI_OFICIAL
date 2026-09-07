import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";

const SRC_GIS = "https://accounts.google.com/gsi/client";

/** Carga el script de Google Identity Services una sola vez por página. */
function cargarGIS() {
  if (window.google?.accounts?.id) return Promise.resolve();
  const existente = document.querySelector(`script[src="${SRC_GIS}"]`);
  if (existente) {
    return new Promise((res, rej) => {
      existente.addEventListener("load", res, { once: true });
      existente.addEventListener("error", () => rej(new Error("no se pudo cargar")), { once: true });
    });
  }
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = SRC_GIS;
    s.async = true;
    s.defer = true;
    s.onload = res;
    s.onerror = () => rej(new Error("no se pudo cargar Google Identity Services"));
    document.head.appendChild(s);
  });
}

/**
 * Botón oficial de Google. Devuelve un ID token firmado por Google que el
 * backend verifica; el navegador nunca maneja secretos de OAuth.
 *
 * No se renderiza si el servidor no tiene configurado GOOGLE_CLIENT_ID.
 */
export default function BotonGoogle({ onError }) {
  const { googleClientId, entrarConGoogle } = useAuth();
  const contenedor = useRef(null);
  const [estado, setEstado] = useState("cargando"); // cargando | listo | error

  useEffect(() => {
    if (!googleClientId || !contenedor.current) return;
    let cancelado = false;

    cargarGIS()
      .then(() => {
        if (cancelado || !contenedor.current) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async ({ credential }) => {
            try {
              await entrarConGoogle(credential);
            } catch (e) {
              onError?.(e.message);
            }
          },
        });
        window.google.accounts.id.renderButton(contenedor.current, {
          theme: "filled_black",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          locale: "es",
          width: 330,
        });
        setEstado("listo");
      })
      .catch(() => { if (!cancelado) setEstado("error"); });

    return () => { cancelado = true; };
  }, [googleClientId, entrarConGoogle, onError]);

  if (!googleClientId) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-outline/30" />
        <span className="text-[9px] uppercase tracking-widest text-outlineSoft">o</span>
        <div className="h-px flex-1 bg-outline/30" />
      </div>
      <div ref={contenedor} className="flex justify-center min-h-[44px]" />
      {estado === "error" && (
        <p className="text-[10px] text-center text-negative">
          No se pudo cargar el acceso con Google. Revisa tu conexión.
        </p>
      )}
    </div>
  );
}
