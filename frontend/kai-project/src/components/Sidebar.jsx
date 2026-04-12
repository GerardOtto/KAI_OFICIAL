import React from "react";
import { useMetricas } from "../hooks/useMetricas";
import { useUniversidades } from "../hooks/useUniversidades";

export default function Sidebar({
    rankingId,
    setRankingId,
    metricaId,
    setMetricaId,
    selectedUniversidades,
    setSelectedUniversidades
  }) {

  const metricas = useMetricas(rankingId);
  const universidades = useUniversidades();
  return (
    <aside className="w-80 bg-surface border-r border-outline/30 p-6">

      <div className="flex flex-col gap-8">

        {/* Ranking */}
        <div>
          <label className="text-[10px] uppercase text-outlineSoft mb-3 block">
            Ranking Principal
          </label>

          <select
            value={rankingId}
            onChange={(e) => {
              setRankingId(Number(e.target.value));
              setMetricaId(null); // reset métrica
            }}
            className="w-full bg-surfaceHigh border border-outline/50 text-white py-3 px-4"
          >
            <option value={1}>Times Higher Education</option>
            <option value={2}>QS Latam</option>
            <option value={3}>Scimago</option>
            <option value={4}>Shanghai GRAS</option>
          </select>
        </div>

        {/* Métricas dinámicas */}
        <div>
          <label className="text-[10px] uppercase text-outlineSoft mb-3 block">
            Métrica (Dimensión)
          </label>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {metricas.map((m) => (
              <button
                key={m.id_metrica}
                onClick={() => setMetricaId(m.id_metrica)}
                className={`px-4 py-2 text-[10px] uppercase tracking-widest whitespace-nowrap
                  ${
                    metricaId === m.id_metrica
                      ? "bg-white text-black"
                      : "border border-outline/30 text-outlineSoft hover:text-white hover:border-white"
                  }`}
              >
                {m.nombre_metrica}
              </button>
            ))}
          </div>
        </div>
        <div>
            <label className="text-[10px] uppercase text-outlineSoft mb-3 block">
                Universidades
            </label>

            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">

                {universidades.map((u) => {
                const selected = selectedUniversidades.includes(u.id_universidad);

                return (
                    <div
                    key={u.id_universidad}
                    onClick={() => {
                        if (selected) {
                        setSelectedUniversidades(prev =>
                            prev.filter(id => id !== u.id_universidad)
                        );
                        } else {
                        setSelectedUniversidades(prev => [...prev, u.id_universidad]);
                        }
                    }}
                    className={`cursor-pointer px-3 py-2 border-l-2 transition-all
                        ${
                        selected
                            ? "bg-white text-black border-white"
                            : "bg-surfaceHigh border-transparent hover:border-white"
                        }`}
                    >
                    <span className="text-[10px] uppercase tracking-wider">
                        {u.nombre_universidad}
                    </span>
                    </div>
                );
                })}

            </div>
        </div>

      </div>
    </aside>
  );
}