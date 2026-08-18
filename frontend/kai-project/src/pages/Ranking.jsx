import { useState, useMemo, useEffect } from "react";
import { useRankings } from "../hooks/useRankings";
import { useAnios } from "../hooks/useAnios";
import { useRankingResumen } from "../hooks/useRankingResumen";
import { useRankingHistorico } from "../hooks/useRankingHistorico";
import UniversidadLogo from "../components/UniversidadLogo";
import ScoreBar from "../components/data/ScoreBar";
import Sparkline from "../components/data/Sparkline";

const PUCV_ID = 2;
const GRID_COLS = "44px 1fr 210px 120px 150px";
const GRID_COLS_COMPACT = "44px 1fr 210px 120px";

const PlaceholderIcon = ({ nombre, size }) => (
  <div
    className="bg-white/[.08] flex items-center justify-center shrink-0"
    style={{ width: size, height: size }}
  >
    <span style={{ fontSize: size * 0.45 }} className="text-white/[.55] font-medium">
      {nombre?.charAt(0)?.toUpperCase() || "?"}
    </span>
  </div>
);

function exportarCSV(data, rankingNombre, anio) {
  const filas = [
    ["Posición", "Institución", "País", "Score"],
    ...data.map((u, i) => [i + 1, u.nombre_universidad, u.pais_universidad, Number(u.score_total).toFixed(1)]),
  ];
  const csv = filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `ranking_${rankingNombre}_${anio}.csv`.replace(/\s+/g, "_");
  link.click();
}

