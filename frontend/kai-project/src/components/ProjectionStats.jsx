const r2Tone = (r2) => {
  if (r2 >= 0.7) return { label: "Alta", text: "text-emerald-400", chip: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" };
  if (r2 >= 0.4) return { label: "Media", text: "text-amber-400", chip: "text-amber-400 border-amber-400/40 bg-amber-400/10" };
  return { label: "Baja", text: "text-red-400", chip: "text-red-400 border-red-400/40 bg-red-400/10" };
};

export default function ProjectionStats({ stats, colors }) {
  if (!stats?.length) return null;

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {stats.map((s, i) => {
          const tone = r2Tone(s.r2);
          return (
            <div key={s.universidad} className="flex items-center gap-2 px-3 py-1.5 bg-surfaceHigh border border-outline/50 text-xs">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
              <span className="text-outlineSoft">{s.universidad}</span>
              <span className={`font-semibold ${tone.text}`}>R² {s.r2.toFixed(2)}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-3 p-3 border border-amber-400/30 bg-amber-400/5 text-amber-200/90 text-xs leading-relaxed">
        <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86l-8.18 14.14A1.5 1.5 0 003.5 20h17a1.5 1.5 0 001.39-2L13.71 3.86a1.5 1.5 0 00-2.42 0z" />
        </svg>
        <span>Las proyecciones se basan en tendencias históricas y pueden variar según cambios en las políticas institucionales y factores externos.</span>
      </div>
    </div>
  );
}
