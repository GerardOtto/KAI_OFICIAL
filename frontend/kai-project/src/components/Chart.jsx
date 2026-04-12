import { useState } from "react";
import { useTrends } from "../hooks/useTrends";
import { groupByUniversity } from "../utils/groupData";
import { generatePath } from "../utils/generatePath";
import { getClosestYear } from "../utils/getClosestYear";

export default function Chart({
  rankingId,
  metricaId,
  selectedUniversidades = []
}) {
  const { data, min, max } = useTrends(
    rankingId,
    metricaId,
    selectedUniversidades
  );

  const [hoverX, setHoverX] = useState(null);

  const WIDTH = 1000;
  const HEIGHT = 500;

  const normalizedData = data.map(d => ({
    universidad: d.universidad,
    year: Number(d.anio),
    value: Number(d.valor)
  }));

  const grouped = groupByUniversity(normalizedData);

  if (!normalizedData.length) {
    return <div className="p-10 text-gray-500">No hay datos</div>;
  }

  const years = normalizedData.map(d => d.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const colors = ["white", "#A78BFA", "#34D399", "#F87171"];

  // 🎯 Año bajo el mouse
  const hoveredYear =
    hoverX !== null
      ? getClosestYear(hoverX, minYear, maxYear, WIDTH)
      : null;

  // 🎯 Datos del año
  const hoveredData =
    hoveredYear !== null
      ? normalizedData.filter(d => d.year === hoveredYear)
      : [];

  return (
    <div className="w-full bg-surface p-10 relative border border-outline/10">
      <div className="relative h-[500px] border-l border-b border-outline/30">

        {/* SVG */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
            setHoverX(x);
          }}
          onMouseLeave={() => setHoverX(null)}
        >
          {/* líneas */}
          {Object.entries(grouped).map(([uni, points], i) => {
            const path = generatePath(
              points,
              minYear,
              maxYear,
              min,
              max,
              WIDTH,
              HEIGHT
            );

            return (
              <path
                key={uni}
                d={path}
                stroke={colors[i % colors.length]}
                fill="none"
                strokeWidth="3"
              />
            );
          })}

          {/* CROSSHAIR */}
          {hoverX !== null && (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={0}
              y2={HEIGHT}
              stroke="#888"
              strokeDasharray="4"
            />
          )}
        </svg>

        {/* TOOLTIP */}
        {hoverX !== null && hoveredData.length > 0 && (
          <div
            className="absolute bg-black/90 text-white text-xs p-3 rounded shadow-lg"
            style={{
              left: `${(hoverX / WIDTH) * 100}%`,
              top: "10px",
              transform: "translateX(-50%)"
            }}
          >
            <div className="font-bold mb-1">
              Año: {hoveredYear}
            </div>

            {hoveredData.map((d, i) => (
              <div key={i} className="flex gap-2">
                <span
                  style={{ color: colors[i % colors.length] }}
                >
                  ●
                </span>
                <span>{d.universidad}</span>
                <span>{d.value.toFixed(3)}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}