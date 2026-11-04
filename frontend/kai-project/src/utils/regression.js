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

// Cuantil 0,90 de la t de Student (intervalo central del 80 %) según los grados
// de libertad. Más allá de 30 se usa el de la normal.
const T_80 = [null, 3.078, 1.886, 1.638, 1.533, 1.476, 1.44, 1.415, 1.397, 1.383, 1.372,
  1.363, 1.356, 1.35, 1.345, 1.341, 1.337, 1.333, 1.33, 1.328, 1.325];
function t80(gl) {
  if (gl < 1) return null;
  if (gl <= 20) return T_80[gl];
  return gl <= 30 ? 1.31 : 1.282;
}

/** Intervalo de predicción del 80 % para un año futuro `x`: dónde caería el dato
 *  observado con probabilidad 0,8 si la tendencia siguiera igual. Crece con la
 *  dispersión de la serie y con la distancia a los años observados. Necesita al
 *  menos tres puntos (un grado de libertad). */
export function intervaloPrediccion(points, slope, intercept, x) {
  const n = points.length;
  const t = t80(n - 2);
  if (!t) return null;
  const mediaX = points.reduce((a, p) => a + p.x, 0) / n;
  const sxx = points.reduce((a, p) => a + (p.x - mediaX) ** 2, 0);
  if (sxx === 0) return null;
  const sse = points.reduce((a, p) => a + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const s = Math.sqrt(sse / (n - 2));
  const margen = t * s * Math.sqrt(1 + 1 / n + (x - mediaX) ** 2 / sxx);
  const centro = slope * x + intercept;
  return { bajo: centro - margen, alto: centro + margen, margen };
}
