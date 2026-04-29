import { useState, useRef, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Chart from "../components/Chart";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

export default function Tendencias() {
  const [rankingId, setRankingId] = useState(1);
  const [metricaId, setMetricaId] = useState(1);
  const [selectedUniversidades, setSelectedUniversidades] = useState([]);
  const [trendsData, setTrendsData] = useState([]);
  const chartRef = useRef(null);

  const RANKING_NAMES = {
    1: "Times Higher Education",
    2: "QS Latam",
    3: "Scimago",
    4: "Shanghai GRAS"
  };
  const handleDownloadExcel = () => {
    if (!trendsData.length) return;
  
    const filtered = selectedUniversidades.length
      ? trendsData.filter(d => selectedUniversidades.includes(d.id_universidad))
      : trendsData;
  
    const rows = filtered
      .sort((a, b) => a.universidad.localeCompare(b.universidad) || a.anio - b.anio)
      .map(r => ({
        Universidad: r.universidad,
        Año: r.anio,
        Valor: r.valor,
        Ranking: RANKING_NAMES[rankingId]
      }));
  
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tendencias");
    XLSX.writeFile(wb, `tendencias_${RANKING_NAMES[rankingId]}.xlsx`);
  };

  const handleDownload = async () => {
    const canvas = await html2canvas(chartRef.current, { backgroundColor: "#1c1b1b" });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 14;
    let y = margin;

    // Título
    pdf.setFontSize(16);
    pdf.setTextColor(20, 20, 20);
    pdf.text("Informe de Tendencias", margin, y);
    y += 8;

    // Subtítulo ranking + métrica
    pdf.setFontSize(10);
    pdf.setTextColor(80, 80, 80);
    pdf.text(`Ranking: ${RANKING_NAMES[rankingId]}`, margin, y);
    y += 12;

    // Gráfico
    const imgW = pageW - margin * 2;
    const imgH = (canvas.height * imgW) / canvas.width;
    pdf.addImage(imgData, "PNG", margin, y, imgW, imgH);
    y += imgH + 10;

    // Tabla de datos
    if (trendsData.length) {
      pdf.setFontSize(11);
      pdf.setTextColor(20, 20, 20);
      pdf.text("Datos", margin, y);
      y += 6;

      // Encabezado tabla
      pdf.setFontSize(8);
      pdf.setFillColor(30, 30, 30);
      pdf.setTextColor(255, 255, 255);
      pdf.rect(margin, y, pageW - margin * 2, 6, "F");
      pdf.text("Universidad", margin + 2, y + 4);
      pdf.text("Año", margin + 100, y + 4);
      pdf.text("Valor", margin + 130, y + 4);
      y += 6;

      // Filas
      const sorted = [...trendsData].sort((a, b) =>
        a.universidad.localeCompare(b.universidad) || a.anio - b.anio
      );

      sorted.forEach((row, i) => {
        if (y > 270) { pdf.addPage(); y = margin; }

        pdf.setFillColor(i % 2 === 0 ? 245 : 255, i % 2 === 0 ? 245 : 255, i % 2 === 0 ? 245 : 255);
        pdf.setTextColor(20, 20, 20);
        pdf.rect(margin, y, pageW - margin * 2, 6, "F");
        pdf.text(String(row.universidad).slice(0, 55), margin + 2, y + 4);
        pdf.text(String(row.anio), margin + 100, y + 4);
        pdf.text(String(row.valor), margin + 130, y + 4);
        y += 6;
      });
    }

    pdf.save("informe_tendencias.pdf");
  };

  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  
  useEffect(() => {
    function handleMouseMove(e) {
      if (!isResizing) return;
  
      const delta = e.clientX - startX.current;
      const newWidth = Math.max(240, Math.min(600, startWidth.current + delta));
  
      setSidebarWidth(newWidth);
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
    <div className="min-h-screen flex flex-col bg-background text-white">
      <div className="flex flex-grow w-full max-w-[1920px] mx-auto">
        <div
          style={{ width: sidebarWidth }}
          className="relative shrink-0"
        >
          {/* Handle */}
          <div
            onMouseDown={(e) => {
              setIsResizing(true);
              startX.current = e.clientX;
              startWidth.current = sidebarWidth;
            }}
            className="absolute top-0 right-0 h-full w-2 cursor-col-resize bg-white/10 hover:bg-white/30 transition z-10"
          />

          <Sidebar
            onDownload={handleDownload}
            onDownloadExcel={handleDownloadExcel}
            rankingId={rankingId}
            setRankingId={setRankingId}
            metricaId={metricaId}
            setMetricaId={setMetricaId}
            selectedUniversidades={selectedUniversidades}
            setSelectedUniversidades={setSelectedUniversidades}
          />
        </div>
        <main className="flex-grow min-w-0 p-10">
          <div ref={chartRef}>
            <Chart
              rankingId={rankingId}
              metricaId={metricaId}
              selectedUniversidades={selectedUniversidades}
              onDataReady={setTrendsData}
            />
          </div>
        </main>
      </div>
    </div>
  );
}