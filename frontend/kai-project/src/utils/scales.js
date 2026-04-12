import { normalize } from "./normalize";

export function scaleX(year, minYear, maxYear, width) {
  if (maxYear === minYear) return width / 2;
  return ((year - minYear) / (maxYear - minYear)) * width;
}

export function scaleY(value, min, max, height) {
  const normalized = normalize(value, min, max);
  return height - normalized * height;
}