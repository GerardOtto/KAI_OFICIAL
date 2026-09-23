import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/logo.png";
import { useAuth } from "../auth/AuthContext";
import AuthModal from "./AuthModal";

// Los modos de Simulación se eligen dentro del propio módulo, con el mismo
// selector que las vistas de Tendencias; aquí basta un enlace a la sección.
// /simulacion redirige al modo por defecto.
const NAV = [
  { label: "Asistente", to: "/asistente" },
  { label: "Tendencias", to: "/tendencias" },
  { label: "Simulación", to: "/simulacion" },
  { label: "Glosario", to: "/metricas" },
  { label: "Resumen", to: "/ranking" },
];

const navLinkClass = ({ isActive }) =>
  `flex items-center px-4 h-full text-[11px] uppercase tracking-widest transition-colors ${
    isActive ? "text-white border-b-2 border-white" : "text-outlineSoft hover:text-white"
  }`;

function MenuCompacto() {
  const navigate = useNavigate();
  const location = useLocation();
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="relative lg:hidden">
      <button
        onClick={() => setAbierto(v => !v)}
        aria-label="Menú de navegación"
        aria-expanded={abierto}
        className="flex items-center gap-1.5 px-3 py-2 border border-white/20 text-[10px] uppercase tracking-widest text-[#c4c4c4] hover:bg-white hover:text-black hover:border-white transition-colors"
      >
        Menú
        <span className="text-[8px]">▾</span>
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
          <div className="absolute top-full left-0 mt-2 w-[250px] bg-[#1a1a1a] border border-white/[.16] shadow-[0_16px_40px_rgba(0,0,0,.55)] p-1.5 z-40">
            {/* Misma lista que el nav ancho. Se compara por prefijo para que
                /simulacion/unitaria marque «Simulación» como actual. */}
            {NAV.map(d => {
              const esActual = location.pathname.startsWith(d.to);
              return (
                <button
                  key={d.to}
                  onClick={() => { navigate(d.to); setAbierto(false); }}
                  className={`w-full text-left px-3 py-2 font-body text-[12px] transition-colors ${
                    esActual ? "bg-white/[.08] text-white" : "text-[#dcdcdc] hover:bg-white/[.05]"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function MenuUsuario() {
  const { usuario, cuota, cerrarSesion } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [modal, setModal] = useState(false);
  const navigate = useNavigate();

  if (!usuario) {
    return (
      <>
        <button
          onClick={() => setModal(true)}
          className="px-3.5 py-2 border border-white/20 text-[10px] uppercase tracking-widest text-[#c4c4c4] hover:bg-white hover:text-black hover:border-white transition-colors"
        >
          Iniciar sesión
        </button>
        {modal && <AuthModal onClose={() => setModal(false)} />}
      </>
    );
  }

  const iniciales = usuario.nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
  const pct = cuota?.tokens_mensuales
    ? Math.min(100, (cuota.tokens_total / cuota.tokens_mensuales) * 100)
    : 0;

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto(v => !v)}
        title={usuario.correo}
        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center overflow-hidden"
      >
        {usuario.avatar
          ? <img src={usuario.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          : <span className="font-body font-semibold text-[10px] text-white">{iniciales}</span>}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
          <div className="absolute top-full right-0 mt-2 w-[266px] bg-[#1a1a1a] border border-white/[.16] shadow-[0_16px_40px_rgba(0,0,0,.55)] z-40">
            <div className="px-4 py-3 border-b border-white/[.08]">
              <p className="font-body font-semibold text-[12.5px] text-white truncate">{usuario.nombre}</p>
              <p className="font-body text-[11px] text-[#8a8a8a] truncate">{usuario.correo}</p>
              <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[#6f6f6f] mt-1.5">
                Plan {usuario.nombre_plan || usuario.plan}
                {usuario.con_google && " · Google"}
              </p>
            </div>

            {cuota && (
              <div className="px-4 py-3 border-b border-white/[.08]">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-[.14em] text-[#7f7f7f]">Tokens del mes</span>
                  <span className="font-mono text-[10px] text-[#c4c4c4]">
                    {cuota.tokens_total.toLocaleString("es-CL")}
                    {cuota.tokens_mensuales != null && ` / ${cuota.tokens_mensuales.toLocaleString("es-CL")}`}
                  </span>
                </div>
                <div className="h-[3px] bg-white/[.08]">
                  <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
                </div>
                {cuota.mensajes_por_dia != null && (
                  <p className="font-mono text-[9px] text-[#6f6f6f] mt-1.5">
                    {cuota.mensajes_hoy} de {cuota.mensajes_por_dia} consultas hoy
                  </p>
                )}
              </div>
            )}

            <button
              onClick={() => { setAbierto(false); navigate("/asistente"); }}
              className="w-full text-left px-4 py-2.5 font-body text-[12px] text-[#dcdcdc] hover:bg-white/[.05] transition-colors"
            >
              Mis conversaciones
            </button>
            <button
              onClick={() => { setAbierto(false); cerrarSesion(); navigate("/"); }}
              className="w-full text-left px-4 py-2.5 font-body text-[12px] text-[#dcdcdc] hover:bg-white/[.05] transition-colors border-t border-white/[.08]"
            >
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Header() {
  const navigate = useNavigate();

  return (
    <header className="flex justify-between items-center px-8 h-16 border-b border-outline/30 sticky top-0 bg-background z-50">

      <img
        src={logo}
        alt="KAI"
        onClick={() => navigate("/")}
        style={{ height: "36px", filter: "invert(1)", mixBlendMode: "screen", cursor: "pointer" }}
      />

      {/* Desde `lg` y no desde `md`: el nav completo no cabe junto al logotipo y
          los controles de usuario en anchos de tableta, y condensarlo exigiría
          recortar el texto hasta volverlo ilegible. Por debajo de `lg` lo
          sustituye el menú compacto. */}
      <nav className="hidden lg:flex items-center h-full gap-1">
        {/* NavLink compara por prefijo: /simulacion/comparada activa «Simulación». */}
        {NAV.map(section => (
          <NavLink key={section.label} to={section.to} className={navLinkClass}>
            {section.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        {/* Sustituye al nav ancho por debajo de `lg`. Antes de esto no había
            navegación alguna en pantallas estrechas. */}
        <MenuCompacto />
        <MenuUsuario />
      </div>

    </header>
  );
}
