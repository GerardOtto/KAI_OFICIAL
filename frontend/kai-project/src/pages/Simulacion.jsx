import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRankings } from "../hooks/useRankings";
import { useAnios } from "../hooks/useAnios";
import { useUniversidades } from "../hooks/useUniversidades";
import { useMetricas } from "../hooks/useMetricas";
import SimulacionUnitaria from "../components/simulacion/SimulacionUnitaria";
import SimulacionComparada from "../components/simulacion/SimulacionComparada";
import AgenteIA from "../components/simulacion/AgenteIA";

const MODOS = [
  { modo: "unitaria", label: "Unitaria" },
  { modo: "comparada", label: "Comparada" },
];

export default function Simulacion() {
  const { modo: modoParam } = useParams();
  const navigate = useNavigate();
  const modo = MODOS.some(m => m.modo === modoParam) ? modoParam : "comparada";

  const [rankingId, setRankingId] = useState(1);
  const [anio, setAnio] = useState(null);
  const [institucionUnitaria, setInstitucionUnitaria] = useState(null);
  const [institucionesComparada, setInstitucionesComparada] = useState([]);
  const [disciplinaFiltro, setDisciplinaFiltro] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [searchUni, setSearchUni] = useState("");

  const rankings = useRankings();
  const anios = useAnios(rankingId);
  const { universidades } = useUniversidades();
  const metricasRanking = useMetricas(rankingId);

  const disciplinas = useMemo(
    () => [...new Set(metricasRanking.map(m => m.disciplina).filter(d => d && d !== "General"))].sort(),
    [metricasRanking]
  );

  useEffect(() => {
    if (anios.length && (!anio || !anios.includes(anio))) setAnio(anios[0]);
  }, [anios, anio]);

  const rankingNombre = rankings.find(r => r.id_ranking === rankingId)?.nombre_ranking || "";

  const unisFiltradas = useMemo(() => {
    if (!universidades) return [];
    return universidades.filter(u => u.nombre_universidad.toLowerCase().includes(searchUni.toLowerCase())).slice(0, 30);
  }, [universidades, searchUni]);

  const handleRankingChange = (id) => {
    setRankingId(id);
    setAnio(null);
    setInstitucionUnitaria(null);
    setInstitucionesComparada([]);
    setDisciplinaFiltro(null);
  };

  const nombreUnitaria = universidades?.find(u => u.id_universidad === institucionUnitaria)?.nombre_universidad;

  return (
    <div className="min-h-screen bg-background text-white">
      <main className="max-w-[1600px] mx-auto px-8 pt-[22px] pb-10">

        {/* Título + tabs de modo */}
        <section className="flex items-end justify-between gap-4 flex-wrap mb-1">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-outlineSoft mb-2">
              Simulación · {rankingNombre} · {anio ?? "—"} · modo {modo}
            </p>
            <h2 className="font-headline text-[28px] font-semibold text-white tracking-[-0.01em]">
              Simulación de escenarios
            </h2>
          </div>
          <div className="flex gap-1.5">
            {MODOS.map(m => (
              <button
                key={m.modo}
                onClick={() => navigate(`/simulacion/${m.modo}`)}
                className={`font-body font-semibold text-[11px] py-2 px-4 border transition-colors ${
                  modo === m.modo ? "bg-white text-[#111] border-white" : "bg-[#1c1c1c] text-[#9a9a9a] border-white/[.14] hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </section>

        {/* Controles: ranking / año / instituciones */}
        <div className="flex items-end gap-3 flex-wrap py-4 mb-2 border-b border-white/[.08]">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#7a7a7a] mb-1.5">Ranking</p>
            <select
              value={rankingId}
              onChange={e => handleRankingChange(Number(e.target.value))}
              className="bg-[#1c1c1c] border border-white/[.14] text-[#cfcfcf] text-[11px] py-2 px-3 focus:outline-none focus:border-white/40"
            >
              {rankings.map(r => (
                <option key={r.id_ranking} value={r.id_ranking}>{r.nombre_ranking}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#7a7a7a] mb-1.5">Año</p>
            <select
              value={anio || ""}
              onChange={e => setAnio(Number(e.target.value))}
              className="bg-[#1c1c1c] border border-white/[.14] text-[#cfcfcf] text-[11px] py-2 px-3 focus:outline-none focus:border-white/40"
            >
              {anios.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {disciplinas.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#7a7a7a] mb-1.5">Disciplina</p>
              <select
                value={disciplinaFiltro || ""}
                onChange={e => setDisciplinaFiltro(e.target.value || null)}
                className="bg-[#1c1c1c] border border-white/[.14] text-[#cfcfcf] text-[11px] py-2 px-3 focus:outline-none focus:border-white/40"
              >
                <option value="">Todas</option>
                {disciplinas.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          <div className="relative">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#7a7a7a] mb-1.5">
              {modo === "unitaria" ? "Institución" : `Instituciones (${institucionesComparada.length})`}
            </p>
            <button
              onClick={() => setShowPicker(v => !v)}
              className="bg-[#1c1c1c] border border-white/[.14] text-[#cfcfcf] text-[11px] py-2 px-3 min-w-[220px] text-left flex items-center justify-between gap-3 hover:border-white/30 transition-colors"
            >
              <span className="truncate">
                {modo === "unitaria"
                  ? nombreUnitaria || "Seleccionar..."
                  : institucionesComparada.length ? `${institucionesComparada.length} seleccionadas` : "Seleccionar..."}
              </span>
              <span className="text-[8px] text-outlineSoft shrink-0">▾</span>
            </button>

            {showPicker && (
              <div className="absolute top-full left-0 mt-1 w-[300px] bg-[#1a1a1a] border border-white/[.18] shadow-[0_12px_32px_rgba(0,0,0,.5)] z-30">
                <div className="p-2 border-b border-white/[.1]">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Buscar..."
                    value={searchUni}
                    onChange={e => setSearchUni(e.target.value)}
                    className="w-full bg-transparent text-white text-xs px-2 py-1.5 outline-none placeholder:text-outlineSoft"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {unisFiltradas.map(u => {
                    const seleccionada = modo === "unitaria"
                      ? institucionUnitaria === u.id_universidad
                      : institucionesComparada.includes(u.id_universidad);
                    return (
                      <button
                        key={u.id_universidad}
                        onClick={() => {
                          if (modo === "unitaria") {
                            setInstitucionUnitaria(u.id_universidad);
                            setShowPicker(false);
                          } else {
                            setInstitucionesComparada(prev =>
                              prev.includes(u.id_universidad) ? prev.filter(id => id !== u.id_universidad) : [...prev, u.id_universidad]
                            );
                          }
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                          seleccionada ? "bg-white/[.08] text-white" : "text-[#9a9a9a] hover:text-white hover:bg-white/[.04]"
                        }`}
                      >
                        {u.nombre_universidad}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cuerpo por modo */}
        {modo === "unitaria" ? (
          <SimulacionUnitaria
            rankingId={rankingId}
            anio={anio}
            rankingNombre={rankingNombre}
            universidadId={institucionUnitaria}
            disciplinaFiltro={disciplinaFiltro}
          />
        ) : (
          <SimulacionComparada
            rankingId={rankingId}
            anio={anio}
            rankingNombre={rankingNombre}
            selectedUniversidades={institucionesComparada}
            disciplinaFiltro={disciplinaFiltro}
          />
        )}
      </main>

      <AgenteIA />
    </div>
  );
}
