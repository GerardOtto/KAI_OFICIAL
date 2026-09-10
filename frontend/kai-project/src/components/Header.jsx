import { useRef, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/logo.png";
import { useAuth } from "../auth/AuthContext";
import AuthModal from "./AuthModal";

const NAV = [
  { label: "Asistente", to: "/asistente" },
  { label: "Tendencias", to: "/tendencias" },
];

const NAV_AFTER_DROPDOWNS = [
  { label: "Glosario", to: "/metricas" },
  { label: "Resumen", to: "/ranking" },
];

const OPCIONES_SIMULACION = [
  {
    to: "/simulacion/unitaria",
    label: "Unitaria",
    sub: "Una institución · sliders",
    desc: "Ajusta cada métrica de tu institución con un slider y mira el efecto en su score y posición.",
  },
  {
    to: "/simulacion/comparada",
    label: "Comparada",
    sub: "Varias instituciones · matriz",
    desc: "Edita celda por celda una matriz de instituciones y métricas; el ranking se reordena en vivo.",
  },
];

const OPCIONES_INVESTIGADORES = [
  {
    to: "/cientificos",
    label: "Científicos",
    sub: "Top 2% Mundial · Stanford/Elsevier",
    desc: "Investigadores chilenos en el ranking global de mayor impacto bibliométrico (índice-c, citas, índice H).",
  },
  {
    to: "/investigadores-pucv",
    label: "Investigadores PUCV",
    sub: "Censo institucional · Scopus",
    desc: "Todos los autores PUCV indexados en Scopus, con índice H, documentos y áreas de investigación.",
  },
];

const navLinkClass = ({ isActive }) =>
  `flex items-center px-4 h-full text-[11px] uppercase tracking-widest transition-colors ${
    isActive ? "text-white border-b-2 border-white" : "text-outlineSoft hover:text-white"
  }`;

function NavDropdown({ label, opciones }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);

  const activo = opciones.some(o => location.pathname === o.to);

  const abrir = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const cerrarConDelay = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div className="relative h-full flex items-center" onMouseEnter={abrir} onMouseLeave={cerrarConDelay}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`relative flex items-center gap-1.5 px-4 h-full text-[11px] uppercase tracking-widest transition-colors ${
          activo ? "text-white" : "text-outlineSoft hover:text-white"
        }`}
      >
        {label}
        <span className="text-[8px] text-outlineSoft">▾</span>
        {activo && <span className="absolute left-4 right-4 bottom-0 h-[2px] bg-white" />}
      </button>

      {open && (
        <div className="absolute top-full left-0 w-[330px] bg-[#1a1a1a] border border-white/[.16] shadow-[0_16px_40px_rgba(0,0,0,.55)] p-1.5 z-40">
          {opciones.map(o => {
            const esActual = location.pathname === o.to;
            return (
              <button
                key={o.to}
                onClick={() => { navigate(o.to); setOpen(false); }}
                className={`w-full text-left px-3.5 py-3 transition-colors ${
                  esActual ? "bg-white/[.08]" : "hover:bg-white/[.05]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`font-body font-semibold text-[12.5px] ${esActual ? "text-white" : "text-[#dcdcdc]"}`}>
                    {o.label}
                  </span>
                  {esActual && <span className="text-[9px] text-accent">✓ actual</span>}
                </div>
                <div className="text-[11px] text-[#8a8a8a] mt-0.5">{o.sub}</div>
                <div className="text-[10.5px] leading-relaxed text-[#6f6f6f] mt-1">{o.desc}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Todos los destinos en una sola lista, para el menú compacto de pantallas
// estrechas. Se deriva de las mismas constantes que el nav ancho, de modo que
// añadir una sección no obligue a acordarse de tocar dos sitios.
const DESTINOS = [
  ...NAV,
  ...OPCIONES_SIMULACION.map(o => ({ label: `Simulación · ${o.label}`, to: o.to })),
  ...OPCIONES_INVESTIGADORES.map(o => ({ label: `Investigadores · ${o.label}`, to: o.to })),
  ...NAV_AFTER_DROPDOWNS,
];

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
            {DESTINOS.map(d => {
              const esActual = location.pathname === d.to;
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

      {/* Desde `lg` y no desde `md`: medido, el nav ocupa 672 px y el encabezado
          completo necesita 940, de modo que entre 768 y 940 desbordaba la página
          horizontalmente en todas las vistas. Condensarlo hasta caber en 768
          exigía recortar el texto a 10 px sin espaciado, ilegible para el uso al
          que va destinado. Los menús desplegables se posicionan de forma
          absoluta dentro del nav, así que tampoco cabía hacerlo desplazable sin
          recortarlos. */}
      <nav className="hidden lg:flex items-center h-full gap-1">
        {NAV.map(section => (
          <NavLink key={section.label} to={section.to} className={navLinkClass}>
            {section.label}
          </NavLink>
        ))}

        <NavDropdown label="Simulación" opciones={OPCIONES_SIMULACION} />
        <NavDropdown label="Investigadores" opciones={OPCIONES_INVESTIGADORES} />

        {NAV_AFTER_DROPDOWNS.map(section => (
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
