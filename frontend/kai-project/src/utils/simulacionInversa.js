// Simulación inversa: en vez de «si muevo esto, ¿dónde quedo?», responde «¿qué
// tengo que mover, y cuánto, para superar a X o llegar al puesto N?».
//
// Dos modos, como la simulación directa:
//
//  * Puntajes (todos los rankings). El total es lineal: Σ puntaje × aporte, con
//    aporte = peso / 100 (o 1 donde el puntaje ya viene ponderado, GRAS desde
//    2024). Mover una universidad no cambia a las demás, así que la brecha se
//    reparte entre métricas con aritmética simple.
//
//  * Cifras (Ranking KAI y Scimago, cuyo puntaje es el percentil de la cifra).
//    Aquí no hay atajo: subir la cifra de una universidad baja el percentil de las
//    que supera. Se busca recalculando la población entera con `evaluar`, igual
//    que la simulación directa, y la respuesta se da en la cifra real.
//
// Todo es puro y sin estado: la vista solo lo dibuja.

import { evaluar, posiciones } from "./simulacionCifras.js";

// «Superar» es quedar por encima, no empatar: se pide una ventaja mínima que se
// note con el decimal que muestra la página.
export const MARGEN = 0.05;

// --- Puntajes -----------------------------------------------------------------

/** Métricas (con su aporte y su techo) y universidades con su total, de las filas
 *  de /simulacion en modo puntajes, ya filtradas por disciplina. */
export function prepararPuntajes(filas) {
  const metricas = new Map();
  const universidades = new Map();
  for (const f of filas) {
    if (!metricas.has(f.id_metrica)) {
      const peso = Number(f.peso_metrica) || 0;
      const factor = f.factor != null ? Number(f.factor) : peso / 100;
      metricas.set(f.id_metrica, {
        id_metrica: f.id_metrica, nombre_metrica: f.nombre_metrica, peso_metrica: peso, factor,
        maximo: 0,
      });
    }
    let u = universidades.get(f.id_universidad);
    if (!u) {
      u = { id_universidad: f.id_universidad, nombre: f.nombre_universidad, valores: {}, total: 0 };
      universidades.set(f.id_universidad, u);
    }
    const v = Number(f.valor_metrica) || 0;
    u.valores[f.id_metrica] = v;
    const m = metricas.get(f.id_metrica);
    m.maximo = Math.max(m.maximo, v);
  }
  const lista = [...metricas.values()].map(m => ({
    ...m,
    // Un puntaje normalizado no pasa de 100. Donde ya viene ponderado (GRAS desde
    // 2024) su techo es el peso de la métrica, o lo observado si es mayor.
    techo: m.factor === 1 && m.peso_metrica > 0 ? Math.max(m.peso_metrica, m.maximo) : 100,
  })).filter(m => m.factor > 0)
    .sort((a, b) => b.factor - a.factor || a.nombre_metrica.localeCompare(b.nombre_metrica));
  for (const u of universidades.values()) {
    u.total = lista.reduce((s, m) => s + (u.valores[m.id_metrica] ?? 0) * m.factor, 0);
  }
  return { metricas: lista, universidades: [...universidades.values()] };
}

/** Universidades de mayor a menor total, con su puesto (empates por nombre). */
export function clasificar(universidades, totalDe = u => u.total) {
  return [...universidades]
    .sort((a, b) => totalDe(b) - totalDe(a) || String(a.nombre).localeCompare(String(b.nombre)))
    .map((u, i) => ({ ...u, puesto: i + 1, total: totalDe(u) }));
}

/** El objetivo en puntos: a quién hay que superar y cuánto falta.
 *  `objetivo` = { tipo: "superar", id } | { tipo: "puesto", puesto }. */
export function meta(clasificacion, idPropia, objetivo) {
  const propia = clasificacion.find(u => u.id_universidad === idPropia);
  if (!propia) return null;
  const referencia = objetivo.tipo === "superar"
    ? clasificacion.find(u => u.id_universidad === objetivo.id)
    // Para llegar al puesto N hay que superar a quien hoy lo ocupa (que pasa al
    // N + 1). Si ya se está en él o más arriba, no falta nada.
    : clasificacion.find(u => u.puesto === objetivo.puesto && u.id_universidad !== idPropia);
  if (!referencia || referencia.puesto > propia.puesto) {
    return { propia, referencia: referencia || null, brecha: 0, cumplido: true };
  }
  const brecha = referencia.total - propia.total + MARGEN;
  return { propia, referencia, brecha, cumplido: brecha <= 0 };
}

