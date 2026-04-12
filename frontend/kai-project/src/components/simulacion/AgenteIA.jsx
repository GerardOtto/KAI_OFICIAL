import { useState } from "react";

export default function AgenteIA() {
  const [visible, setVisible] = useState(false);

  return (
    <div className="border-t border-outline/30">
      <button
        onClick={() => setVisible(v => !v)}
        className="w-full flex items-center justify-between px-10 py-4 bg-[#0e0e0e] hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-white/10 flex items-center justify-center text-white text-[10px]">AI</div>
          <span className="text-[10px] uppercase tracking-widest text-outlineSoft">Asesoría Estratégica · KAI AI v4.0</span>
          <span className="text-[9px] text-outlineSoft/50 italic">Placeholder — no funcional</span>
        </div>
        <span className="text-outlineSoft text-xs transition-transform duration-200" style={{ display: "inline-block", transform: visible ? "rotate(180deg)" : "rotate(0deg)" }}>▲</span>
      </button>

      {visible && (
        <section className="bg-[#0e0e0e] px-10 py-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-12 items-start">

            <div className="md:w-1/3">
              <h2 className="text-2xl font-bold font-serif text-white mb-4">Asesoría Estratégica y Hoja de Roadmap</h2>
              <div className="w-12 h-0.5 bg-white mb-6" />
              <div className="space-y-3">
                <div className="relative flex items-center opacity-50 cursor-not-allowed">
                  <input
                    disabled
                    className="w-full bg-white/5 border border-outline/30 text-white py-3 pl-4 pr-12 text-sm placeholder:text-outlineSoft"
                    placeholder="Próximamente disponible..."
                  />
                  <span className="absolute right-3 text-outlineSoft text-lg">→</span>
                </div>
                <p className="text-[10px] text-outlineSoft italic uppercase tracking-tight">Funcionalidad en desarrollo</p>
              </div>
            </div>

            <div className="md:w-2/3">
              <p className="text-lg leading-relaxed text-white/70 mb-8 italic font-serif">
                "Se recomienda priorizar las métricas de mayor peso en el índice global. Aunque algunas dimensiones tienen un costo operativo alto, su impacto en la reputación institucional es crítico a largo plazo."
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase tracking-widest text-outlineSoft">Acciones Críticas</h4>
                  <ul className="space-y-2 text-xs text-white/60">
                    <li className="flex items-start gap-2"><span>→</span><span>Auditoría de repositorios de Acceso Abierto.</span></li>
                    <li className="flex items-start gap-2"><span>→</span><span>Incentivo a publicaciones en redes internacionales.</span></li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase tracking-widest text-outlineSoft">Visión a Largo Plazo</h4>
                  <ul className="space-y-2 text-xs text-white/60">
                    <li className="flex items-start gap-2"><span>⏱</span><span>Programa de aceleración de patentes tecnológicas.</span></li>
                    <li className="flex items-start gap-2"><span>⏱</span><span>Consolidación de clusters de impacto.</span></li>
                  </ul>
                </div>
              </div>
            </div>

          </div>
        </section>
      )}
    </div>
  );
}