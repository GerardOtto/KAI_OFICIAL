import { useState, useRef } from "react";
import Sidebar from "../components/Sidebar";
import Chart from "../components/Chart";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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

  return (
    <div className="min-h-screen flex flex-col bg-background text-white">
      <div className="flex flex-grow w-full max-w-[1920px] mx-auto">
        <Sidebar
          onDownload={handleDownload}
          rankingId={rankingId}
          setRankingId={setRankingId}
          metricaId={metricaId}
          setMetricaId={setMetricaId}
          selectedUniversidades={selectedUniversidades}
          setSelectedUniversidades={setSelectedUniversidades}
        />
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