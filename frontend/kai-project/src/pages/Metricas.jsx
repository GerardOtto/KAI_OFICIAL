import { useState, useMemo } from "react";
import jsPDF from "jspdf";
import { useTiposMetrica } from "../hooks/useTiposMetrica";
import { useMetricasMatriz } from "../hooks/useMetricasMatriz";
import { useValoresMatriz } from "../hooks/useValoresMatriz";
import { useUniversidades } from "../hooks/useUniversidades";
import { useRankings } from "../hooks/useRankings";
import HeatCell from "../components/data/HeatCell";

const DownloadIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const LEYENDA_PESOS = [3, 8, 13, 20, 30];

function alphaForPeso(peso) {
  const clamped = Math.min(peso, 25);
  return 0.08 + (clamped / 25) * 0.42;
}

function formatNumero(v) {
  if (v == null) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("es-CL", { maximumFractionDigits: n % 1 === 0 ? 0 : 2 });
}

export default function Metricas() {
  const tipos = useTiposMetrica();
  const { universidades } = useUniversidades();
  const rankings = useRankings();

  const [universidadId, setUniversidadId] = useState(null);
  const [anio, setAnio] = useState("");
  const [searchUni, setSearchUni] = useState("");
  const [showUniPicker, setShowUniPicker] = useState(false);

  const { matriz, loading } = useMetricasMatriz(tipos);
  const { valoresMap } = useValoresMatriz(tipos, universidadId, anio || null);

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

  // Dimensiones (filas), ordenadas por cuántas métricas reales agrupan
  const dimensiones = useMemo(() => {
    return [...tipos].sort((a, b) => (matriz[b]?.length || 0) - (matriz[a]?.length || 0));
  }, [tipos, matriz]);

  // Para cada (dimensión, ranking): metricas que caen ahí, peso sumado, y la
  // métrica de mayor peso como "representativa" para el valor de la celda.
  const celda = (tipo, idRanking) => {
    const items = (matriz[tipo] || []).filter(m => m.id_ranking === idRanking);
    if (items.length === 0) return null;
    const pesoTotal = items.reduce((s, m) => s + Number(m.peso_metrica || 0), 0);
    const principal = [...items].sort((a, b) => Number(b.peso_metrica || 0) - Number(a.peso_metrica || 0))[0];
    const valor = valoresMap[principal.id_metrica];
    const tooltip = items
      .map(m => `${m.nombre_metrica} (${m.peso_metrica}%)${valoresMap[m.id_metrica] != null ? `: ${formatNumero(valoresMap[m.id_metrica])}` : ""}`)
      .join("\n");
    return { pesoTotal, valor, tooltip, items };
  };

  const contextoCargado = universidadId && anio;

  const handleCSV = () => {
    const filas = [
      ["Dimensión", "Ranking", "Métrica", "Peso (%)", ...(contextoCargado ? ["Valor"] : [])],
    ];
    dimensiones.forEach(tipo => {
      (matriz[tipo] || []).forEach(m => {
        const fila = [tipo, m.nombre_ranking, m.nombre_metrica, m.peso_metrica];
        if (contextoCargado) fila.push(valoresMap[m.id_metrica] ?? "");
        filas.push(fila);
      });
    });
    const csv = filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `matriz_metricas${anio ? `_${anio}` : ""}.csv`;
    link.click();
  };

  const handlePDF = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const margin = 12;
    const pageW = pdf.internal.pageSize.getWidth();
    let y = margin;

    pdf.setFontSize(16); pdf.setTextColor(20, 20, 20);
    pdf.text("KAI — Qué mide cada ranking, y cuánto pesa", margin, y); y += 6;
    pdf.setFontSize(9); pdf.setTextColor(100, 100, 100);
    const sub = [universidadNombre && `Institución: ${universidadNombre}`, anio && `Año: ${anio}`].filter(Boolean).join("   |   ");
    if (sub) { pdf.text(sub, margin, y); y += 5; }
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, y, pageW - margin, y); y += 6;

    dimensiones.forEach(tipo => {
      const items = matriz[tipo] || [];
      if (!items.length) return;
      if (y > 190) { pdf.addPage(); y = margin; }
      pdf.setFontSize(11); pdf.setTextColor(20, 20, 20); pdf.setFont(undefined, "bold");
      pdf.text(tipo, margin, y); y += 5;
      pdf.setFont(undefined, "normal");

      items.forEach((m, i) => {
        if (y > 195) { pdf.addPage(); y = margin; }
        const bg = i % 2 === 0 ? 248 : 255;
        pdf.setFillColor(bg, bg, bg);
        pdf.rect(margin, y, pageW - margin * 2, 6, "F");
        pdf.setFontSize(8); pdf.setTextColor(20, 20, 20);
        pdf.text(`${m.nombre_ranking} · ${m.nombre_metrica}`, margin + 2, y + 4);
        pdf.text(`${m.peso_metrica}%`, pageW - margin - 30, y + 4);
        if (contextoCargado && valoresMap[m.id_metrica] != null) {
          pdf.text(String(valoresMap[m.id_metrica]), pageW - margin - 15, y + 4);
        }
        y += 6.5;
      });
      y += 3;
    });

    pdf.save(`matriz_metricas${anio ? `_${anio}` : ""}.pdf`);
  };

  return (
    <div className="min-h-screen bg-background text-white">
      <main className="max-w-[1600px] mx-auto px-8 pt-[26px] pb-20">

        {/* Cabecera */}
        <section className="flex items-start justify-between gap-6 flex-wrap mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-outlineSoft mb-2 font-mono">
              Análisis transversal{universidadNombre ? ` · ${universidadNombre}` : ""}{anio ? ` · ${anio}` : ""}
            </p>
            <h2 className="font-headline text-[28px] font-semibold text-white tracking-[-0.01em] mb-2">
              Qué mide cada ranking, y cuánto pesa
            </h2>
            <p className="text-xs text-[#8a8a8a] max-w-2xl leading-relaxed">
              Intensidad = peso de la métrica en ese ranking. Número = valor {universidadNombre || "de la institución seleccionada"}.
              Celda vacía = el ranking no mide esa dimensión.
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
        </section>

        {/* Selector de institución + año */}
        <div className="mb-8 p-5 bg-surfaceHigh border border-outline/20 flex flex-wrap items-end gap-6">
          <div className="relative flex-1 min-w-[220px]">
            <p className="text-[10px] uppercase tracking-widest text-outlineSoft mb-1.5">Institución</p>
            <button
              onClick={() => setShowUniPicker(v => !v)}
              className={`w-full border py-2.5 px-3 text-sm text-left flex items-center justify-between transition-colors ${
                universidadNombre
                  ? "bg-white text-black border-white font-medium"
                  : "bg-background border-outline/40 text-outlineSoft hover:border-white hover:text-white"
              }`}
            >
              <span className="text-xs truncate">{universidadNombre || "Seleccionar institución..."}</span>
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

          <div className="w-36">
            <p className="text-[10px] uppercase tracking-widest text-outlineSoft mb-1.5">Año</p>
            <input
              type="number"
              placeholder="Ej: 2024"
              value={anio}
              onChange={e => setAnio(e.target.value)}
              className={`w-full border py-2.5 px-3 text-sm focus:outline-none transition-colors ${
                anio
                  ? "bg-white text-black border-white font-medium"
                  : "bg-background border-outline/40 text-outlineSoft focus:border-white focus:text-white"
              }`}
            />
          </div>

          {(universidadId || anio) && (
            <button
              onClick={() => { setUniversidadId(null); setAnio(""); setSearchUni(""); }}
              className="self-end text-[10px] uppercase tracking-wider px-3 py-2.5 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500 hover:text-white transition-all"
            >
              ✕ Limpiar
            </button>
          )}
        </div>

        {/* Matriz */}
        {loading ? (
          <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">Cargando...</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Encabezado de rankings */}
              <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: `250px repeat(${rankings.length}, 1fr)` }}>
                <div />
                {rankings.map(r => (
                  <div key={r.id_ranking} className="font-mono text-[10px] uppercase tracking-widest text-outlineSoft text-center py-2">
                    {r.nombre_ranking}
                  </div>
                ))}
              </div>

              {/* Filas */}
              <div className="space-y-1.5">
                {dimensiones.map(tipo => (
                  <div key={tipo} className="grid gap-1.5" style={{ gridTemplateColumns: `250px repeat(${rankings.length}, 1fr)` }}>
                    <div className="flex flex-col justify-center pr-3">
                      <span className="font-body font-semibold text-[12.5px] text-[#e6e6e6]">{tipo}</span>
                    </div>
                    {rankings.map(r => {
                      const c = celda(tipo, r.id_ranking);
                      return (
                        <HeatCell
                          key={r.id_ranking}
                          peso={c?.pesoTotal ?? null}
                          valor={c?.valor ?? null}
                          valorFormateado={c ? formatNumero(c.valor) : null}
                          titulo={c?.tooltip}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Leyenda */}
              <div className="flex items-center gap-3 mt-6 text-[11px] text-outlineSoft">
                <span>Peso bajo</span>
                {LEYENDA_PESOS.map(p => (
                  <div
                    key={p}
                    className="w-[26px] h-[10px] border border-white/10"
                    style={{ backgroundColor: `oklch(0.72 0.13 250 / ${alphaForPeso(p)})` }}
                  />
                ))}
                <span>Peso alto</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
