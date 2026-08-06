import { useState, useMemo, useEffect } from "react";
import { useMetricas } from "../hooks/useMetricas";
import { useUniversidades } from "../hooks/useUniversidades";
import { useRankings } from "../hooks/useRankings";

export default function Sidebar({
  rankingId,
  setRankingId,
  metricaId,
  setMetricaId,
  selectedUniversidades,
  setSelectedUniversidades,
  onDownload,
  onDownloadExcel,
  showProjection,
  setShowProjection,
  projectionYears,
  setProjectionYears
}) {
  const metricas = useMetricas(rankingId);
  const { universidades } = useUniversidades();
  const rankings = useRankings();
  const [search, setSearch] = useState("");
  const [disciplinaFiltro, setDisciplinaFiltro] = useState(null);

  const disciplinas = useMemo(
    () => [...new Set(metricas.map((m) => m.disciplina).filter((d) => d && d !== "General"))].sort(),
    [metricas]
  );

  const metricasFiltradas = useMemo(() => {
    if (!disciplinaFiltro) return metricas;
    return metricas.filter((m) => m.disciplina === disciplinaFiltro);
  }, [metricas, disciplinaFiltro]);

  // Cuenta cuántas variantes (mismo nombre + disciplina, distinto id) hay —
  // ocurre cuando el peso de una métrica cambió de un año a otro (ej. Shanghai GRAS).
  const conteoPorNombre = useMemo(() => {
    const counts = {};
    metricasFiltradas.forEach((m) => {
      const key = `${m.nombre_metrica}|${m.disciplina}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [metricasFiltradas]);

  useEffect(() => {
    setDisciplinaFiltro(null);
  }, [rankingId]);

  const universidadesFiltradas = useMemo(() => {
    if (!universidades) return [];
    return universidades.filter((u) =>
      (u.nombre_universidad || "").toLowerCase().includes(search.toLowerCase())
    );
  }, [universidades, search]);

  return (
    <aside className="w-full h-full shrink-0 bg-surface border-r border-outline/30 p-6">

      <div className="flex flex-col gap-8">

        {/* Ranking */}
        <div>
          <label className="text-[10px] uppercase text-outlineSoft mb-3 block">
            Seleccionar Ranking
          </label>
          <select
            value={rankingId}
            onChange={(e) => { setRankingId(Number(e.target.value)); setMetricaId(null); }}
            className="w-full bg-surfaceHigh border border-outline/50 text-white py-3 px-4"
          >
            {rankings.map((r) => (
              <option key={r.id_ranking} value={r.id_ranking}>{r.nombre_ranking}</option>
            ))}
          </select>
        </div>

        {/* Disciplina */}
        {disciplinas.length > 0 && (
          <div>
            <label className="text-[10px] uppercase text-outlineSoft mb-3 block">
              Disciplina
            </label>
            <select
              value={disciplinaFiltro || ""}
              onChange={(e) => { setDisciplinaFiltro(e.target.value || null); setMetricaId(null); }}
              className="w-full bg-surfaceHigh border border-outline/50 text-white py-3 px-4"
            >
              <option value="">Todas las disciplinas</option>
              {disciplinas.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}

        {/* Métricas */}
        <div>
          <label className="text-[10px] uppercase text-outlineSoft mb-3 block">
            Métrica / Dimensión
          </label>
          <div className="relative">
            <select
              value={metricaId || ""}
              onChange={(e) => setMetricaId(Number(e.target.value))}
              className="w-full bg-surfaceHigh border border-outline/50 text-white py-3 px-4 text-xs uppercase tracking-widest focus:outline-none focus:border-white appearance-none"
            >
              <option value="" disabled>Seleccionar métrica</option>
              {metricasFiltradas.map((m) => {
                const esDuplicada = conteoPorNombre[`${m.nombre_metrica}|${m.disciplina}`] > 1;
                const rango = m.anio_min && m.anio_max
                  ? (m.anio_min === m.anio_max ? ` (${m.anio_min})` : ` (${m.anio_min}–${m.anio_max})`)
                  : "";
                const base = !disciplinaFiltro && m.disciplina && m.disciplina !== "General"
                  ? `${m.nombre_metrica} — ${m.disciplina}`
                  : m.nombre_metrica;
                return (
                  <option key={m.id_metrica} value={m.id_metrica}>
                    {esDuplicada ? `${base}${rango}` : base}
                  </option>
                );
              })}
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

        {/* Proyección */}
        <div>
          <label className="text-[10px] uppercase text-outlineSoft mb-3 block">
            Proyección de tendencia
          </label>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id="showProjection"
              checked={showProjection}
              onChange={(e) => setShowProjection(e.target.checked)}
              className="accent-white"
            />
            <label htmlFor="showProjection" className="text-xs text-white cursor-pointer">
              Mostrar proyección (regresión lineal)
            </label>
          </div>
          {showProjection && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-outlineSoft">Años a proyectar</span>
              <input
                type="number"
                min={1}
                max={10}
                value={projectionYears}
                onChange={(e) => setProjectionYears(Math.max(1, Math.min(10, Number(e.target.value))))}
                className="w-16 bg-surfaceHigh border border-outline/50 text-white py-1 px-2 text-xs"
              />
            </div>
          )}
        </div>

        {/* Descargar */}
        <button
          onClick={onDownload}
          className="w-full py-3 px-4 border border-outline/50 text-white text-[10px] uppercase tracking-widest hover:bg-white hover:text-black transition-all"
        >
          ↓ Descargar PDF
        </button>
        <button
          onClick={onDownloadExcel}
          className="w-full py-3 px-4 border border-outline/50 text-white text-[10px] uppercase tracking-widest hover:bg-white hover:text-black transition-all"
        >
          ↓ Descargar XLSX
        </button>

      </div>
    </aside>
  );
}