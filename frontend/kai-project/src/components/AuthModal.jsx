import { useState, useEffect, useRef } from "react";

export default function AuthModal({ onClose }) {
  const [tab, setTab] = useState("login"); // "login" | "register"
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div ref={ref} className="w-full max-w-md bg-[#0e0e0e] border border-outline/30 relative">

        {/* Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-outlineSoft hover:text-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Tabs */}
        <div className="flex border-b border-outline/20">
          {[["login", "Iniciar sesión"], ["register", "Registrarse"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-4 text-[11px] uppercase tracking-widest transition-colors ${
                tab === key
                  ? "text-white border-b-2 border-white -mb-px"
                  : "text-outlineSoft hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-8 space-y-5">
          {tab === "login" ? (
            <>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-outlineSoft mb-2 block">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  placeholder="correo@universidad.cl"
                  disabled
                  className="w-full bg-surfaceHigh border border-outline/40 text-white py-3 px-4 text-sm placeholder:text-outlineSoft focus:outline-none focus:border-white cursor-not-allowed opacity-60"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-outlineSoft mb-2 block">
                  Contraseña
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  disabled
                  className="w-full bg-surfaceHigh border border-outline/40 text-white py-3 px-4 text-sm placeholder:text-outlineSoft focus:outline-none focus:border-white cursor-not-allowed opacity-60"
                />
              </div>
              <button
                disabled
                className="w-full py-3.5 bg-white text-black text-[11px] uppercase tracking-widest font-bold opacity-50 cursor-not-allowed mt-2"
              >
                Iniciar sesión
              </button>
              <p className="text-[10px] text-center text-outlineSoft uppercase tracking-wider">
                Autenticación en desarrollo
              </p>
            </>
          ) : (
            <>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-outlineSoft mb-2 block">
                  Nombre completo
                </label>
                <input
                  type="text"
                  placeholder="Nombre Apellido"
                  disabled
                  className="w-full bg-surfaceHigh border border-outline/40 text-white py-3 px-4 text-sm placeholder:text-outlineSoft focus:outline-none cursor-not-allowed opacity-60"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-outlineSoft mb-2 block">
                  Correo institucional
                </label>
                <input
                  type="email"
                  placeholder="correo@universidad.cl"
                  disabled
                  className="w-full bg-surfaceHigh border border-outline/40 text-white py-3 px-4 text-sm placeholder:text-outlineSoft focus:outline-none cursor-not-allowed opacity-60"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-outlineSoft mb-2 block">
                  Institución
                </label>
                <input
                  type="text"
                  placeholder="Universidad..."
                  disabled
                  className="w-full bg-surfaceHigh border border-outline/40 text-white py-3 px-4 text-sm placeholder:text-outlineSoft focus:outline-none cursor-not-allowed opacity-60"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-outlineSoft mb-2 block">
                  Contraseña
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  disabled
                  className="w-full bg-surfaceHigh border border-outline/40 text-white py-3 px-4 text-sm placeholder:text-outlineSoft focus:outline-none cursor-not-allowed opacity-60"
                />
              </div>
              <button
                disabled
                className="w-full py-3.5 bg-white text-black text-[11px] uppercase tracking-widest font-bold opacity-50 cursor-not-allowed mt-2"
              >
                Crear cuenta
              </button>
              <p className="text-[10px] text-center text-outlineSoft uppercase tracking-wider">
                Registro en desarrollo
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}