import { useState, useEffect } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import Chart from "../components/Chart";
import Legend from "../components/Legend";

export default function Tendencias() {

  const [rankingId, setRankingId] = useState(1);
  const [metricaId, setMetricaId] = useState(1);
  const [selectedUniversidades, setSelectedUniversidades] = useState([]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-[#e5e2e1] font-body">

      <Header />

      <div className="flex flex-grow w-full max-w-[1920px] mx-auto">

      <Sidebar
        rankingId={rankingId}
        setRankingId={setRankingId}
        metricaId={metricaId}
        setMetricaId={setMetricaId}
        selectedUniversidades={selectedUniversidades}
        setSelectedUniversidades={setSelectedUniversidades}
        />

        <main className="flex-grow p-10 md:p-16">

          <div className="flex justify-between items-start mb-16">
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-outlineSoft block mb-4">
                Analytical Workbench // Trend Analysis
              </span>

              <h1 className="text-5xl font-headline font-bold">
                Gráfica de tendencias
              </h1>
            </div>

            <button className="flex items-center gap-3 bg-white text-black px-6 py-4 text-xs uppercase tracking-widest">
              <span className="material-symbols-outlined text-sm">
                download
              </span>
              Exportar gráfico y datos
            </button>
          </div>

          <Chart
            rankingId={rankingId}
            metricaId={metricaId}
            selectedUniversidades={selectedUniversidades}
            />
          <Legend />

        </main>
      </div>

      <footer className="bg-[#0e0e0e] px-12 py-10 border-t border-outline/20">
        <div className="text-sm font-bold font-headline">KAI</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-widest">
          © 2024 KAI. Todos los derechos reservados.
        </div>
      </footer>

    </div>
  );
}