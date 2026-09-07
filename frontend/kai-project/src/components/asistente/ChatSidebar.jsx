import { useMemo, useState } from "react";

const GraduationCapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10L12 5 2 10l10 5 10-5Z" />
    <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
  </svg>
);

const BrainIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 4a2.5 2.5 0 0 0-2.5 2.5v.5A2.5 2.5 0 0 0 4.5 9.5v1A2.5 2.5 0 0 0 3 13a2.5 2.5 0 0 0 2 2.45V17a3 3 0 0 0 3 3h1.5" />
    <path d="M14.5 4a2.5 2.5 0 0 1 2.5 2.5v.5a2.5 2.5 0 0 1 2.5 2.5v1a2.5 2.5 0 0 1 1.5 2 2.5 2.5 0 0 1-2 2.45V17a3 3 0 0 1-3 3h-1.5" />
    <path d="M9.5 4v16M14.5 4v16" />
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

/** Fecha relativa breve, para no repetir la fecha completa en cada fila. */
function cuando(iso) {
  const f = new Date(iso);
  const dias = Math.floor((Date.now() - f.getTime()) / 86400000);
  if (dias === 0) return f.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (dias === 1) return "Ayer";
  if (dias < 7) return `${dias} días`;
  return f.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" });
}

export default function ChatSidebar({
  conversaciones = [], activeId, onSelect, onNewChat, onDelete, cuota,
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

        <div className="flex items-center gap-3 p-3 bg-surfaceHigh border border-outline/40">
          <div className="w-8 h-8 shrink-0 flex items-center justify-center border border-outline/50 text-outlineSoft">
            <BrainIcon />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-widest text-outlineSoft">Motor de análisis</p>
            <p className="text-xs font-semibold text-white truncate">Claude Opus 5 · con acceso a datos</p>
          </div>
        </div>

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
                    <p className="text-[10px] text-outlineSoft truncate pl-6">
                      {c.ultimo_mensaje || `${c.n_mensajes} mensajes`}
                    </p>
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
        <div className="px-6 pb-6 pt-4 border-t border-outline/20 flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[9px] uppercase tracking-widest text-outlineSoft">
              Plan {cuota.nombre_plan || cuota.plan}
            </span>
            <span className="font-mono text-[9px] text-[#8a8a8a]">
              {cuota.tokens_total.toLocaleString("es-CL")}
              {cuota.tokens_mensuales != null && ` / ${cuota.tokens_mensuales.toLocaleString("es-CL")}`}
            </span>
          </div>
          <div className="h-[3px] bg-white/[.08]">
            <div
              className={`h-full transition-[width] duration-500 ${cuota.excedido ? "bg-negative" : "bg-accent"}`}
              style={{
                width: cuota.tokens_mensuales
                  ? `${Math.min(100, (cuota.tokens_total / cuota.tokens_mensuales) * 100)}%`
                  : "0%",
              }}
            />
          </div>
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
