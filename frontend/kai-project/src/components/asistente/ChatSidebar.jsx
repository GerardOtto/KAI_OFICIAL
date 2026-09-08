import { useMemo, useState } from "react";

const GraduationCapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10L12 5 2 10l10 5 10-5Z" />
    <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
  </svg>
);

const SearchIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
  </svg>
);

const ChatBubbleIcon = ({ active }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={active ? "text-white" : "text-outlineSoft"}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </svg>
);

/** Quita la notación Markdown para la vista previa de una fila del historial.
 *
 * La respuesta guardada viene en Markdown, pero aquí se muestra como una línea
 * de texto recortada: sin esto se leerían los asteriscos y las barras de las
 * tablas. No se renderiza el Markdown de verdad porque una tabla o una lista no
 * caben en un renglón; lo que se quiere es la frase, en limpio.
 */
function sinFormato(texto) {
  return (texto || "")
    .replace(/```[\s\S]*?```/g, " ")           // bloques de código
    .replace(/`([^`]+)`/g, "$1")               // código en línea
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // enlaces e imágenes: solo el texto
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")        // encabezados
    .replace(/^\s{0,3}>\s?/gm, "")             // citas
    .replace(/^\s{0,3}([-*+]|\d+[.)])\s+/gm, "") // viñetas y numeración
    .replace(/^\s*\|?[\s:|-]{6,}\|?\s*$/gm, " ") // separadores de tabla
    .replace(/\|/g, " ")                       // barras de tabla
    // Negrita, cursiva y tachado. El guion bajo suelto NO se toca: aquí abundan
    // los identificadores de métricas como `citations_per_faculty`, y quitarlo
    // los dejaría irreconocibles. La cursiva con guion bajo es rara en la salida
    // de un modelo; el daño de tratarla sería mayor que el de ignorarla.
    .replace(/(\*\*|__|\*|~~)/g, "")
    .replace(/<[^>]*>/g, " ")                  // HTML crudo, que tampoco se renderiza
    .replace(/\s+/g, " ")
    .trim();
}

/** Fecha relativa breve, para no repetir la fecha completa en cada fila. */
function cuando(iso) {
  const f = new Date(iso);
  const dias = Math.floor((Date.now() - f.getTime()) / 86400000);
  if (dias === 0) return f.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (dias === 1) return "Ayer";
  if (dias < 7) return `${dias} días`;
  return f.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" });
}

const LockIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="11" width="16" height="10" rx="1" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

/** Selección del motor para la próxima conversación.
 *
 * Con una conversación abierta el selector queda bloqueado y solo informa del
 * motor que le corresponde: el motor se fija al crearla y no puede cambiar,
 * porque el historial no es intercambiable entre proveedores. Para cambiarlo hay
 * que empezar un chat nuevo o derivar un mensaje.
 */
function SelectorMotor({ motores, motor, onMotor, bloqueado }) {
  if (motores.length === 0) return null;
  const activo = motores.find((m) => m.id === motor);

  /** Por qué un motor no se puede elegir. El orden importa: primero lo que el
   *  usuario puede resolver contratando, después lo que solo depende del
   *  servidor. `incluido_en_plan` llega en null cuando no hay sesión. */
  const impedimento = (m) => {
    if (!m.disponible) return "Sin configurar en el servidor";
    if (m.incluido_en_plan === false) return "No incluido en tu plan";
    return null;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-widest text-outlineSoft">Motor de análisis</p>
        {bloqueado && (
          <span className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-outlineSoft">
            <LockIcon /> Fijado
          </span>
        )}
      </div>

      {bloqueado ? (
        <div className="p-3 bg-surfaceHigh border border-outline/40">
          <p className="text-xs font-semibold text-white truncate">
            {activo?.nombre || motor} · {activo?.modelo || "—"}
          </p>
          <p className="text-[10px] text-outlineSoft leading-relaxed mt-1">
            Una conversación no cambia de motor. Empieza un chat nuevo para usar otro.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1">
            {motores.map((m) => {
              const activa = m.id === motor;
              const impedido = impedimento(m);
              return (
                <button
                  key={m.id}
                  onClick={() => !impedido && onMotor(m.id)}
                  disabled={!!impedido}
                  title={impedido ? `${m.nombre}: ${impedido.toLowerCase()}` : m.descripcion}
                  className={`px-3 py-2.5 border text-left transition-colors ${
                    activa
                      ? "bg-white text-black border-white"
                      : "bg-surfaceHigh border-outline/40 text-white/80 hover:border-white/50"
                  } ${impedido ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                    {m.nombre}
                    {impedido && <LockIcon />}
                  </span>
                  <span className={`block text-[9px] uppercase tracking-widest mt-0.5 ${
                    activa ? "text-black/60" : "text-outlineSoft"
                  }`}>
                    {impedido || m.etiqueta_costo}
                  </span>
                </button>
              );
            })}
          </div>
          {activo && (
            <p className="text-[10px] text-outlineSoft leading-relaxed">{activo.descripcion}</p>
          )}
          {motores.some((m) => m.incluido_en_plan === false && m.disponible) && (
            <p className="text-[10px] text-outlineSoft leading-relaxed border-l-2 border-outline pl-2">
              Tu plan no incluye todos los motores.{" "}
              <a href="/#planes" className="text-white underline underline-offset-2 hover:text-white/70">
                Ver planes
              </a>
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function ChatSidebar({
  conversaciones = [], activeId, onSelect, onNewChat, onDelete, cuota,
  motores = [], motor, onMotor, motorBloqueado,
}) {
  const [busqueda, setBusqueda] = useState("");
  const [confirmar, setConfirmar] = useState(null);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return conversaciones;
    return conversaciones.filter(
      (c) => c.titulo.toLowerCase().includes(q) ||
             (c.ultimo_mensaje || "").toLowerCase().includes(q));
  }, [conversaciones, busqueda]);

  return (
    <aside className="w-80 shrink-0 bg-surface border-r border-outline/30 flex flex-col h-full">
      <div className="p-6 flex flex-col gap-6 flex-1 min-h-0">

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-surfaceHigh border border-outline/50">
            <GraduationCapIcon />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-wider text-white truncate">Inteligencia Académica</p>
            <p className="text-[10px] uppercase tracking-widest text-outlineSoft truncate">Asistente de rankings KAI</p>
          </div>
        </div>

        <SelectorMotor
          motores={motores}
          motor={motor}
          onMotor={onMotor}
          bloqueado={motorBloqueado}
        />

        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] uppercase tracking-widest text-outlineSoft">Historial de chats</p>
            {conversaciones.length > 0 && (
              <span className="font-mono text-[9px] text-[#6f6f6f]">{conversaciones.length}</span>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center text-outlineSoft">
              <SearchIcon />
            </div>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar conversaciones..."
              className="w-full bg-surfaceHigh border border-outline/50 text-white text-xs pl-9 pr-3 py-2.5 outline-none focus:border-white"
            />
          </div>

          <div className="flex flex-col gap-1 overflow-y-auto flex-1">
            {filtradas.length === 0 && (
              <p className="text-[11px] text-outlineSoft py-4 leading-relaxed">
                {conversaciones.length === 0
                  ? "Aún no tienes conversaciones. La primera consulta creará una."
                  : "Ninguna conversación coincide con la búsqueda."}
              </p>
            )}

            {filtradas.map((c) => {
              const active = c.id_conversacion === activeId;
              const borrando = confirmar === c.id_conversacion;
              return (
                <div
                  key={c.id_conversacion}
                  className={`group relative border-l-2 transition-colors ${
                    active ? "bg-white/10 border-white" : "border-transparent hover:bg-white/5"
                  }`}
                >
                  <button onClick={() => onSelect(c.id_conversacion)} className="w-full text-left p-3 pr-9">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <ChatBubbleIcon active={active} />
                        <span className={`text-xs font-semibold truncate ${active ? "text-white" : "text-white/80"}`}>
                          {c.titulo}
                        </span>
                      </div>
                      <span className="text-[9px] text-outlineSoft shrink-0">{cuando(c.fecha_actualizacion)}</span>
                    </div>
                    <div className="flex items-center gap-2 pl-6 min-w-0">
                      {/* El motor va en cada fila porque, al no poder cambiarse
                          dentro de la conversación, determina qué se puede
                          esperar de ella antes de abrirla. */}
                      <span className="shrink-0 px-1.5 py-px border border-outline/50 font-mono text-[8px] uppercase tracking-widest text-outlineSoft">
                        {motores.find((m) => m.id === c.motor)?.nombre || c.motor || "—"}
                      </span>
                      <p className="text-[10px] text-outlineSoft truncate">
                        {sinFormato(c.ultimo_mensaje) || `${c.n_mensajes} mensajes`}
                      </p>
                    </div>
                  </button>

                  {borrando ? (
                    <div className="absolute inset-0 bg-[#1a1a1a]/95 flex items-center justify-center gap-2 px-3">
                      <span className="text-[10px] text-[#c4c4c4]">¿Eliminar?</span>
                      <button
                        onClick={() => { onDelete(c.id_conversacion); setConfirmar(null); }}
                        className="text-[10px] uppercase tracking-wider px-2 py-1 bg-negative text-white"
                      >
                        Sí
                      </button>
                      <button
                        onClick={() => setConfirmar(null)}
                        className="text-[10px] uppercase tracking-wider px-2 py-1 border border-outline/50 text-[#c4c4c4]"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmar(c.id_conversacion)}
                      title="Eliminar conversación"
                      className="absolute top-3 right-2 p-1 text-outlineSoft opacity-0 group-hover:opacity-100 hover:text-negative transition-all"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={onNewChat}
          className="w-full py-3 bg-white text-black text-[11px] font-bold uppercase tracking-widest hover:bg-white/85 transition-colors"
        >
          Empezar nuevo chat
        </button>
      </div>

      {cuota && (
        <div className="px-6 pb-6 pt-4 border-t border-outline/20 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[9px] uppercase tracking-widest text-outlineSoft truncate">
              Plan {cuota.nombre_plan || cuota.plan}
            </span>
            {cuota.precio_mensual_usd > 0 && (
              <span className="font-mono text-[9px] text-[#6f6f6f] shrink-0">
                US$ {cuota.precio_mensual_usd}/mes
              </span>
            )}
          </div>

          {/* Una barra por motor: la cuota es de cada uno, así que un solo
              contador no diría cuál se agotó ni cuál queda libre. */}
          {motores.map((m) => {
            const e = cuota.motores?.[m.id];
            if (!e) return null;
            const pct = e.tokens_mensuales
              ? Math.min(100, (e.tokens_total / e.tokens_mensuales) * 100)
              : 0;
            return (
              <div key={m.id} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[9px] uppercase tracking-widest text-outlineSoft">{m.nombre}</span>
                  <span className="font-mono text-[9px] text-[#8a8a8a] shrink-0">
                    {!e.incluido
                      ? "no incluido"
                      : e.tokens_mensuales == null
                        ? "sin límite"
                        : `${e.tokens_total.toLocaleString("es-CL")} / ${e.tokens_mensuales.toLocaleString("es-CL")}`}
                  </span>
                </div>
                <div className="h-[3px] bg-white/[.08]">
                  <div
                    className={`h-full transition-[width] duration-500 ${
                      !e.incluido ? "bg-outline" : e.tokens_restantes === 0 ? "bg-negative" : "bg-accent"
                    }`}
                    style={{ width: e.incluido ? `${pct}%` : "100%" }}
                  />
                </div>
              </div>
            );
          })}

          {cuota.mensajes_restantes != null && (
            <span className="font-mono text-[9px] text-[#6f6f6f]">
              {cuota.mensajes_restantes} consultas restantes hoy
            </span>
          )}
        </div>
      )}
    </aside>
  );
}
