import { useState } from "react";

export default function ChartInfo() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute top-4 right-4 z-30">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Información del gráfico"
        className="relative w-7 h-7 flex items-center justify-center rounded-full border border-blue-400/60 bg-blue-400/10 text-blue-300 text-sm font-semibold hover:bg-blue-400/20 hover:text-white hover:scale-110 transition-all"
      >
        {!open && (
          <span className="absolute inset-0 rounded-full border border-blue-400/60 animate-ping" />
        )}
        <span className="relative">i</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-80 max-w-[80vw] bg-surfaceHigh border border-outline/50 p-4 text-xs text-outlineSoft leading-relaxed shadow-lg">
            <p className="text-white font-semibold mb-2 uppercase tracking-wider text-[11px]">Cómo leer este gráfico</p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Las líneas sólidas son el puntaje histórico; las punteadas son la proyección a futuro (regresión lineal).</li>
              <li><span className="text-white font-medium">R²</span> indica qué tan confiable es esa proyección: cerca de 1 = tendencia sólida, cerca de 0 = poco confiable.</li>
              <li>Si una universidad no reportó datos en el año más reciente o tiene menos de 3 años de historial, no se le genera proyección.</li>
              <li>Una línea puede mostrar cortes en los años donde la institución no reportó datos.</li>
              <li>Las proyecciones son estimaciones estadísticas: no garantizan resultados futuros.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
