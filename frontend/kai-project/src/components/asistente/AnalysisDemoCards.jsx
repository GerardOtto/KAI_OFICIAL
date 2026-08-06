const BARS = [38, 52, 68, 82, 94, 100, 71];

export default function AnalysisDemoCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-surfaceHigh border border-outline/40 p-5">
        <p className="text-[10px] uppercase tracking-widest text-outlineSoft mb-4">Delta de impacto de citas</p>
        <div className="flex items-end gap-2 h-28">
          {BARS.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-t-sm ${h === 100 ? "bg-white" : "bg-white/30"}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <p className="text-[9px] uppercase tracking-widest text-outlineSoft mt-4">
          Índice de colaboración // crecimiento interanual
        </p>
      </div>

      <div className="bg-surfaceHigh border border-outline/40 p-5 flex flex-col justify-center gap-5">
        <p className="text-[10px] uppercase tracking-widest text-outlineSoft -mt-1">Métricas de percepción</p>

        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs italic text-white/90">Reputación Académica</span>
            <span className="text-sm font-semibold text-white">+8.4 pts</span>
          </div>
          <div className="h-1 bg-outline/30">
            <div className="h-full bg-white" style={{ width: "70%" }} />
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs italic text-white/90">Transferencia de Conocimiento</span>
            <span className="text-sm font-semibold text-white">0.92/1.0</span>
          </div>
          <div className="h-1 bg-outline/30">
            <div className="h-full bg-white" style={{ width: "92%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
