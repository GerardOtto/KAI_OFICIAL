import { useState, useMemo } from "react";
import jsPDF from "jspdf";
import { useTiposMetrica } from "../hooks/useTiposMetrica";
import { useMetricasPorTipo } from "../hooks/useMetricasPorTipo";
import { useValoresMetricaUniversidad } from "../hooks/useValoresMetricaUniversidad";
import { useUniversidades } from "../hooks/useUniversidades";
import { useRankings } from "../hooks/useRankings";

const RANKING_COLORS = {
  1: "border-l-blue-400",
  2: "border-l-amber-400",
  3: "border-l-emerald-400",
  4: "border-l-rose-400",
};

const RANKING_BADGE = {
  1: "bg-blue-400/10 text-blue-300",
  2: "bg-amber-400/10 text-amber-300",
  3: "bg-emerald-400/10 text-emerald-300",
  4: "bg-rose-400/10 text-rose-300",
};

const DownloadIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

export default function Metricas() {
  const tipos = useTiposMetrica();
  const { universidades } = useUniversidades();
  const rankings = useRankings();

  const [tipoActivo, setTipoActivo] = useState(null);
  const [universidadId, setUniversidadId] = useState(null);
  const [anio, setAnio] = useState("");
  const [rankingFiltro, setRankingFiltro] = useState(null);
  const [searchUni, setSearchUni] = useState("");
  const [showUniPicker, setShowUniPicker] = useState(false);

  const metricas = useMetricasPorTipo(tipoActivo);
  const valores = useValoresMetricaUniversidad(tipoActivo, universidadId, anio || null);

  const universidadNombre = useMemo(
    () => universidades?.find(u => u.id_universidad === universidadId)?.nombre_universidad || null,
    [universidades, universidadId]
  );

  const unisFiltradas = useMemo(() => {
    if (!universidades) return [];
    return universidades
      .filter(u => u.nombre_universidad.toLowerCase().includes(searchUni.toLowerCase()))
      .slice(0, 30);
  }, [universidades, searchUni]);

  const metricasPorRanking = useMemo(() => {
    const filtradas = rankingFiltro
      ? metricas.filter(m => m.id_ranking === rankingFiltro)
      : metricas;
    return filtradas.reduce((acc, m) => {
      const key = m.id_ranking;
      if (!acc[key]) acc[key] = { nombre: m.nombre_ranking, id: key, items: [] };
      acc[key].items.push(m);
      return acc;
    }, {});
  }, [metricas, rankingFiltro]);

  const valoresMap = useMemo(() =>
    valores.reduce((acc, v) => { acc[v.id_metrica] = v.valor_metrica; return acc; }, {}),
    [valores]
  );

  // Solo métricas con valor definido — usado en descargas cuando hay universidad+año
  const metricasConValor = useMemo(() => {
    if (!universidadId || !anio) return metricas;
    return metricas.filter(m => valoresMap[m.id_metrica] !== undefined);
  }, [metricas, valoresMap, universidadId, anio]);

  const handleCSV = () => {
    if (!tipoActivo || !metricasConValor.length) return;

    const filas = [
      ["Tipo de Métrica", tipoActivo],
      ...(universidadNombre ? [["Universidad", universidadNombre]] : []),
      ...(anio ? [["Año", anio]] : []),
      [],
      ["Ranking", "Métrica", "Peso (%)", "Descripción", ...(universidadId && anio ? ["Valor"] : [])]
    ];

    metricasConValor.forEach(m => {
      const fila = [m.nombre_ranking, m.nombre_metrica, m.peso_metrica, m.descripcion_metrica || ""];
      if (universidadId && anio) fila.push(valoresMap[m.id_metrica]);
      filas.push(fila);
    });

    const csv = filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `metricas_${tipoActivo}${anio ? `_${anio}` : ""}.csv`;
    link.click();
  };

  const handlePDF = () => {
    if (!tipoActivo || !metricasConValor.length) return;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const margin = 14;
    const pageW = pdf.internal.pageSize.getWidth();
    let y = margin;

    pdf.setFontSize(18); pdf.setTextColor(20, 20, 20);
    pdf.text(`KAI — Métricas: ${tipoActivo}`, margin, y); y += 7;

    pdf.setFontSize(9); pdf.setTextColor(100, 100, 100);
    const sub = [universidadNombre && `Universidad: ${universidadNombre}`, anio && `Año: ${anio}`].filter(Boolean).join("   |   ");
    if (sub) { pdf.text(sub, margin, y); y += 5; }

    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, y, pageW - margin, y); y += 6;

    // Agrupar metricasConValor por ranking para el PDF
    const gruposPDF = metricasConValor.reduce((acc, m) => {
      if (!acc[m.id_ranking]) acc[m.id_ranking] = { nombre: m.nombre_ranking, items: [] };
      acc[m.id_ranking].items.push(m);
      return acc;
    }, {});

    Object.values(gruposPDF).forEach(grupo => {
      if (y > 260) { pdf.addPage(); y = margin; }
      pdf.setFontSize(11); pdf.setTextColor(20, 20, 20); pdf.setFont(undefined, "bold");
      pdf.text(grupo.nombre, margin, y); y += 5;
      pdf.setFont(undefined, "normal");

      grupo.items.forEach((m, i) => {
        if (y > 265) { pdf.addPage(); y = margin; }
        const bg = i % 2 === 0 ? 248 : 255;
        pdf.setFillColor(bg, bg, bg);
        pdf.rect(margin, y, pageW - margin * 2, 16, "F");

        pdf.setFontSize(8); pdf.setTextColor(20, 20, 20);
        pdf.text(m.nombre_metrica, margin + 2, y + 5);
        pdf.setFontSize(7); pdf.setTextColor(100, 100, 100);
        pdf.text((m.descripcion_metrica || "Sin descripción").slice(0, 90), margin + 2, y + 11);

        pdf.setFontSize(8); pdf.setTextColor(20, 20, 20);
        pdf.text(`Peso: ${m.peso_metrica}%`, pageW - margin - 40, y + 5);

        if (universidadId && anio) {
          const val = valoresMap[m.id_metrica];
          pdf.setTextColor(20, 20, 20);
          pdf.text(`Valor: ${val}`, pageW - margin - 40, y + 11);
        }
        y += 17;
      });
      y += 4;
    });

    pdf.save(`metricas_${tipoActivo}${anio ? `_${anio}` : ""}.pdf`);
  };

  const contextoCargado = universidadId && anio;

  return (
    <div className="min-h-screen bg-background text-white">
      <main className="pt-10 pb-20 px-12 max-w-[1600px] mx-auto">

        {/* Hero */}
        <section className="mb-12">
          <p className="text-[10px] uppercase tracking-widest text-outlineSoft mb-4">Análisis Transversal</p>
          <h1 className="font-headline text-5xl font-bold text-white mb-4 tracking-tight leading-tight">
            Métricas por Categoría
          </h1>
          <p className="text-outlineSoft max-w-2xl leading-relaxed text-sm">
            Explora las métricas de los rankings agrupadas por su tipo. Selecciona una categoría para ver qué mide cada ranking en esa dimensión, sus pesos y descripciones.
          </p>
        </section>

        {/* Filtros de universidad y año — siempre visibles en banner superior */}
        <div className="mb-8 p-5 bg-surfaceHigh border border-outline/20 flex flex-wrap items-end gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-outlineSoft">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <span className="text-[10px] uppercase tracking-widest text-outlineSoft">Ver valores para una institución</span>
          </div>

          {/* Universidad */}
          <div className="relative flex-1 min-w-[220px]">
            <p className="text-[10px] uppercase tracking-widest text-outlineSoft mb-1.5">Universidad</p>
            <button
              onClick={() => setShowUniPicker(v => !v)}
              className={`w-full border py-2.5 px-3 text-sm text-left flex items-center justify-between transition-colors ${
                universidadNombre
                  ? "bg-white text-black border-white font-medium"
                  : "bg-background border-outline/40 text-outlineSoft hover:border-white hover:text-white"
              }`}
            >
              <span className="text-xs truncate">{universidadNombre || "Seleccionar universidad..."}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            {showUniPicker && (
              <div className="absolute top-full left-0 right-0 z-30 bg-[#1a1a1a] border border-outline/40 max-h-56 overflow-y-auto shadow-xl">
                <div className="p-2 border-b border-outline/20">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Buscar..."
                    value={searchUni}
                    onChange={e => setSearchUni(e.target.value)}
                    className="w-full bg-transparent text-white text-xs px-2 py-1.5 outline-none placeholder:text-outlineSoft"
                  />
                </div>
                {unisFiltradas.map(u => (
                  <button
                    key={u.id_universidad}
                    onClick={() => { setUniversidadId(u.id_universidad); setShowUniPicker(false); setSearchUni(""); }}
                    className="w-full text-left px-3 py-2.5 text-xs text-outlineSoft hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {u.nombre_universidad}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Año */}
          <div className="w-36">
            <p className="text-[10px] uppercase tracking-widest text-outlineSoft mb-1.5">Año</p>
            <input
              type="number"
              placeholder="Ej: 2023"
              value={anio}
              onChange={e => setAnio(e.target.value)}
              className={`w-full border py-2.5 px-3 text-sm focus:outline-none transition-colors ${
                anio
                  ? "bg-white text-black border-white font-medium"
                  : "bg-background border-outline/40 text-outlineSoft focus:border-white focus:text-white"
              }`}
            />
          </div>

          {/* Limpiar */}
          {(universidadId || anio) && (
            <button
              onClick={() => { setUniversidadId(null); setAnio(""); setSearchUni(""); }}
              className="self-end text-[10px] uppercase tracking-wider px-3 py-2.5 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500 hover:text-white transition-all"
            >
              ✕ Limpiar
            </button>
          )}

          {contextoCargado && (
            <div className="self-end flex items-center gap-1.5 text-[10px] text-emerald-400 uppercase tracking-wider">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Mostrando valores
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Sidebar */}
          <aside className="lg:col-span-3 space-y-6">

            {/* Tipos */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-outlineSoft mb-3">Categoría</p>
              <div className="flex flex-col gap-1">
                {tipos.map(tipo => (
                  <button
                    key={tipo}
                    onClick={() => { setTipoActivo(tipo); setRankingFiltro(null); }}
                    className={`w-full text-left px-4 py-3 text-[11px] uppercase tracking-wider transition-colors flex items-center justify-between ${
                      tipoActivo === tipo
                        ? "bg-white text-black font-bold"
                        : "bg-surfaceHigh text-outlineSoft hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <span>{tipo}</span>
                    {tipoActivo === tipo && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro ranking */}
            {tipoActivo && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-outlineSoft mb-3">Filtrar por Ranking</p>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setRankingFiltro(null)}
                    className={`w-full text-left px-4 py-2.5 text-[11px] uppercase tracking-wider transition-colors ${
                      rankingFiltro === null ? "bg-white/15 text-white" : "text-outlineSoft hover:text-white hover:bg-white/5"
                    }`}
                  >
                    Todos los rankings
                  </button>
                  {rankings.map(r => (
                    <button
                      key={r.id_ranking}
                      onClick={() => setRankingFiltro(r.id_ranking)}
                      className={`w-full text-left px-4 py-2.5 text-[11px] uppercase tracking-wider transition-colors ${
                        rankingFiltro === r.id_ranking ? "bg-white/15 text-white" : "text-outlineSoft hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {r.nombre_ranking}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Contenido */}
          <div className="lg:col-span-9">

            {!tipoActivo ? (
              <div className="flex flex-col items-center justify-center h-80 text-center gap-4">
                <div className="w-12 h-12 border border-outline/30 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-outlineSoft">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                  </svg>
                </div>
                <p className="text-outlineSoft text-sm">Selecciona una categoría para explorar sus métricas</p>
              </div>
            ) : (
              <>
                {/* Barra superior */}
                <div className="flex items-start justify-between mb-6 pb-4 border-b border-outline/20 gap-4">
                  <div>
                    <h2 className="font-headline text-2xl text-white">{tipoActivo}</h2>
                    <p className="text-[10px] uppercase tracking-widest text-outlineSoft mt-1">
                      {contextoCargado
                        ? `${metricasConValor.length} de ${metricas.length} métricas con datos · ${universidadNombre} · ${anio}`
                        : `${metricas.length} métricas en ${Object.keys(metricasPorRanking).length} rankings`
                      }
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleCSV}
                      className="flex items-center gap-2 px-4 py-2.5 border border-outline/40 text-[10px] uppercase tracking-widest text-white hover:bg-white hover:text-black transition-all"
                    >
                      <DownloadIcon />
                      Descargar CSV
                    </button>
                    <button
                      onClick={handlePDF}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white text-black text-[10px] uppercase tracking-widest hover:bg-white/80 transition-all"
                    >
                      <DownloadIcon />
                      Descargar PDF
                    </button>
                  </div>
                </div>

                {/* Grupos por ranking */}
                <div className="space-y-8">
                  {Object.values(metricasPorRanking).map(grupo => (
                    <div key={grupo.id}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`text-[10px] uppercase tracking-widest px-2.5 py-1 ${RANKING_BADGE[grupo.id] || "bg-white/10 text-white/60"}`}>
                          {grupo.nombre}
                        </span>
                        <span className="text-[10px] text-outlineSoft">
                          {contextoCargado
                            ? `${grupo.items.filter(m => valoresMap[m.id_metrica] !== undefined).length} de ${grupo.items.length} con datos`
                            : `${grupo.items.length} métricas`
                          }
                        </span>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                        {grupo.items.map(m => {
                          const valor = valoresMap[m.id_metrica];
                          const tieneValor = valor !== undefined;
                          const sinDatos = contextoCargado && !tieneValor;

                          return (
                            <div
                              key={m.id_metrica}
                              className={`border-l-2 p-5 flex flex-col gap-2 transition-opacity ${
                                RANKING_COLORS[m.id_ranking] || "border-l-white/20"
                              } ${sinDatos ? "bg-white/[0.02] opacity-40" : "bg-surfaceHigh"}`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <h3 className="text-sm font-semibold text-white leading-snug">{m.nombre_metrica}</h3>
                                <div className="flex items-center gap-3 shrink-0">
                                  {tieneValor && (
                                    <span className="font-mono text-lg text-white">{valor}</span>
                                  )}
                                  <span className="text-[10px] uppercase tracking-wider text-outlineSoft bg-white/5 px-2 py-1">
                                    {m.peso_metrica}%
                                  </span>
                                </div>
                              </div>
                              {m.descripcion_metrica && (
                                <p className="text-xs text-outlineSoft leading-relaxed">{m.descripcion_metrica}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}