export default function Ranking() {
  const rankings = useRankings();
  const [rankingId, setRankingId] = useState(null);
  const [anio, setAnio] = useState(null);
  const [densidad, setDensidad] = useState("comoda"); // "comoda" | "compacta"

  const anios = useAnios(rankingId);
  const { data, loading } = useRankingResumen(rankingId, anio);
  const { historicoMap } = useRankingHistorico(rankingId, anios);

  const rankingActual = useMemo(
    () => rankings.find(r => r.id_ranking === rankingId),
    [rankings, rankingId]
  );

  useEffect(() => {
    if (rankings.length && !rankingId) setRankingId(rankings[0].id_ranking);
  }, [rankings, rankingId]);

  useEffect(() => {
    if (anios.length && (!anio || !anios.includes(anio))) {
      setAnio(anios[0]);
    }
  }, [anios, anio]);

  const maxScore = useMemo(
    () => data.reduce((max, u) => Math.max(max, Number(u.score_total) || 0), 0),
    [data]
  );

  const handleRankingChange = (id) => setRankingId(id);

  const esCompacta = densidad === "compacta";
  const gridCols = esCompacta ? GRID_COLS_COMPACT : GRID_COLS;

  return (
    <div className="min-h-screen bg-background text-white">
      <main className="max-w-[1600px] mx-auto px-8 pt-[26px] pb-20">

        {/* Título + controles */}
        <section className="flex items-start justify-between gap-6 flex-wrap mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-outlineSoft mb-2">
              Rankings Institucionales
            </p>
            <h1 className="font-headline text-[30px] font-semibold text-white tracking-[-0.01em]">
              Clasificación de Universidades
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <select
                value={anio || ""}
                onChange={e => setAnio(Number(e.target.value))}
                className="appearance-none bg-[#1c1c1c] border border-white/[.14] text-[#cfcfcf] text-[11px] py-2 pl-3 pr-7 focus:outline-none focus:border-white/40"
              >
                {anios.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-outlineSoft">▾</span>
            </div>
            <button
              onClick={() => setDensidad(d => (d === "comoda" ? "compacta" : "comoda"))}
              className="bg-[#1c1c1c] border border-white/[.14] text-[#cfcfcf] text-[11px] py-2 px-3 hover:border-white/30 transition-colors"
            >
              Densidad ⇕
            </button>
            <button
              onClick={() => data.length && exportarCSV(data, rankingActual?.nombre_ranking || "", anio)}
              disabled={!data.length}
              className="bg-[#1c1c1c] border border-white/[.14] text-[#cfcfcf] text-[11px] py-2 px-3 hover:border-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Exportar
            </button>
          </div>
        </section>

        {/* Pestañas de ranking */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          {rankings.map(r => (
            <button
              key={r.id_ranking}
              onClick={() => handleRankingChange(r.id_ranking)}
              className={`py-[9px] px-4 text-[11.5px] font-semibold border transition-colors ${
                rankingId === r.id_ranking
                  ? "bg-white text-[#111] border-white"
                  : "bg-[#1c1c1c] text-[#9a9a9a] border-white/[.12] hover:text-white"
              }`}
            >
              {r.nombre_ranking}
            </button>
          ))}
        </div>

        {/* Línea de contexto */}
        <div className="flex items-end justify-between gap-4 pb-3 mb-2 border-b border-white/[.12]">
          <p className="text-xs text-[#8a8a8a] max-w-[760px] leading-relaxed">
            {rankingActual?.descripcion_ranking || data[0]?.descripcion_ranking || "Selecciona un ranking para ver su metodología."}
          </p>
          {data.length > 0 && (
            <span className="text-[10px] uppercase tracking-widest text-outlineSoft shrink-0 font-mono">
              {data.length} instituciones
            </span>
          )}
        </div>

        {/* Estados */}
        {!rankingId || !anio ? (
          <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">
            Selecciona un ranking para comenzar.
          </div>
        ) : loading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid items-center gap-4 py-[11px] px-3 border-t border-white/[.05]" style={{ gridTemplateColumns: gridCols }}>
                <div className="h-4 w-6 bg-white/5 animate-pulse" />
                <div className="h-4 w-2/3 bg-white/5 animate-pulse" />
                <div className="h-4 w-full bg-white/5 animate-pulse" />
                <div className="h-4 w-10 bg-white/5 animate-pulse ml-auto" />
                {!esCompacta && <div className="h-4 w-full bg-white/5 animate-pulse" />}
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">
            No hay datos para este ranking en el año seleccionado.
          </div>
        ) : (
          <>
            {/* Encabezado */}
            <div
              className="grid items-center gap-4 py-2.5 px-3 sticky top-16 bg-background z-10 border-b border-white/[.12]"
              style={{ gridTemplateColumns: gridCols }}
            >
              <span className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a]">Pos</span>
              <span className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a]">Institución</span>
              <span className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a]">Score en {rankingActual?.nombre_ranking}</span>
              <span className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a] text-right">Δ año ant.</span>
              {!esCompacta && (
                <span className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a]">
                  Posición {anios[anios.length - 1]}—{String(anios[0]).slice(-2)}
                </span>
              )}
            </div>

            {/* Filas */}
            <div>
              {data.map((uni, i) => {
                const pos = i + 1;
                const esPropia = uni.id_universidad === PUCV_ID;
                const hist = historicoMap[uni.id_universidad];
                const posAnterior = hist?.posicionAnterior;
                const delta = posAnterior != null ? posAnterior - pos : null;

                return (
                  <div
                    key={uni.id_universidad}
                    className={`grid items-center gap-4 border-t border-white/[.05] transition-colors hover:bg-white/[.03] cursor-default ${
                      esCompacta ? "py-2" : "py-[11px]"
                    } px-3`}
                    style={{
                      gridTemplateColumns: gridCols,
                      borderLeft: `2px solid ${esPropia ? "oklch(0.72 0.13 250)" : "transparent"}`,
                      backgroundColor: esPropia ? "rgba(70,130,255,.07)" : undefined,
                    }}
                  >
                    <span className={`font-mono text-[13px] tabular-nums ${esPropia ? "text-white" : "text-[#8a8a8a]"}`}>
                      {String(pos).padStart(2, "0")}
                    </span>

                    <div className="flex items-center gap-3 min-w-0">
                      {!esCompacta && (
                        <UniversidadLogo
                          idUniversidad={uni.id_universidad}
                          nombre={uni.nombre_universidad}
                          size={22}
                          fallback={<PlaceholderIcon nombre={uni.nombre_universidad} size={22} />}
                        />
                      )}
                      <div className="min-w-0 flex items-baseline gap-2">
                        <span className={`font-body font-semibold text-sm truncate ${esPropia ? "text-white" : "text-[#dcdcdc]"}`}>
                          {uni.nombre_universidad}
                        </span>
                        <span className="text-[11px] text-[#6f6f6f] shrink-0">{uni.pais_universidad}</span>
                      </div>
                    </div>

                    <ScoreBar value={Number(uni.score_total) || 0} max={maxScore} isOwn={esPropia} />

                    <span className="font-mono text-[12.5px] text-right tabular-nums">
                      {delta == null || delta === 0 ? (
                        <span className="text-[#6f6f6f]">—</span>
                      ) : delta > 0 ? (
                        <span className="text-positive">▲ {delta}</span>
                      ) : (
                        <span className="text-negative">▼ {Math.abs(delta)}</span>
                      )}
                    </span>

                    {!esCompacta && (
                      <Sparkline
                        posiciones={hist?.historico?.map(h => h.posicion)}
                        isOwn={esPropia}
                        maxPos={Math.max(12, data.length)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-5 text-[11px] text-[#6f6f6f]">
              <span>Mostrando 1–{data.length} · scroll continuo, sin paginación</span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
