import { useState, useMemo } from "react";
import { useMetricas } from "../hooks/useMetricas";
import { useUniversidades } from "../hooks/useUniversidades";

export default function Sidebar({
  rankingId,
  setRankingId,
  metricaId,
  setMetricaId,
  selectedUniversidades,
  setSelectedUniversidades,
  onDownload
}) {
  const metricas = useMetricas(rankingId);
  const { universidades } = useUniversidades();
  const [search, setSearch] = useState("");

  const universidadesFiltradas = useMemo(() => {
    if (!universidades) return [];
    return universidades.filter((u) =>
      (u.nombre_universidad || "").toLowerCase().includes(search.toLowerCase())
    );
  }, [universidades, search]);

  return (
    <aside className="w-80 shrink-0 bg-surface border-r border-outline/30 p-6">

      <div className="flex flex-col gap-8">

        {/* Ranking */}
        <div>
          <label className="text-[10px] uppercase text-outlineSoft mb-3 block">
            Ranking Principal
          </label>
          <select
            value={rankingId}
            onChange={(e) => { setRankingId(Number(e.target.value)); setMetricaId(null); }}
            className="w-full bg-surfaceHigh border border-outline/50 text-white py-3 px-4"
          >
            <option value={1}>Times Higher Education</option>
            <option value={2}>QS Latam</option>
            <option value={3}>Scimago</option>
            <option value={4}>Shanghai GRAS</option>
          </select>
        </div>

        {/* Métricas */}
        <div>
          <label className="text-[10px] uppercase text-outlineSoft mb-3 block">
            Métrica (Dimensión)
          </label>
          <div className="relative">
            <select
              value={metricaId || ""}
              onChange={(e) => setMetricaId(Number(e.target.value))}
              className="w-full bg-surfaceHigh border border-outline/50 text-white py-3 px-4 text-xs uppercase tracking-widest focus:outline-none focus:border-white appearance-none"
            >
              <option value="" disabled>Seleccionar métrica</option>
              {metricas.map((m) => (
                <option key={m.id_metrica} value={m.id_metrica}>{m.nombre_metrica}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-outlineSoft text-xs">▼</div>
          </div>
        </div>

        {/* Universidades */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-[10px] uppercase text-outlineSoft">Universidades</label>
            {selectedUniversidades.length > 0 && (
              <button
                onClick={() => setSelectedUniversidades([])}
                className="text-[10px] uppercase tracking-wider px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500 hover:text-white transition-all"
              >
                ✕ Limpiar ({selectedUniversidades.length})
              </button>
            )}
          </div>

          <input
            type="text"
            placeholder="Buscar universidad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full mb-3 px-3 py-2 bg-surfaceHigh border border-outline/50 text-white text-sm outline-none focus:border-white"
          />

          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
            {universidadesFiltradas.map((u) => {
              const selected = selectedUniversidades.includes(u.id_universidad);
              return (
                <div
                  key={u.id_universidad}
                  onClick={() => {
                    if (selected) {
                      setSelectedUniversidades(prev => prev.filter(id => id !== u.id_universidad));
                    } else {
                      setSelectedUniversidades(prev => [...prev, u.id_universidad]);
                    }
                  }}
                  className={`cursor-pointer px-3 py-2 border-l-2 transition-all ${
                    selected ? "bg-white text-black border-white" : "bg-surfaceHigh border-transparent hover:border-white"
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider">{u.nombre_universidad}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Descargar */}
        <button
          onClick={onDownload}
          className="w-full py-3 px-4 border border-outline/50 text-white text-[10px] uppercase tracking-widest hover:bg-white hover:text-black transition-all"
        >
          ↓ Descargar gráfico
        </button>

      </div>
    </aside>
  );
}