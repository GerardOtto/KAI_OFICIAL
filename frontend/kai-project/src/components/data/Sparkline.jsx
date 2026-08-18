// arr = posiciones por año, de más antigua a más reciente. Eje Y invertido (posición 1 arriba).
export default function Sparkline({ posiciones, isOwn = false, maxPos = 12 }) {
  if (!posiciones || posiciones.length < 2) {
    return <div className="w-[140px] h-[26px]" />;
  }
  const points = posiciones
    .map((p, i) => {
      const x = (i * 140) / (posiciones.length - 1);
      const clamped = Math.min(p, maxPos);
      const y = 2 + ((clamped - 1) / (maxPos - 1)) * 22;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 140 26" width="140" height="26" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        className={isOwn ? "stroke-accent" : "stroke-white/30"}
        strokeWidth="1.5"
      />
    </svg>
  );
}
