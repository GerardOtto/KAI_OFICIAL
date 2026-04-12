export function getClosestYear(mouseX, minYear, maxYear, width) {
    const ratio = mouseX / width;
    const year = minYear + ratio * (maxYear - minYear);
    return Math.round(year);
  }