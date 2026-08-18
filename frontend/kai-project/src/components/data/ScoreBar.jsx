export default function ScoreBar({ value, max, isOwn = false }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[15px] font-medium text-white tabular-nums w-[46px] shrink-0">
        {Number(value).toFixed(1).replace(".", ",")}
      </span>
      <div className="flex-1 h-1.5 bg-white/[.07]">
        <div
          className={isOwn ? "h-full bg-accent" : "h-full bg-white/[.28]"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
