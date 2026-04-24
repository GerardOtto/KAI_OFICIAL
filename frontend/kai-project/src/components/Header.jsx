import { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

const NAV = [
  {
    label: "Rankings",
    to: "/ranking",
    items: [
      { label: "Resumen", to: "/ranking" },
      { label: "Times Higher Education", to: "/ranking?r=1" },
      { label: "Shanghai GRAS", to: "/ranking?r=2" },
      { label: "QS Latam", to: "/ranking?r=3" },
      { label: "SCImago", to: "/ranking?r=4" },
    ]
  },
  {
    label: "Tendencias",
    to: "/tendencias",
    items: [
      { label: "Tendencias históricas", to: "/tendencias" },
      { label: "Pronóstico de tendencias", to: null },
      { label: "Pronóstico inteligente", to: null },
    ]
  },
  {
    label: "Simulación",
    to: "/simulacion",
    items: [
      { label: "Simulador de métricas", to: "/simulacion" },
    ]
  },
  {
    label: "Instituciones",
    to: "/instituciones",
    items: [
      { label: "Nacional", to: null },
      { label: "Continental", to: null },
      { label: "Internacional", to: null },
    ]
  },
];

function DropdownMenu({ items, onClose }) {
  return (
    <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-[#1a1a1a] border border-outline/30 z-50 py-1 shadow-xl">
      {items.map(item => (
        item.to ? (
          <NavLink
            key={item.label}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `block px-5 py-3 text-[11px] uppercase tracking-widest transition-colors ${
                isActive ? "text-white bg-white/10" : "text-outlineSoft hover:text-white hover:bg-white/5"
              }`
            }
          >
            {item.label}
          </NavLink>
        ) : (
          <div
            key={item.label}
            className="block px-5 py-3 text-[11px] uppercase tracking-widest text-outline/40 cursor-not-allowed select-none flex items-center justify-between"
          >
            <span>{item.label}</span>
            <span className="text-[9px] normal-case tracking-normal text-outline/30 ml-3">Próximo</span>
          </div>
        )
      ))}
    </div>
  );
}

export default function Header() {
  const [openMenu, setOpenMenu] = useState(null);
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header ref={ref} className="flex justify-between items-center px-8 h-16 border-b border-outline/30 sticky top-0 bg-background z-50">

      <img
        src={logo}
        alt="KAI"
        onClick={() => navigate("/ranking")}
        style={{ height: "36px", filter: "invert(1)", mixBlendMode: "screen", cursor: "pointer" }}
      />

      <nav className="hidden md:flex items-center h-full gap-1">
        {NAV.map(section => (
          <div key={section.label} className="relative h-full flex items-center">
            <button
              onClick={() => setOpenMenu(openMenu === section.label ? null : section.label)}
              onMouseEnter={() => setOpenMenu(section.label)}
              className={`flex items-center gap-1.5 px-4 h-full text-[11px] uppercase tracking-widest transition-colors ${
                openMenu === section.label ? "text-white" : "text-outlineSoft hover:text-white"
              }`}
            >
              {section.label}
              <svg
                width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transition: "transform 0.2s", transform: openMenu === section.label ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            {openMenu === section.label && (
              <DropdownMenu items={section.items} onClose={() => setOpenMenu(null)} />
            )}
          </div>
        ))}

        <NavLink
          to="/metricas"
          className={({ isActive }) =>
            `flex items-center px-4 h-full text-[11px] uppercase tracking-widest transition-colors ${
              isActive ? "text-white border-b-2 border-white" : "text-outlineSoft hover:text-white"
            }`
          }
        >
          Métricas
        </NavLink>
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