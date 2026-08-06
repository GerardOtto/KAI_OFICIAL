import { useState, useRef, useEffect } from "react";
import ChatSidebar from "../components/asistente/ChatSidebar";
import AnalysisDemoCards from "../components/asistente/AnalysisDemoCards";

const nowLabel = () =>
  new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC-4";

const SEED_MESSAGES = [
  {
    id: "seed-user",
    role: "user",
    content:
      "Inicia un análisis comparativo del impacto de citas entre universidades chilenas en THE y QS Latam entre 2019 y 2024. Cruza esto con la reputación académica disponible en ese período.",
    time: "22:45 UTC-4",
  },
  {
    id: "seed-assistant",
    role: "assistant",
    title: "Módulo de Análisis: Desempeño Comparado",
    content:
      "He procesado las tendencias históricas y de simulación disponibles en la base de datos. El análisis revela una correlación directa entre el crecimiento en Citations per Paper y la Reputación Académica acumulada. Las instituciones con mayor inversión sostenida en investigación muestran un crecimiento más estable en sus métricas de percepción internacional.",
    followUp:
      "Para profundizar, ¿quieres que priorice el análisis de anomalías en Staff with PhD o que me centre en proyectar movimientos de ranking para el próximo ciclo?",
    showDemoCards: true,
    time: "22:45 UTC-4",
  },
];

const PaperclipIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05 12.5 20a5 5 0 0 1-7.07-7.07l8.94-8.94a3.5 3.5 0 0 1 4.95 4.95L10.4 17.87a2 2 0 0 1-2.83-2.83l7.78-7.78" />
  </svg>
);

const MicIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0M12 19v3" />
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 21 23 12 2 3v7l15 2-15 2z" />
  </svg>
);

const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z" />
  </svg>
);

export default function Asistente() {
  const [activeId, setActiveId] = useState(1);
  const [messages, setMessages] = useState(SEED_MESSAGES);
  const [apiHistory, setApiHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { id: `u-${Date.now()}`, role: "user", content: text, time: nowLabel() };
    const nextHistory = [...apiHistory, { role: "user", content: text }];

    setMessages((prev) => [...prev, userMsg]);
    setApiHistory(nextHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextHistory }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: data.content, time: nowLabel() },
      ]);
      setApiHistory((prev) => [...prev, { role: "assistant", content: data.content }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: "No se pudo contactar al asistente. Verifica que el backend esté corriendo y tenga configurada la clave de la API de Claude.",
          time: nowLabel(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setApiHistory([]);
    setInput("");
  };

  return (
    <div className="flex bg-background text-white" style={{ height: "calc(100vh - 64px)" }}>
      <ChatSidebar activeId={activeId} onSelect={setActiveId} onNewChat={handleNewChat} />

      <main className="flex-1 flex flex-col min-w-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-10 py-8 flex flex-col gap-8">
          {messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-outlineSoft">
              <div className="w-12 h-12 border border-outline/30 flex items-center justify-center">
                <SparkleIcon />
              </div>
              <p className="text-sm">Escribe tu primera consulta sobre rankings, tendencias o simulaciones.</p>
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex flex-col items-end gap-2">
                <div className="max-w-3xl bg-surfaceHigh border border-outline/40 p-6">
                  <p className="text-white/90 leading-relaxed italic">&ldquo;{m.content}&rdquo;</p>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-outlineSoft">
                  Identificación del investigador: 0X-4421 // {m.time}
                </span>
              </div>
            ) : (
              <div key={m.id} className="flex flex-col gap-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-surfaceHigh border border-outline/50 text-white mt-1">
                    <SparkleIcon />
                  </div>
                  <div className="flex flex-col gap-3 min-w-0">
                    {m.title && (
                      <h2 className="font-headline text-2xl italic text-white">{m.title}</h2>
                    )}
                    <p className="text-white/80 leading-relaxed max-w-3xl">{m.content}</p>
                  </div>
                </div>

                {m.showDemoCards && (
                  <div className="pl-11">
                    <AnalysisDemoCards />
                  </div>
                )}

                {m.followUp && (
                  <p className="pl-11 text-white/90 leading-relaxed max-w-3xl">{m.followUp}</p>
                )}
              </div>
            )
          )}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-surfaceHigh border border-outline/50 text-white mt-1">
                <SparkleIcon />
              </div>
              <p className="text-outlineSoft text-sm italic mt-1.5">Consultando la base de datos...</p>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-outline/30 px-10 py-5">
          <div className="flex items-center gap-3 bg-surfaceHigh border border-outline/50 px-4 py-3">
            <span className="text-[11px] font-mono text-outlineSoft shrink-0">KAI_PROMPT_</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Consultar rankings..."
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-outlineSoft/70"
            />
            <button className="text-outlineSoft hover:text-white transition-colors cursor-not-allowed" title="Adjuntar (próximamente)">
              <PaperclipIcon />
            </button>
            <button className="text-outlineSoft hover:text-white transition-colors cursor-not-allowed" title="Voz (próximamente)">
              <MicIcon />
            </button>
            <button
              onClick={handleSend}
              className="text-white hover:text-white/70 transition-colors disabled:opacity-30"
              disabled={!input.trim() || loading}
              title="Enviar"
            >
              <SendIcon />
            </button>
          </div>

          <div className="flex items-center justify-between mt-3 text-[9px] uppercase tracking-widest text-outlineSoft">
            <div className="flex items-center gap-4">
              <span>Modo-L: Análisis académico</span>
              <span>Datos: rankings, métricas y universidades</span>
            </div>
            <span>Sistema KAI · Asistente v0.1 (estructura)</span>
          </div>
        </div>
      </main>
    </div>
  );
}
