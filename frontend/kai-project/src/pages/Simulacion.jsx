import { useState } from "react";
import jsPDF from "jspdf";
import SidebarSimulacion from "../components/simulacion/SidebarSimulacion";
import TablaSimulacion from "../components/simulacion/TablaSimulacion";
import AgenteIA from "../components/simulacion/AgenteIA";
import { useRankings } from "../hooks/useRankings";

export default function Simulacion() {
  const [rankingId, setRankingId] = useState(1);
  const [anio, setAnio] = useState(null);
  const [selectedUniversidades, setSelectedUniversidades] = useState([]);
  const [tablaData, setTablaData] = useState({ filas: [], metricas: [], overrides: {} });

  const rankings = useRankings();

  const handleRankingChange = (id) => {
    setRankingId(id);
    setAnio(null);
  };

  const rankingNombre = rankings.find(r => r.id_ranking === rankingId)?.nombre_ranking || `Ranking ${rankingId}`;

  const getValor = (idUni, idMetrica, original) =>
    tablaData.overrides[idUni]?.[idMetrica] ?? original ?? 0;

  const calcScore = (fila) =>
    tablaData.metricas.reduce((acc, m) => {
      const val = parseFloat(getValor(fila.id_universidad, m.id_metrica, fila.valores[m.id_metrica])) || 0;
      return acc + val * (parseFloat(m.peso_metrica) || 0);
    }, 0);

  const handleCSV = () => {
    const { filas, metricas } = tablaData;
    if (!filas.length) return;

    const headers = ["Institución", ...metricas.map(m => `${m.nombre_metrica} (${m.peso_metrica}%)`), "Score Total"];
    const rows = filas.map(f => [
      f.nombre,
      ...metricas.map(m => getValor(f.id_universidad, m.id_metrica, f.valores[m.id_metrica])),
      calcScore(f).toFixed(2)
    ]);

    const csv = [
      `Ranking:,${rankingNombre}`,
      `Año:,${anio}`,
      `Instituciones:,${filas.length}`,
      "",
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `simulacion_${rankingNombre}_${anio}.csv`;
    link.click();
  };

  const handlePDF = () => {
    const { filas, metricas } = tablaData;
    if (!filas.length) return;

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 14;
    let y = margin;

    // Encabezado
    pdf.setFontSize(18);
    pdf.setTextColor(20, 20, 20);
    pdf.text("KAI — Informe de Simulación", margin, y);
    y += 8;

    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Ranking: ${rankingNombre}   |   Año: ${anio}   |   Instituciones: ${filas.length}`, margin, y);
    y += 10;

    // Línea separadora
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, y, pageW - margin, y);
    y += 6;

    // Cabecera tabla
    const colW = Math.min(38, (pageW - margin * 2 - 50) / metricas.length);
    const instW = 50;

    pdf.setFontSize(7);

    // Celda Institución
    pdf.setFillColor(20, 20, 20);
    pdf.setTextColor(255, 255, 255);
    pdf.rect(margin, y, instW, 8, "F");
    pdf.text("Institución", margin + 2, y + 5);

    // Celdas métricas
    metricas.forEach((m, i) => {
    const x = margin + instW + i * colW;
    pdf.setFillColor(20, 20, 20);
    pdf.setTextColor(255, 255, 255); // reset explícito por cada celda
    pdf.rect(x, y, colW, 8, "F");
    pdf.text(m.nombre_metrica.slice(0, 12), x + 2, y + 5);
    });

    // Celda Score
    const scoreX = margin + instW + metricas.length * colW;
    pdf.setFillColor(40, 40, 40);
    pdf.setTextColor(255, 255, 255); // reset explícito
    pdf.rect(scoreX, y, 24, 8, "F");
    pdf.text("Score", scoreX + 2, y + 5);
    y += 8;

    // Filas ordenadas por score
    const filasOrdenadas = [...filas].sort((a, b) => calcScore(b) - calcScore(a));

    filasOrdenadas.forEach((fila, idx) => {
        if (y > 185) { pdf.addPage(); y = margin; }
      
        const rowH = 7;
        const bgVal = idx % 2 === 0 ? 248 : 255;
      
        // Institución
        pdf.setFillColor(bgVal, bgVal, bgVal);
        pdf.setTextColor(20, 20, 20);
        pdf.rect(margin, y, instW, rowH, "F");
        pdf.setFontSize(7);
        pdf.text(fila.nombre.slice(0, 28), margin + 2, y + 4.5);
      
        // Métricas
        metricas.forEach((m, i) => {
          const x = margin + instW + i * colW;
          pdf.setFillColor(bgVal, bgVal, bgVal); // reset por cada celda
          pdf.rect(x, y, colW, rowH, "F");
          const val = getValor(fila.id_universidad, m.id_metrica, fila.valores[m.id_metrica]);
          const modificado = tablaData.overrides[fila.id_universidad]?.[m.id_metrica] !== undefined;
          pdf.setTextColor(modificado ? 100 : 20, modificado ? 80 : 20, modificado ? 180 : 20);
          pdf.text(String(val), x + 2, y + 4.5);
        });
      
        // Score
        pdf.setFillColor(235, 235, 235);
        pdf.setTextColor(20, 20, 20);
        pdf.rect(scoreX, y, 24, rowH, "F");
        pdf.setFont(undefined, "bold");
        pdf.text(calcScore(fila).toFixed(1), scoreX + 2, y + 4.5);
        pdf.setFont(undefined, "normal");
        y += rowH;
      });

    // Nota valores modificados
    y += 6;
    pdf.setFontSize(7);
    pdf.setTextColor(100, 80, 180);
    pdf.text("* Valores en morado fueron modificados en la simulación.", margin, y);

    pdf.save(`simulacion_${rankingNombre}_${anio}.pdf`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-white">
      <div className="flex flex-grow w-full max-w-[1920px] mx-auto overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>

        <SidebarSimulacion
          rankingId={rankingId}
          setRankingId={handleRankingChange}
          anio={anio}
          setAnio={setAnio}
          selectedUniversidades={selectedUniversidades}
          setSelectedUniversidades={setSelectedUniversidades}
        />

        <main className="flex-grow min-w-0 flex flex-col overflow-hidden">

          {/* Barra de acciones */}
          {anio && selectedUniversidades.length > 0 && (
            <div className="flex items-center justify-end gap-3 px-6 py-3 border-b border-outline/20 bg-background shrink-0">
              <span className="text-[10px] uppercase tracking-widest text-outlineSoft mr-2">
                {rankingNombre} · {anio}
              </span>
              <button
                onClick={handleCSV}
                className="flex items-center gap-2 px-4 py-2 border border-outline/40 text-[10px] uppercase tracking-widest text-white hover:bg-white hover:text-black transition-all"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Exportar CSV
              </button>
              <button
                onClick={handlePDF}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black text-[10px] uppercase tracking-widest hover:bg-white/80 transition-all"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Exportar PDF
              </button>
            </div>
          )}

          <div className="flex-1 flex overflow-hidden">
            <TablaSimulacion
              rankingId={rankingId}
              anio={anio}
              selectedUniversidades={selectedUniversidades}
              onDataChange={setTablaData}
            />
          </div>
          <AgenteIA />
        </main>

      </div>
    </div>
  );
}