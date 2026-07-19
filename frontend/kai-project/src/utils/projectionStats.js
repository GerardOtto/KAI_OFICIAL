import { linearRegression, rSquared } from "./regression";

export function computeProjectionStats(baseChartData, universidades, projectionYears) {
  if (!baseChartData.length || !projectionYears || !universidades.length) return null;

  const lastYear = Math.max(...baseChartData.map(d => d.year));
  const horizonYear = lastYear + projectionYears;

  const stats = universidades
    .map(uni => {
      const points = baseChartData
        .filter(d => d[uni] !== undefined)
        .map(d => ({ x: d.year, y: d[uni] }));

      if (points[points.length - 1]?.x !== lastYear) return null;

      const reg = linearRegression(points);
      if (!reg) return null;

      return {
        universidad: uni,
        slope: reg.slope,
        r2: rSquared(points, reg.slope, reg.intercept),
        projected: reg.slope * horizonYear + reg.intercept,
      };
    })
    .filter(Boolean);

  if (!stats.length) return null;

  const bestGrowth = stats.reduce((a, b) => (b.slope > a.slope ? b : a));
  const bestProjection = stats.reduce((a, b) => (b.projected > a.projected ? b : a));
  const avgR2 = stats.reduce((sum, s) => sum + s.r2, 0) / stats.length;

  return { stats, bestGrowth, bestProjection, avgR2, horizonYear };
}
