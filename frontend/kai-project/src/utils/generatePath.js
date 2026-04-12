import { scaleX, scaleY } from "./scales";

export function generatePath(
  points,
  minYear,
  maxYear,
  minValue,
  maxValue,
  width,
  height
) {
  if (!points || points.length === 0) return "";

  const sorted = [...points].sort((a, b) => a.year - b.year);

  return sorted
    .map((p, i) => {
      const year = Number(p.year);
      const value = Number(p.value);

      if (isNaN(year) || isNaN(value)) return "";

      const x = scaleX(year, minYear, maxYear, width);
      const y = scaleY(value, minValue, maxValue, height);

      if (isNaN(x) || isNaN(y)) return "";

      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .filter(Boolean)
    .join(" ");
}