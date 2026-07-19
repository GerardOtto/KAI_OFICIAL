// Regresión lineal simple (mínimos cuadrados) sobre pares {x, y}.
export function linearRegression(points) {
  const n = points.length;
  if (n < 3) return null;

  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

export function projectValues(points, futureXs) {
  const reg = linearRegression(points);
  if (!reg) return [];
  return futureXs.map((x) => ({ x, y: reg.slope * x + reg.intercept }));
}

// Coeficiente de determinación: qué tan bien la recta explica los puntos reales.
export function rSquared(points, slope, intercept) {
  const n = points.length;
  if (n < 2) return null;

  const meanY = points.reduce((a, p) => a + p.y, 0) / n;
  const ssTot = points.reduce((a, p) => a + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((a, p) => a + (p.y - (slope * p.x + intercept)) ** 2, 0);

  if (ssTot === 0) return 1;
  return 1 - ssRes / ssTot;
}
