import { useState, useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import BotonGoogle from "../auth/BotonGoogle";

const campo =
  "w-full bg-surfaceHigh border border-outline/40 text-white py-3 px-4 text-sm placeholder:text-outlineSoft focus:outline-none focus:border-white transition-colors disabled:opacity-50";
const etiqueta =
  "text-[10px] uppercase tracking-widest text-outlineSoft mb-2 block";

export default function AuthModal({ onClose, onExito }) {
  const [tab, setTab] = useState("login"); // "login" | "register"
  const [form, setForm] = useState({ nombre: "", correo: "", clave: "", institucion: "" });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const ref = useRef(null);

  const { entrar, registrar, autenticado } = useAuth();

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

  // Cierra en cuanto la sesión queda establecida, venga de donde venga
  // (formulario o botón de Google, que resuelve de forma asíncrona).
  useEffect(() => {
    if (autenticado) { onExito?.(); onClose(); }
  }, [autenticado, onExito, onClose]);

  const cambiar = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setError("");
    setEnviando(true);
    try {
      if (tab === "login") {
        await entrar(form.correo, form.clave);
      } else {
        await registrar(form);
      }
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  const cambiarTab = (k) => { setTab(k); setError(""); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div ref={ref} className="w-full max-w-md bg-[#0e0e0e] border border-outline/30 relative">

        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 text-outlineSoft hover:text-white transition-colors z-10"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div className="flex border-b border-outline/20">
          {[["login", "Iniciar sesión"], ["register", "Registrarse"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => cambiarTab(key)}
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

        <form onSubmit={enviar} className="p-8 space-y-5">
          {tab === "register" && (
            <>
              <div>
                <label className={etiqueta} htmlFor="nombre">Nombre completo</label>
                <input id="nombre" type="text" autoComplete="name" required
                  placeholder="Nombre Apellido" className={campo}
                  value={form.nombre} onChange={cambiar("nombre")} disabled={enviando} />
              </div>
              <div>
                <label className={etiqueta} htmlFor="institucion">Institución (opcional)</label>
                <input id="institucion" type="text" autoComplete="organization"
                  placeholder="Universidad..." className={campo}
                  value={form.institucion} onChange={cambiar("institucion")} disabled={enviando} />
              </div>
            </>
          )}

          <div>
            <label className={etiqueta} htmlFor="correo">Correo electrónico</label>
            <input id="correo" type="email" autoComplete="email" required
              placeholder="correo@universidad.cl" className={campo}
              value={form.correo} onChange={cambiar("correo")} disabled={enviando} />
          </div>

          <div>
            <label className={etiqueta} htmlFor="clave">Contraseña</label>
            <input id="clave" type="password" required
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              minLength={tab === "register" ? 8 : undefined}
              placeholder="••••••••" className={campo}
              value={form.clave} onChange={cambiar("clave")} disabled={enviando} />
            {tab === "register" && (
              <p className="text-[10px] text-outlineSoft mt-1.5">Mínimo 8 caracteres.</p>
            )}
          </div>

          {error && (
            <p role="alert" className="text-[11px] text-negative leading-relaxed border-l-2 border-negative pl-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full py-3.5 bg-white text-black text-[11px] uppercase tracking-widest font-bold hover:bg-white/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {enviando
              ? "Un momento…"
              : tab === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>

          <BotonGoogle onError={setError} />
        </form>
      </div>
    </div>
  );
}
