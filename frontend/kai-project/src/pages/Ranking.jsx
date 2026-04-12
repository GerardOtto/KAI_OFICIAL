import { useState, useMemo } from "react";
import { useRankings } from "../hooks/useRankings";
import { useAnios } from "../hooks/useAnios";
import { useRankingResumen } from "../hooks/useRankingResumen";

export default function Ranking() {
  const rankings = useRankings();
  const [rankingId, setRankingId] = useState(null);
  const [anio, setAnio] = useState(null);
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 15;

  const anios = useAnios(rankingId);
  const { data, loading } = useRankingResumen(rankingId, anio);

  const rankingActual = useMemo(
    () => rankings.find(r => r.id_ranking === rankingId),
    [rankings, rankingId]
  );

  // Setear defaults cuando cargan rankings/anios
  useState(() => {
    if (rankings.length && !rankingId) setRankingId(rankings[0].id_ranking);
  }, [rankings]);

  useState(() => {
    if (anios.length && !anio) setAnio(anios[0]);
  }, [anios]);

  const totalPaginas = Math.ceil(data.length / POR_PAGINA);
  const filasPagina = data.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const offsetGlobal = (pagina - 1) * POR_PAGINA;

  const handleRankingChange = (id) => {
    setRankingId(id);
    setAnio(null);
    setPagina(1);
  };

  return (
    <div className="min-h-screen bg-background text-white">

      <main className="pt-10 pb-20 px-12 max-w-[1600px] mx-auto">

        {/* Hero */}
        <section className="mb-16">
          <p className="text-[10px] uppercase tracking-widest text-outlineSoft mb-4">
            Rankings Académicos
          </p>
          <h1 className="font-headline text-5xl font-bold text-white mb-4 tracking-tight max-w-3xl leading-tight">
            Perspectiva Global de Excelencia Académica
          </h1>
          <p className="text-on-surface-variant max-w-2xl leading-relaxed text-sm">
            Clasificación de instituciones de educación superior a través de métricas de investigación, impacto académico y reputación internacional.
          </p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Sidebar */}
          <aside className="lg:col-span-3 space-y-2">
            <div className="mb-4 px-4 py-2 bg-white/5 inline-block">
              <span className="text-[10px] uppercase tracking-[0.2em] text-outlineSoft">Índices Disponibles</span>
            </div>

            <div className="flex flex-col gap-1">
              {rankings.map(r => (
                <button
                  key={r.id_ranking}
                  onClick={() => handleRankingChange(r.id_ranking)}
                  className={`w-full text-left p-4 flex justify-between items-center transition-colors text-sm uppercase tracking-wider ${
                    rankingId === r.id_ranking
                      ? "bg-white text-black font-bold"
                      : "bg-surfaceHigh text-white hover:bg-white/10"
                  }`}
                >
                  <span>{r.nombre_ranking}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              ))}
            </div>

            {/* Descripción */}
            {rankingActual && (
              <div className="mt-8 bg-surfaceHigh p-6 space-y-4">
                <h3 className="font-headline text-lg text-white">Sobre este Ranking</h3>
                <p className="text-sm text-outlineSoft leading-relaxed">
                  {data[0]?.descripcion_ranking || "Sin descripción disponible."}
                </p>
                <button
                  disabled
                  className="w-full mt-2 py-3 px-4 border border-outline/30 text-[10px] uppercase tracking-widest text-outlineSoft cursor-not-allowed opacity-50 flex items-center justify-center gap-2"
                  title="Próximamente"
                >
                  <span>Ver metodología completa</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            )}

            {/* Selector de año */}
            {anios.length > 0 && (
              <div className="mt-6">
                <label className="text-[10px] uppercase tracking-widest text-outlineSoft mb-3 block">Año</label>
                <div className="relative">
                  <select
                    value={anio || ""}
                    onChange={e => { setAnio(Number(e.target.value)); setPagina(1); }}
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
            )}
          </aside>

          {/* Contenido principal */}
          <div className="lg:col-span-9 space-y-6">

            {/* Info bar */}
            <div className="flex items-center justify-between pb-4 border-b border-outline/20">
              <span className="text-[10px] uppercase tracking-widest text-outlineSoft">
                {rankingActual?.nombre_ranking || "Selecciona un ranking"}{anio ? ` · ${anio}` : ""}
              </span>
              {data.length > 0 && (
                <span className="text-[10px] uppercase tracking-widest text-outlineSoft">
                  {data.length} instituciones
                </span>
              )}
            </div>

            {/* Estado vacío */}
            {!rankingId || !anio ? (
              <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">
                Selecciona un ranking y un año para comenzar.
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">
                Cargando...
              </div>
            ) : data.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">
                No hay datos para este ranking y año.
              </div>
            ) : (
              <>
                {/* Tabla */}
                <div className="bg-surfaceHigh overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-outline/20">
                        <th className="p-5 text-[10px] uppercase tracking-[0.2em] text-outlineSoft font-normal w-20">Pos.</th>
                        <th className="p-5 text-[10px] uppercase tracking-[0.2em] text-outlineSoft font-normal">Institución</th>
                        <th className="p-5 text-[10px] uppercase tracking-[0.2em] text-outlineSoft font-normal">País</th>
                        <th className="p-5 text-[10px] uppercase tracking-[0.2em] text-outlineSoft font-normal text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline/10">
                      {filasPagina.map((uni, i) => {
                        const pos = offsetGlobal + i + 1;
                        const isTop3 = pos <= 3;
                        return (
                          <tr key={uni.id_universidad} className="hover:bg-white/[0.03] transition-colors">
                            <td className="p-5">
                              <span className={`font-headline text-2xl ${isTop3 ? "text-white" : "text-outlineSoft"}`}>
                                {String(pos).padStart(2, "0")}
                              </span>
                            </td>
                            <td className="p-5">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white/5 flex items-center justify-center shrink-0">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-outlineSoft">
                                    <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
                                  </svg>
                                </div>
                                <div>
                                  <div className={`font-headline text-base ${isTop3 ? "text-white" : "text-white/80"}`}>
                                    {uni.nombre_universidad}
                                  </div>
                                  <div className="text-[10px] uppercase tracking-widest text-outlineSoft mt-0.5">
                                    {uni.pais_universidad}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-5 text-sm text-outlineSoft">
                              {uni.pais_universidad}
                            </td>
                            <td className="p-5 text-right">
                              <span className={`font-headline text-xl ${isTop3 ? "text-white" : "text-outlineSoft"}`}>
                                {Number(uni.score_total).toFixed(1)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {totalPaginas > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-6">
                    <button
                      onClick={() => setPagina(p => Math.max(1, p - 1))}
                      disabled={pagina === 1}
                      className="w-10 h-10 flex items-center justify-center border border-outline/30 hover:bg-white hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6"/>
                      </svg>
                    </button>

                    {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                      const p = Math.min(Math.max(pagina - 2, 1) + i, totalPaginas);
                      return (
                        <button
                          key={p}
                          onClick={() => setPagina(p)}
                          className={`w-10 h-10 flex items-center justify-center text-sm transition-all ${
                            p === pagina ? "bg-white text-black font-bold" : "bg-surfaceHigh hover:bg-white/10"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                      disabled={pagina === totalPaginas}
                      className="w-10 h-10 flex items-center justify-center border border-outline/30 hover:bg-white hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}