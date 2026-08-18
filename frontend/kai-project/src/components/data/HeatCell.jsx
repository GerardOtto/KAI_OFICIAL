// alpha = 0.08 + (peso / 25) * 0.42, tope en 25% de peso para no saturar con Shanghai (30%)
function alphaForPeso(peso) {
  const clamped = Math.min(peso, 25);
  return 0.08 + (clamped / 25) * 0.42;
}

export default function HeatCell({ peso, valor, valorFormateado, titulo }) {
  const tieneMetrica = peso != null;
  const style = tieneMetrica
    ? { backgroundColor: `oklch(0.72 0.13 250 / ${alphaForPeso(peso)})`, borderColor: "rgba(255,255,255,.08)" }
    : { backgroundColor: "rgba(255,255,255,.02)", borderColor: "rgba(255,255,255,.05)" };

  return (
    <div
      title={titulo}
      className="h-14 border p-2 px-2.5 flex flex-col justify-between"
      style={style}
    >
      <span className="font-mono text-[9.5px]" style={{ color: tieneMetrica ? "rgba(255,255,255,.6)" : "#5a5a5a" }}>
        {tieneMetrica ? `${peso}%` : "no mide"}
      </span>
      <span className="font-mono font-semibold text-[15px]" style={{ color: valor != null ? "#fff" : "#6f6f6f" }}>
        {valor != null ? (valorFormateado ?? valor) : "—"}
      </span>
    </div>
  );
}
