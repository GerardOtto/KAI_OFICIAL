const r2Tone = (r2) => {
  if (r2 >= 0.7) return { label: "Alta", chip: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" };
  if (r2 >= 0.4) return { label: "Media", chip: "text-amber-400 border-amber-400/40 bg-amber-400/10" };
  return { label: "Baja", chip: "text-red-400 border-red-400/40 bg-red-400/10" };
};

export default function ProjectionSummary({ bestGrowth, bestProjection, avgR2, horizonYear }) {
  const avgTone = r2Tone(avgR2);
  const growthTone = bestGrowth.slope >= 0 ? "text-emerald-400" : "text-red-400";
  const growthSign = bestGrowth.slope >= 0 ? "+" : "";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div className="bg-surfaceHigh border border-outline/50 p-4">
        <p className="text-[10px] uppercase tracking-widest text-outlineSoft mb-2">Mayor crecimiento anual</p>
        <p className="text-white text-lg font-semibold truncate" title={bestGrowth.universidad}>{bestGrowth.universidad}</p>
        <p className={`text-sm mt-1 ${growthTone}`}>{growthSign}{bestGrowth.slope.toFixed(2)} pts/año</p>
      </div>

      <div className="bg-surfaceHigh border border-outline/50 p-4">
        <p className="text-[10px] uppercase tracking-widest text-outlineSoft mb-2">Mayor proyección a {horizonYear}</p>
        <p className="text-white text-lg font-semibold truncate" title={bestProjection.universidad}>{bestProjection.universidad}</p>
        <p className="text-sm mt-1 text-blue-400">{bestProjection.projected.toFixed(1)} pts proyectados</p>
      </div>

      <div className="bg-surfaceHigh border border-outline/50 p-4">
        <p className="text-[10px] uppercase tracking-widest text-outlineSoft mb-2">Precisión promedio (R²)</p>
        <div className="flex items-baseline gap-2">
          <p className="text-white text-lg font-semibold">{avgR2.toFixed(2)}</p>
          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${avgTone.chip}`}>{avgTone.label}</span>
        </div>
      </div>
    </div>
  );
}
