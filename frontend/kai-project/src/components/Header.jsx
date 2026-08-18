import { useRef, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/logo.png";

const NAV = [
  { label: "Resumen", to: "/ranking" },
  { label: "Tendencias", to: "/tendencias" },
];

const NAV_AFTER_SIM = [
  { label: "Científicos", to: "/cientificos" },
  { label: "Investigadores PUCV", to: "/investigadores-pucv" },
  { label: "Glosario", to: "/metricas" },
  { label: "Asistente", to: "/asistente" },
];

const MODOS_SIMULACION = [
  {
    modo: "unitaria",
    label: "Unitaria",
    sub: "Una institución · sliders",
    desc: "Ajusta cada métrica de tu institución con un slider y mira el efecto en su score y posición.",
  },
  {
    modo: "comparada",
    label: "Comparada",
    sub: "Varias instituciones · matriz",
    desc: "Edita celda por celda una matriz de instituciones y métricas; el ranking se reordena en vivo.",
  },
];

const navLinkClass = ({ isActive }) =>
  `flex items-center px-4 h-full text-[11px] uppercase tracking-widest transition-colors ${
    isActive ? "text-white border-b-2 border-white" : "text-outlineSoft hover:text-white"
  }`;

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimer = useRef(null);

  const enSimulacion = location.pathname.startsWith("/simulacion");
  const modoActivo = location.pathname.split("/")[2];

  const abrir = () => {
    clearTimeout(closeTimer.current);
    setMenuOpen(true);
  };
  const cerrarConDelay = () => {
    closeTimer.current = setTimeout(() => setMenuOpen(false), 120);
  };

  return (
    <header className="flex justify-between items-center px-8 h-16 border-b border-outline/30 sticky top-0 bg-background z-50">

      <img
        src={logo}
        alt="KAI"
        onClick={() => navigate("/")}
        style={{ height: "36px", filter: "invert(1)", mixBlendMode: "screen", cursor: "pointer" }}
      />

      <nav className="hidden md:flex items-center h-full gap-1">
        {NAV.map(section => (
          <NavLink key={section.label} to={section.to} className={navLinkClass}>
            {section.label}
          </NavLink>
        ))}

        <div
          className="relative h-full flex items-center"
          onMouseEnter={abrir}
          onMouseLeave={cerrarConDelay}
        >
          <button
            onClick={() => setMenuOpen(v => !v)}
            className={`relative flex items-center gap-1.5 px-4 h-full text-[11px] uppercase tracking-widest transition-colors ${
              enSimulacion ? "text-white" : "text-outlineSoft hover:text-white"
            }`}
          >
            Simulación
            <span className="text-[8px] text-outlineSoft">▾</span>
            {enSimulacion && (
              <span className="absolute left-4 right-4 bottom-0 h-[2px] bg-white" />
            )}
          </button>

          {menuOpen && (
            <div className="absolute top-full left-0 w-[330px] bg-[#1a1a1a] border border-white/[.16] shadow-[0_16px_40px_rgba(0,0,0,.55)] p-1.5 z-40">
              {MODOS_SIMULACION.map(m => (
                <button
                  key={m.modo}
                  onClick={() => { navigate(`/simulacion/${m.modo}`); setMenuOpen(false); }}
                  className={`w-full text-left px-3.5 py-3 transition-colors ${
                    modoActivo === m.modo ? "bg-white/[.08]" : "hover:bg-white/[.05]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-body font-semibold text-[12.5px] ${modoActivo === m.modo ? "text-white" : "text-[#dcdcdc]"}`}>
                      {m.label}
                    </span>
                    {modoActivo === m.modo && (
                      <span className="text-[9px] text-accent">✓ actual</span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#8a8a8a] mt-0.5">{m.sub}</div>
                  <div className="text-[10.5px] leading-relaxed text-[#6f6f6f] mt-1">{m.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {NAV_AFTER_SIM.map(section => (
          <NavLink key={section.label} to={section.to} className={navLinkClass}>
            {section.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <button
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
          title="Perfil"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </button>
        <button
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
          title="Configuración"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        </button>
      </div>

    </header>
  );
}