/** De dónde viene la brecha con la referencia: cuánto aporta cada métrica a la
 *  diferencia de totales (positivo = la referencia saca ventaja ahí). */
export function brechaPorMetrica(propia, referencia, metricas) {
  return metricas.map(m => {
    const mio = propia.valores[m.id_metrica] ?? 0;
    const suyo = referencia.valores[m.id_metrica] ?? 0;
    return { ...m, mio, suyo, aporte: (suyo - mio) * m.factor };
  }).sort((a, b) => b.aporte - a.aporte);
}

/** Cerrar la brecha moviendo una sola métrica: cuánto tendría que llegar a valer y
 *  si cabe bajo su techo. */
export function unaSolaMetrica(propia, metricas, brecha) {
  return metricas.map(m => {
    const de = propia.valores[m.id_metrica] ?? 0;
    const a = de + brecha / m.factor;
    const maximoAporte = Math.max(0, (m.techo - de) * m.factor);
    return { ...m, de, a, cambio: a - de, alcanzable: a <= m.techo + 1e-9, maximoAporte };
  }).sort((x, y) => (y.alcanzable - x.alcanzable) || x.cambio - y.cambio);
}

/** El plan de menos puntos: subir primero las métricas que más aportan por punto,
 *  hasta su techo, hasta cubrir la brecha. A igual aporte —el Ranking KAI tiene
 *  los pesos parejos— va primero la que más margen tiene: así se tocan las menos
 *  métricas posibles, en vez de empezar por las que ya están cerca de su techo. */
export function planConcentrado(propia, metricas, brecha) {
  let falta = brecha;
  const pasos = [];
  const margen = (m) => m.techo - (propia.valores[m.id_metrica] ?? 0);
  for (const m of [...metricas].sort((a, b) => b.factor - a.factor || margen(b) - margen(a))) {
    if (falta <= 1e-9) break;
    const de = propia.valores[m.id_metrica] ?? 0;
    const holgura = m.techo - de;
    if (holgura <= 0) continue;
    const sube = Math.min(holgura, falta / m.factor);
    pasos.push({ ...m, de, a: de + sube, cambio: sube, aporte: sube * m.factor });
    falta -= sube * m.factor;
  }
  return { pasos, alcanzable: falta <= 1e-9, falta: Math.max(0, falta) };
}

/** El plan parejo: la misma fracción de lo que le queda a cada métrica hasta su
 *  techo. Reparte el esfuerzo en vez de apostarlo a una sola. */
export function planParejo(propia, metricas, brecha) {
  const conHolgura = metricas.filter(m => m.techo - (propia.valores[m.id_metrica] ?? 0) > 0);
  const posible = conHolgura.reduce((s, m) => s + (m.techo - (propia.valores[m.id_metrica] ?? 0)) * m.factor, 0);
  if (posible <= 0) return { pasos: [], alcanzable: false, fraccion: null };
  const fraccion = brecha / posible;
  const t = Math.min(1, fraccion);
  const pasos = conHolgura.map(m => {
    const de = propia.valores[m.id_metrica] ?? 0;
    const sube = t * (m.techo - de);
    return { ...m, de, a: de + sube, cambio: sube, aporte: sube * m.factor };
  });
  return { pasos, alcanzable: fraccion <= 1, fraccion };
}

/** Puesto que tendría la universidad con un total nuevo; las demás no cambian. */
export function puestoCon(clasificacion, idPropia, total) {
  return 1 + clasificacion.filter(u => u.id_universidad !== idPropia && u.total > total).length;
}

// --- Cifras (rankings por percentil) --------------------------------------------

/** Si el resultado de `evaluar` cumple el objetivo para la universidad. */
export function cumpleCifras(resultado, universidades, idPropia, objetivo) {
  const mio = resultado.get(idPropia)?.total ?? 0;
  if (objetivo.tipo === "superar") return mio > (resultado.get(objetivo.id)?.total ?? Infinity);
  return (posiciones(resultado, universidades).get(idPropia) ?? Infinity) <= objetivo.puesto;
}

/** Cifras de las demás universidades que habría que dejar atrás en una métrica,
 *  de la más cercana a la más lejana. */
function escalones(m, universidades, idPropia, actual) {
  const otras = universidades
    .filter(u => u.id_universidad !== idPropia && u.valores[m.id_metrica] != null)
    .map(u => Number(u.valores[m.id_metrica]));
  const mayor = m.sentido !== "menor";
  const por_delante = otras.filter(v => (mayor ? v >= actual : v <= actual));
  return [...new Set(por_delante)].sort((a, b) => (mayor ? a - b : b - a));
}

