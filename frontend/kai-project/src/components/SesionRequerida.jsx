import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthModal from "./AuthModal";

// Por qué pide cuenta cada módulo. El asistente tiene su propio motivo —gasta
// tokens de pago—; el resto comparte el de los datos por institución.
const MOTIVOS = {
  "/asistente": "El asistente consume un servicio de IA de pago, por lo que su uso se controla " +
    "por cuenta. Al iniciar sesión también se guardan tus conversaciones.",
};
const MOTIVO_GENERAL = "Los módulos de la plataforma trabajan sobre datos de instituciones " +
  "concretas, así que se consultan con una cuenta. El registro es gratuito.";

const boton = "px-4 py-3 whitespace-nowrap font-boton text-[13px] font-semibold uppercase tracking-wider transition-colors " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black";

/**
 * Aviso de que un módulo exige sesión, abierto sobre la página en la que se
 * está —en la práctica, la portada— en lugar de llevar a una pantalla de
 * bloqueo. Desde el propio aviso se inicia sesión o se crea la cuenta, y al
 * entrar se llega al módulo que se había elegido.
 *
 * `modulo` es { label, to }: `to` es la ruta exacta a la que ir después.
 */
export default function SesionRequerida({ modulo, onClose }) {
  const [paso, setPaso] = useState("aviso"); // aviso | login | register
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    if (paso !== "aviso") return undefined;
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [paso, onClose]);

  if (paso !== "aviso") {
    return <AuthModal inicial={paso} onClose={onClose} onExito={() => navigate(modulo.to)} />;
  }

  const clave = Object.keys(MOTIVOS).find((r) => modulo.to.startsWith(r));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm px-4">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="sesion-titulo"
           className="relative w-full max-w-lg bg-[#0e0e0e] border border-outline/30 p-8">
        <button onClick={onClose} aria-label="Cerrar"
                className="absolute top-4 right-4 text-outlineSoft hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="w-11 h-11 border border-white/30 flex items-center justify-center text-white/85 mb-5"
             aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="4" y="10" width="16" height="11" rx="1" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </div>

        <p className="text-[11px] uppercase tracking-[0.2em] text-outlineSoft mb-2">{modulo.label}</p>
        <h2 id="sesion-titulo" className="font-headline text-2xl text-white">
          Inicia sesión para usar este módulo
        </h2>
        <p className="mt-3 text-[14px] text-white/70 leading-relaxed">
          {clave ? MOTIVOS[clave] : MOTIVO_GENERAL}
        </p>

        <div className="mt-7 flex flex-col sm:flex-row gap-2.5">
          <button onClick={() => setPaso("login")} className={`${boton} flex-1 bg-white text-black hover:bg-white/85`}>
            Iniciar sesión
          </button>
          <button onClick={() => setPaso("register")}
                  className={`${boton} flex-1 border border-white/50 text-white hover:bg-white hover:text-black`}>
            Crear cuenta gratis
          </button>
        </div>

        <p className="mt-5 text-[12px] text-outlineSoft leading-relaxed">
          El plan gratuito incluye los rankings Scimago, Shanghai y KAI, el glosario y tres
          consultas de prueba al asistente.
        </p>
      </div>
    </div>
  );
}
