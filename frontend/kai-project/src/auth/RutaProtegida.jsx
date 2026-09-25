import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import AuthModal from "../components/AuthModal";

/**
 * Envuelve una vista que exige sesión iniciada. En lugar de redirigir a otra
 * página, muestra un aviso y el modal de acceso sobre el propio módulo, de modo
 * que al entrar el usuario queda donde quería estar.
 */
export default function RutaProtegida({ children, motivo }) {
  const { autenticado, cargando } = useAuth();
  const [modal, setModal] = useState(false);
  const navigate = useNavigate();

  if (cargando) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-outlineSoft text-sm">
        Verificando sesión…
      </div>
    );
  }

  if (autenticado) return children;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-8">
      <div className="max-w-md text-center flex flex-col items-center gap-5">
        <div className="w-12 h-12 border border-outline/40 flex items-center justify-center text-outlineSoft">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
        <div>
          <h2 className="font-headline text-[24px] font-semibold text-white mb-2">
            Necesitas una cuenta
          </h2>
          <p className="font-body text-[12.5px] text-[#8a8a8a] leading-relaxed">
            {motivo || "Los módulos de la plataforma trabajan sobre datos de instituciones "
                     + "concretas, así que se consultan con una cuenta. El registro es gratuito."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModal(true)}
            className="px-5 py-2.5 bg-white text-black text-[11px] uppercase tracking-widest font-bold hover:bg-white/85 transition-colors"
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => navigate("/")}
            className="px-5 py-2.5 border border-outline/40 text-[11px] uppercase tracking-widest text-[#c4c4c4] hover:text-white hover:border-white/40 transition-colors"
          >
            Volver a la portada
          </button>
        </div>
        <p className="font-body text-[10.5px] text-[#6f6f6f]">
          El plan gratuito incluye los rankings de Scimago y Shanghai, el glosario y una
          consulta al asistente cada tres días.
        </p>
      </div>

      {modal && <AuthModal onClose={() => setModal(false)} />}
    </div>
  );
}
