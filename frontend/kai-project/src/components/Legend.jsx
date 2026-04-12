import React from "react";

export default function Legend() {
  const items = [
    ["white", "Universidad de Chile"],
    ["#A78BFA", "Pontificia Universidad Católica de Chile"],
    ["#34D399", "Universidad de Concepción"],
  ];

  return (
    <div className="mt-16 flex gap-10 flex-wrap">
      {items.map(([color, name]) => (
        <div key={name} className="flex items-center gap-3">
          <div className="w-10 h-[2px]" style={{ background: color }} />
          <span className="text-xs uppercase tracking-widest">
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}