import { useState, useMemo, useRef, useEffect } from "react";
import { useRankings } from "../../hooks/useRankings";
import { useAnios } from "../../hooks/useAnios";
import { useUniversidades } from "../../hooks/useUniversidades";


export default function SidebarSimulacion({
  rankingId, setRankingId,
  anio, setAnio,
  selectedUniversidades, setSelectedUniversidades
}) {
  const [width, setWidth] = useState(320); // w-80 inicial
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const rankings = useRankings();
  const anios = useAnios(rankingId);
  const { universidades } = useUniversidades();
  const [search, setSearch] = useState("");

  const filtradas = useMemo(() => {
    if (!universidades) return [];
    return universidades.filter(u =>
      (u.nombre_universidad || "").toLowerCase().includes(search.toLowerCase())
    );
  }, [universidades, search]);

  useEffect(() => {
    function handleMouseMove(e) {
      if (!isResizing) return;
  
      const delta = e.clientX - startX.current;
      const newWidth = Math.max(240, Math.min(600, startWidth.current + delta));
  
      setWidth(newWidth);
    }
  
    function handleMouseUp() {
      setIsResizing(false);
    }
  
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    document.body.style.cursor = isResizing ? "col-resize" : "default";
    document.body.style.userSelect = isResizing ? "none" : "auto";
  }, [isResizing]);

  return (
    <aside
      style={{ width }}
      className="shrink-0 bg-surface border-r border-outline/30 p-6 flex flex-col gap-8 relative"
    >
      <div
        onMouseDown={(e) => {
          setIsResizing(true);
          startX.current = e.clientX;
          startWidth.current = width;
        }}
        className="absolute top-0 right-0 h-full w-2 cursor-col-resize bg-white/10 hover:bg-white/30 transition"
      />

      {/* Ranking */}
      <div>
        <label className="text-[10px] uppercase text-outlineSoft mb-3 block tracking-widest">
          Ranking
        </label>
        <select
          value={rankingId}
          onChange={e => setRankingId(Number(e.target.value))}
          className="w-full bg-surfaceHigh border border-outline/50 text-white py-3 px-4 text-sm focus:outline-none focus:border-white"
        >
          {rankings.map(r => (
            <option key={r.id_ranking} value={r.id_ranking}>{r.nombre_ranking}</option>
          ))}
        </select>
      </div>

      {/* Año */}
      <div>
        <label className="text-[10px] uppercase text-outlineSoft mb-3 block tracking-widest">
          Año
        </label>
        <div className="relative">
          <select
            value={anio || ""}
            onChange={e => setAnio(Number(e.target.value))}
            className="w-full bg-surfaceHigh border border-outline/50 text-white py-3 px-4 text-sm focus:outline-none focus:border-white appearance-none"
          >
            <option value="" disabled>Seleccionar año</option>
            {anios.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-outlineSoft text-xs">▼</div>
        </div>
      </div>

      {/* Universidades */}
      <div className="flex flex-col gap-3 flex-1 min-h-0">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase text-outlineSoft tracking-widest">
            Universidades
          </label>
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
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 bg-surfaceHigh border border-outline/50 text-white text-sm outline-none focus:border-white"
        />

        <div className="flex flex-col gap-2 overflow-y-auto flex-1">
          {filtradas.map(u => {
            const selected = selectedUniversidades.includes(u.id_universidad);
            return (
              <div
                key={u.id_universidad}
                onClick={() => {
                  setSelectedUniversidades(prev =>
                    selected ? prev.filter(id => id !== u.id_universidad) : [...prev, u.id_universidad]
                  );
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

    </aside>
  );
}