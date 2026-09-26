// Simulación sobre cifras medidas.
//
// Solo tiene sentido en los rankings cuyo puntaje es el percentil de la cifra
// entre las universidades del año —el Ranking KAI y Scimago Latam, marcados con
// `normalizacion = 'percentil'`—: ahí se puede mover la cifra real, recalcular el
// percentil y, con él, el total y la posición. Es la misma fórmula del backend:
//
//   percentil = 100 · (universidades superadas) / (n − 1)
//
// Un detalle que importa: el percentil de cada universidad depende de las demás.
// Si una sube su cifra, otras pueden perder puntos sin haber cambiado nada. Por
// eso se recalcula la población entera, no solo la universidad simulada.

/** Métricas y universidades a partir de las filas de /simulacion?modo=numerico. */
export function prepararCifras(filas) {
  const metricas = new Map();
  const universidades = new Map();
  for (const f of filas) {
    if (!metricas.has(f.id_metrica)) {
      metricas.set(f.id_metrica, {
        id_metrica: f.id_metrica,
        nombre_metrica: f.nombre_metrica,
        peso_metrica: Number(f.peso_metrica) || 0,
        pondera: f.pondera !== false,
        sentido: f.sentido === "menor" ? "menor" : "mayor",
        unidad: f.unidad || "",
      });
    }
    let u = universidades.get(f.id_universidad);
    if (!u) {
      u = { id_universidad: f.id_universidad, nombre: f.nombre_universidad, valores: {} };
      universidades.set(f.id_universidad, u);
    }
    if (f.valor_metrica != null) u.valores[f.id_metrica] = Number(f.valor_metrica);
  }
  return {
    metricas: [...metricas.values()].sort(
      (a, b) => b.peso_metrica - a.peso_metrica || a.nombre_metrica.localeCompare(b.nombre_metrica)),
    universidades: [...universidades.values()],
  };
}

/** Percentil de `x` frente a las demás cifras. Superar es tener más, o menos. */
export function percentil(x, otros, sentido = "mayor") {
  if (!otros.length) return 100;
  const superadas = otros.filter((y) => (sentido === "menor" ? y > x : y < x)).length;
  return (100 * superadas) / otros.length;
}

/**
 * Puntaje por métrica y total de cada universidad, con las cifras modificadas.
 * `overrides` = { id_universidad: { id_metrica: cifra } }. Una cifra ausente
 * aporta cero al total, igual que en el servidor.
 */
export function evaluar(universidades, metricas, overrides = {}) {
  const cifra = (u, id) => overrides[u.id_universidad]?.[id] ?? u.valores[id];
  const resultado = new Map(
    universidades.map((u) => [u.id_universidad, { puntajes: {}, total: 0 }]));

  for (const m of metricas) {
    const con = universidades.filter((u) => cifra(u, m.id_metrica) != null);
    const valores = con.map((u) => Number(cifra(u, m.id_metrica)));
    con.forEach((u, i) => {
      const otros = valores.filter((_, j) => j !== i);
      const p = percentil(valores[i], otros, m.sentido);
      const r = resultado.get(u.id_universidad);
      r.puntajes[m.id_metrica] = p;
      if (m.pondera) r.total += (p * m.peso_metrica) / 100;
    });
  }
  return resultado;
}

/** Posición de cada universidad por total, de mayor a menor. */
export function posiciones(resultado, universidades) {
  const nombre = new Map(universidades.map((u) => [u.id_universidad, u.nombre]));
  return new Map(
    [...resultado.entries()]
      .sort((a, b) => b[1].total - a[1].total
        || String(nombre.get(a[0])).localeCompare(String(nombre.get(b[0]))))
      .map(([id], i) => [id, i + 1]));
}

/** Paso cómodo para un control de rango: 1, 2 o 5 por una potencia de diez. */
export function pasoPara(maximo) {
  if (!maximo || maximo <= 0) return 1;
  const bruto = maximo / 200;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / potencia;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : 5) * potencia;
}

/** Tope del control de una métrica: holgura sobre la mayor cifra observada. */
export function topePara(m, universidades, actual = 0) {
  const mayor = Math.max(0, ...universidades.map((u) => u.valores[m.id_metrica] ?? 0));
  return Math.max(mayor * 1.25, Number(actual) * 1.1, 1);
}
