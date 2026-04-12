import { useState, useMemo, useEffect} from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from "recharts";

import { useTrends } from "../hooks/useTrends";
import { transformToRecharts } from "../utils/transformData";

const COLORS = [
  "#60A5FA", // blue
  "#F87171", // red
  "#34D399", // green
  "#FBBF24", // yellow
  "#A78BFA", // purple
  "#F472B6", // pink
  "#FB923C", // orange
  "#22D3EE", // cyan
  "#A3E635", // lime
  "#E879F9", // fuchsia
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  const sorted = [...payload].sort((a, b) => b.value - a.value); // mayor = mejor ranking

  return (
    <div style={{ backgroundColor: "#111", border: "1px solid #444", padding: "10px 14px", borderRadius: 6 }}>
      <p style={{ color: "#aaa", marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {sorted.map((entry) => (
        <div key={entry.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 24, color: entry.color, fontSize: 13 }}>
          <span>{entry.dataKey}</span>
          <span style={{ fontWeight: 700 }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const CustomLegend = ({ universidades, colors, activeUni, setActiveUni }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px", marginTop: 16, justifyContent: "center" }}>
    {universidades.map((uni, i) => (
      <div
        key={uni}
        onMouseEnter={() => setActiveUni(uni)}
        onMouseLeave={() => setActiveUni(null)}
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: activeUni && activeUni !== uni ? 0.35 : 1, transition: "opacity 0.2s" }}
      >
        <svg width="28" height="10">
          <line x1="0" y1="5" x2="28" y2="5" stroke={colors[i % colors.length]} strokeWidth="2.5" strokeDasharray="none" />
        </svg>
        <span style={{ color: "#ccc", fontSize: 12 }}>{uni}</span>
      </div>
    ))}
  </div>
);

export default function Chart({ rankingId, metricaId, selectedUniversidades, onDataReady }) {
  const { data } = useTrends(rankingId, metricaId);
  const [activeUni, setActiveUni] = useState(null);
  
  useEffect(() => {
    if (onDataReady) onDataReady(data);
  }, [data]);

  const filteredData = useMemo(() => {
    if (!selectedUniversidades.length) return data;
    return data.filter(d => selectedUniversidades.includes(d.id_universidad));
  }, [data, selectedUniversidades]);

  const chartData = useMemo(() => transformToRecharts(filteredData), [filteredData]);

  const universidades = useMemo(
    () => [...new Set(filteredData.map(d => d.universidad))],
    [filteredData]
  );

  if (!data.length) {
    return (
      <div className="max-w-2xl mx-auto my-8 p-6 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg shadow-sm">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {/* Icono de información (i) */}
            <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="Step 13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-medium text-blue-800">Nota sobre la disponibilidad de datos</h3>
            <p className="mt-2 text-sm text-blue-700 leading-relaxed">
              Si los datos aparecen incompletos o no hay cambios al seleccionar una institución, esto puede deberse a:
            </p>
            <ul className="mt-3 list-disc list-inside text-sm text-blue-700 space-y-1">
              <li>La institución no ha reportado sus datos este año.</li>
              <li>La institución se ha dado de baja del ranking.</li>
              <li>Los datos no son accesibles públicamente por el momento.</li>
              <li>La institución nunca ha participado en este ranking.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[100%] bg-[#1c1b1b] p-6 border border-gray-700">
      <div className="w-[100%] h-[500px]">
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <CartesianGrid stroke="#333" strokeDasharray="3 3" />
            <XAxis dataKey="year" stroke="#aaa" />
            <YAxis stroke="#aaa" domain={["auto", "auto"]} />
            <Tooltip content={<CustomTooltip />} />

            {universidades.map((uni, i) => (
              <Line
                key={uni}
                type="monotone"
                dataKey={uni}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={activeUni === uni ? 4 : 2}
                opacity={activeUni ? (uni === activeUni ? 1 : 0.15) : 1}
                dot={false}
                onMouseEnter={() => setActiveUni(uni)}
                onMouseLeave={() => setActiveUni(null)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <CustomLegend
        universidades={universidades}
        colors={COLORS}
        activeUni={activeUni}
        setActiveUni={setActiveUni}
      />
    </div>
  );
}