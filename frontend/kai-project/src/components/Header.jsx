import { NavLink } from "react-router-dom";
import logo from "../assets/logo.png"; // ajusta la ruta según donde guardes la imagen

export default function Header() {
  const navItems = [
    { label: "Ranking", to: "/ranking" },
    { label: "Tendencias", to: "/tendencias" },
    { label: "Simulación", to: "/simulacion" },
    { label: "Instituciones", to: "/instituciones" },
  ];

  return (
    <header className="flex justify-between items-center px-8 py-4 border-b border-outline/30 sticky top-0 bg-background z-50">

      <img
        src={logo}
        alt="KAI"
        style={{
          height: "40px",
          filter: "invert(1)",
          mixBlendMode: "screen",
        }}
      />

      <nav className="hidden md:flex gap-8">
        {navItems.map(({ label, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive
                ? "text-white border-b-2 border-white pb-1"
                : "text-outlineSoft hover:text-white transition-colors"
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-4">
        <button className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center" title="Perfil">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </button>
        <button className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center" title="Configuración">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        </button>
      </div>

    </header>
  );
}