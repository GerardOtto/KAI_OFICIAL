import { projectValues } from "./regression";

export function addProjections(chartData, universidades, yearsToProject) {
  if (!yearsToProject || yearsToProject <= 0 || !chartData.length) return chartData;

  const lastYear = Math.max(...chartData.map(d => d.year));
  const futureYears = Array.from({ length: yearsToProject }, (_, i) => lastYear + i + 1);

  const extended = chartData.map(d => ({ ...d }));
  const lastRow = extended.find(d => d.year === lastYear);

  const futureRows = futureYears.map(year => ({ year }));
  extended.push(...futureRows);

  universidades.forEach(uni => {
    const points = chartData
      .filter(d => d[uni] !== undefined)
      .map(d => ({ x: d.year, y: d[uni] }));

    if (points[points.length - 1]?.x !== lastYear) return;

    const projections = projectValues(points, futureYears);
    if (!projections.length) return;

    if (lastRow[uni] !== undefined) {
      lastRow[`${uni}_proy`] = lastRow[uni];
    }
    futureRows.forEach((row, i) => {
      row[`${uni}_proy`] = projections[i].y;
    });
  });

  return extended;
}

export function transformToRecharts(data) {
    const result = {};
  
    data.forEach(d => {
      const year = d.anio;
      const uni = d.universidad;
      const value = Number(d.valor);
  
      if (!result[year]) {
        result[year] = { year };
      }
  
      result[year][uni] = value;
    });
  
    return Object.values(result).sort((a, b) => a.year - b.year);
  }