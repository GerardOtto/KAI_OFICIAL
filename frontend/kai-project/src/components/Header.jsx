import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/logo.png";
import { useAuth } from "../auth/AuthContext";
import AuthModal from "./AuthModal";
import SesionRequerida from "./SesionRequerida";
import { useModoValores, RUTAS_CON_MODO } from "../estado/ModoValores";

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

function MenuCompacto({ pedirSesion }) {
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
                  onClick={() => { setAbierto(false); if (!pedirSesion(d)) navigate(d.to); }}
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
  const location = useLocation();

  // Desde la portada, entrar lleva al asistente; desde un módulo, se queda en
  // él, que es donde la persona quería estar. No sirve el `onExito` del modal:
  // al aparecer la sesión, este componente cambia de rama y desmonta el modal
  // antes de que su efecto llegue a ejecutarse.
  const desdePortada = useRef(false);
  useEffect(() => {
    if (usuario && desdePortada.current) {
      desdePortada.current = false;
      navigate("/asistente");
    }
  }, [usuario, navigate]);

  if (!usuario) {
    return (
      <>
        <button
          onClick={() => { desdePortada.current = location.pathname === "/"; setModal(true); }}
          className="px-3.5 py-2 border border-white/20 text-[10px] uppercase tracking-widest text-[#c4c4c4] hover:bg-white hover:text-black hover:border-white transition-colors"
        >
          Iniciar sesión
        </button>
        {modal && <AuthModal onClose={() => { desdePortada.current = false; setModal(false); }} />}
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
                {cuota.consultas?.total != null && (
                  <p className="font-mono text-[9px] text-[#6f6f6f] mt-1.5">
                    {cuota.consultas.hechas} de {cuota.consultas.total} consultas de prueba usadas
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

/** Switch global entre puntajes normalizados y valores medidos.
 *
 * Aparece solo en los módulos donde tiene efecto —Resumen, Tendencias,
 * Simulación y Glosario—: en la portada o el asistente sería un control que no
 * hace nada. Las etiquetas son cortas a propósito: el header no puede desbordar
 * en ningún ancho, y la explicación larga va en el título de cada botón.
 */
function SwitchModo() {
  const location = useLocation();
  const { modo, setModo } = useModoValores();
  if (!RUTAS_CON_MODO.some((r) => location.pathname.startsWith(r))) return null;

  const opciones = [
    ["puntajes", "Puntajes", "Puntajes normalizados de 0 a 100, como los publica cada ranking"],
    ["numerico", "Valores", "Valores medidos: las cifras reales detrás de cada puntaje"],
  ];
  const otro = modo === "numerico" ? "puntajes" : "numerico";
  return (
    <>
      {/* En pantallas chicas no caben dos botones junto al logo y al menú: uno solo
          muestra el modo vigente y cambia al otro. */}
      <button
        type="button"
        className="sm:hidden shrink-0 px-2 py-1.5 text-[10px] uppercase tracking-wider border border-white/40 text-white"
        aria-label={`Modo ${modo === "numerico" ? "valores medidos" : "puntajes"}. Cambiar a ${otro === "numerico" ? "valores medidos" : "puntajes"}`}
        onClick={() => setModo(otro)}
      >
        {modo === "numerico" ? "Valores" : "Puntajes"} ⇄
      </button>
      <SwitchDoble opciones={opciones} modo={modo} setModo={setModo} />
    </>
  );
}

function SwitchDoble({ opciones, modo, setModo }) {
  return (
    <div role="group" aria-label="Tipo de valores en toda la plataforma" className="hidden sm:flex shrink-0">
      {opciones.map(([clave, etiqueta, ayuda], i) => {
        const activo = modo === clave;
        return (
          <button
            key={clave}
            type="button"
            aria-pressed={activo}
            title={ayuda}
            onClick={() => setModo(clave)}
            className={`px-2.5 sm:px-3 py-1.5 text-[10px] uppercase tracking-widest border transition-colors ${
              activo
                ? "bg-white text-black border-white"
                : "text-[#c4c4c4] border-white/20 hover:border-white/50"
            } ${i > 0 ? "-ml-px" : ""}`}
          >
            {etiqueta}
          </button>
        );
      })}
    </div>
  );
}

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { autenticado, cargando } = useAuth();
  const [aviso, setAviso] = useState(null); // { label, to } del módulo pedido

  /** Sin sesión, un módulo no se abre: se avisa sobre la página actual y se
   *  ofrece entrar. Devuelve si interceptó el paso. Mientras se verifica la
   *  sesión se deja pasar; si no la hay, la ruta protegida devuelve aquí. */
  const pedirSesion = (d) => {
    if (autenticado || cargando) return false;
    setAviso(d);
    return true;
  };

  // Quien abre la dirección de un módulo sin sesión es devuelto a la portada
  // por la ruta protegida, con el módulo en el estado de la navegación.
  const requiere = location.state?.requiere;
  useEffect(() => {
    if (!requiere) return;
    const d = NAV.find((n) => requiere.startsWith(n.to));
    setAviso({ label: d?.label || "Módulo", to: requiere });
    navigate(location.pathname + location.hash, { replace: true, state: null });
  }, [requiere, navigate, location.pathname, location.hash]);

  return (
    <header className="flex justify-between items-center px-4 sm:px-8 h-16 border-b border-outline/30 sticky top-0 bg-background z-50">

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
          <NavLink key={section.label} to={section.to} className={navLinkClass}
                   onClick={(e) => { if (pedirSesion(section)) e.preventDefault(); }}>
            {section.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-2 sm:gap-3">
        <SwitchModo />
        {/* Sustituye al nav ancho por debajo de `lg`. Antes de esto no había
            navegación alguna en pantallas estrechas. */}
        <MenuCompacto pedirSesion={pedirSesion} />
        <MenuUsuario />
      </div>

      {aviso && <SesionRequerida modulo={aviso} onClose={() => setAviso(null)} />}

    </header>
  );
}