/** Si una métrica se cuenta en enteros (doctorados, patentes) en todo el año. */
function enEnteros(m, universidades) {
  return universidades.every(u => u.valores[m.id_metrica] == null || Number.isInteger(Number(u.valores[m.id_metrica])));
}

/** La cifra más cercana que deja atrás a `v` y que se puede escribir: el entero
 *  siguiente si la métrica se cuenta en enteros, si no la centésima siguiente (al
 *  revés si menor es mejor). Es la que se propone y la que se lleva a la
 *  simulación directa. */
export function pasar(v, sentido, enteros = false) {
  if (sentido === "menor") return enteros ? Math.ceil(v) - 1 : (Math.ceil(v * 100 - 1e-9) - 1) / 100;
  return enteros ? Math.floor(v) + 1 : (Math.floor(v * 100 + 1e-9) + 1) / 100;
}

/** Con una sola métrica: la cifra mínima que cumple el objetivo, si existe. Cada
 *  candidata se evalúa contra la población entera, porque pasar a otra
 *  universidad también le quita percentil a ella. */
export function unaSolaMetricaCifras(universidades, metricas, idPropia, objetivo) {
  const propia = universidades.find(u => u.id_universidad === idPropia);
  if (!propia) return [];
  return metricas.filter(m => m.pondera && m.peso_metrica > 0).map(m => {
    const de = propia.valores[m.id_metrica];
    if (de == null) return { ...m, de: null, alcanzable: false, sinCifra: true };
    const enteros = enEnteros(m, universidades);
    for (const v of escalones(m, universidades, idPropia, de)) {
      const prueba = pasar(v, m.sentido, enteros);
      const r = evaluar(universidades, metricas, { [idPropia]: { [m.id_metrica]: prueba } });
      if (cumpleCifras(r, universidades, idPropia, objetivo)) {
        return { ...m, de, a: prueba, supera: v, alcanzable: true };
      }
    }
    return { ...m, de, alcanzable: false };
  }).sort((x, y) => (y.alcanzable - x.alcanzable)
    || Math.abs((x.a - x.de) / (x.de || 1)) - Math.abs((y.a - y.de) / (y.de || 1)));
}

/** Plan combinado sobre cifras. Cada universidad que se deja atrás en una métrica
 *  da el mismo percentil (100 / (n − 1)), así que el plan avanza un escalón cada
 *  vez: en la métrica de más peso y, a igual peso —el Ranking KAI los tiene
 *  parejos—, en la que el escalón siguiente está más cerca en proporción. */
export function planCifras(universidades, metricas, idPropia, objetivo, maxPasos = 400) {
  const propia = universidades.find(u => u.id_universidad === idPropia);
  if (!propia) return { pasos: [], alcanzable: false };
  const actuales = {};
  const usables = metricas.filter(m => m.pondera && m.peso_metrica > 0 && propia.valores[m.id_metrica] != null);
  usables.forEach(m => { actuales[m.id_metrica] = Number(propia.valores[m.id_metrica]); });
  const meta = { [idPropia]: actuales };

  let r = evaluar(universidades, metricas, meta);
  for (let i = 0; i < maxPasos && !cumpleCifras(r, universidades, idPropia, objetivo); i++) {
    let mejor = null;
    for (const m of usables) {
      const siguiente = escalones(m, universidades, idPropia, actuales[m.id_metrica])
        .find(v => (m.sentido === "menor" ? v <= actuales[m.id_metrica] : v >= actuales[m.id_metrica]));
      if (siguiente == null) continue;
      const base = Math.abs(propia.valores[m.id_metrica]) || 1;
      const costo = Math.abs(siguiente - actuales[m.id_metrica]) / base;
      if (!mejor || m.peso_metrica > mejor.m.peso_metrica
          || (m.peso_metrica === mejor.m.peso_metrica && costo < mejor.costo)) {
        mejor = { m, siguiente, costo };
      }
    }
    if (!mejor) break;
    actuales[mejor.m.id_metrica] = pasar(mejor.siguiente, mejor.m.sentido, enEnteros(mejor.m, universidades));
    r = evaluar(universidades, metricas, meta);
  }
  const alcanzable = cumpleCifras(r, universidades, idPropia, objetivo);
  const pasos = usables
    .filter(m => actuales[m.id_metrica] !== Number(propia.valores[m.id_metrica]))
    .map(m => ({ ...m, de: Number(propia.valores[m.id_metrica]),
                 a: actuales[m.id_metrica], cambio: actuales[m.id_metrica] - Number(propia.valores[m.id_metrica]) }));
  return { pasos, alcanzable, resultado: r, puesto: posiciones(r, universidades).get(idPropia) };
}
