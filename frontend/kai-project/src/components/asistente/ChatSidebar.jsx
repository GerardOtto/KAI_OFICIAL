const MOCK_HISTORY = [
  { id: 1, title: "Impacto de citas THE vs QS", preview: "Compara el crecimiento de citas por artículo entre 2019 y 2024...", time: "22:45" },
  { id: 2, title: "Simulación de mejora reputación", preview: "Simula cómo cambiaría el score si Reputación Académica sube 5 pts...", time: "Ayer" },
  { id: 3, title: "Comparativa Chile vs Latam", preview: "¿Cómo se posicionan las universidades chilenas frente al resto...", time: "Ayer" },
  { id: 4, title: "Universidades con mayor crecimiento", preview: "¿Qué instituciones muestran mayor pendiente anual en Shanghai GRAS?", time: "2 días" },
  { id: 5, title: "Revisión metodológica QS Latam", preview: "Explica por qué el peso de Faculty Student cambió entre ediciones...", time: "3 días" },
];

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

const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z" />
  </svg>
);

const DocIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6M9 13h6M9 17h6" />
  </svg>
);

export default function ChatSidebar({ activeId, onSelect, onNewChat }) {
  return (
    <aside className="w-80 shrink-0 bg-surface border-r border-outline/30 flex flex-col h-full">
      <div className="p-6 flex flex-col gap-6 flex-1 min-h-0">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-surfaceHigh border border-outline/50">
            <GraduationCapIcon />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-wider text-white truncate">Inteligencia Académica</p>
            <p className="text-[10px] uppercase tracking-widest text-outlineSoft truncate">Asistente de rankings KAI</p>
          </div>
        </div>

        {/* Modelo */}
        <div className="flex items-center gap-3 p-3 bg-surfaceHigh border border-outline/40">
          <div className="w-8 h-8 shrink-0 flex items-center justify-center border border-outline/50 text-outlineSoft">
            <BrainIcon />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-widest text-outlineSoft">Motor de análisis</p>
            <p className="text-xs font-semibold text-white truncate">Claude Opus 5 · con acceso a datos</p>
          </div>
        </div>

        {/* Historial */}
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <p className="text-[10px] uppercase tracking-widest text-outlineSoft">Historial de chats</p>

          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center text-outlineSoft">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Buscar conversaciones..."
              className="w-full bg-surfaceHigh border border-outline/50 text-white text-xs pl-9 pr-3 py-2.5 outline-none focus:border-white"
            />
          </div>

          <div className="flex flex-col gap-1 overflow-y-auto flex-1">
            {MOCK_HISTORY.map((c) => {
              const active = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`text-left p-3 border-l-2 transition-colors ${
                    active ? "bg-white/10 border-white" : "border-transparent hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <ChatBubbleIcon active={active} />
                      <span className={`text-xs font-semibold truncate ${active ? "text-white" : "text-white/80"}`}>{c.title}</span>
                    </div>
                    <span className="text-[9px] text-outlineSoft shrink-0">{c.time}</span>
                  </div>
                  <p className="text-[10px] text-outlineSoft truncate pl-6">{c.preview}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nuevo chat */}
        <button
          onClick={onNewChat}
          className="w-full py-3 bg-white text-black text-[11px] font-bold uppercase tracking-widest hover:bg-white/85 transition-colors"
        >
          Empezar nuevo chat
        </button>
      </div>

      {/* Footer */}
      <div className="px-6 pb-6 pt-4 flex flex-col gap-3 border-t border-outline/20 mt-2">
        <div className="flex items-center gap-2 text-outlineSoft text-[10px] uppercase tracking-widest cursor-default">
          <ShieldIcon /> Seguridad
        </div>
        <div className="flex items-center gap-2 text-outlineSoft text-[10px] uppercase tracking-widest cursor-default">
          <DocIcon /> Documentación
        </div>
      </div>
    </aside>
  );
}
