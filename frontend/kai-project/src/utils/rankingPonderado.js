// Reponderar un ranking en el cliente.
//
// Solo para los rankings que la base marca con `pesos_editables` —el Ranking
// KAI—. La base guarda el puntaje de cada métrica (un percentil de 0 a 100) y el
// peso por defecto; el orden con los pesos del usuario se calcula aquí, sin ir al
// servidor, para que mover un deslizador reordene la tabla en el acto.
//
// El total es el promedio ponderado  Σ puntaje·peso / Σ peso.  Con los pesos por
// defecto —diez métricas de 10— coincide con el `score_total` del servidor, que
// divide por 100; dividir por la suma de los pesos hace que el total siga en la
// escala 0-100 cuando el usuario los cambia y ya no suman 100.

/** Métricas del ranking, con su peso por defecto, a partir de las filas de /simulacion. */
export function metricasDe(filas) {
  const vistas = new Map();
  for (const f of filas) {
    if (!vistas.has(f.id_metrica)) {
      vistas.set(f.id_metrica, {
        id_metrica: f.id_metrica,
        nombre_metrica: f.nombre_metrica,
        peso_metrica: Number(f.peso_metrica) || 0,
      });
    }
  }
  return [...vistas.values()].sort((a, b) => a.id_metrica - b.id_metrica);
}

/** Pesos por defecto: los que trae la base. */
export function pesosIniciales(metricas) {
  return Object.fromEntries(metricas.map((m) => [m.id_metrica, m.peso_metrica]));
}

/** ¿Difieren los pesos actuales de los de la base? */
export function pesosModificados(pesos, metricas) {
  return metricas.some((m) => (pesos[m.id_metrica] ?? m.peso_metrica) !== m.peso_metrica);
}

/** Suma de los pesos. */
export function sumaPesos(pesos) {
  return Object.values(pesos).reduce((a, w) => a + (Number(w) || 0), 0);
}

/** Qué fracción del total representa cada peso, en porcentaje. */
export function participacion(pesos) {
  const suma = sumaPesos(pesos);
  return Object.fromEntries(
    Object.entries(pesos).map(([id, w]) => [id, suma > 0 ? (100 * (Number(w) || 0)) / suma : 0])
  );
}

/**
 * Ordena las universidades de un año con los pesos dados.
 *
 * Una métrica sin valor cuenta como cero, igual que en el servidor. En el
 * Ranking KAI no ocurre —toda universidad elegible tiene las diez—, pero la regla
 * es la misma para que ambos cálculos nunca discrepen.
 */
export function clasificar(filas, pesos) {
  const suma = sumaPesos(pesos);
  const porUniversidad = new Map();
  for (const f of filas) {
    let u = porUniversidad.get(f.id_universidad);
    if (!u) {
      u = {
        id_universidad: f.id_universidad,
        nombre_universidad: f.nombre_universidad,
        pais_universidad: f.pais_universidad,
        acumulado: 0,
      };
      porUniversidad.set(f.id_universidad, u);
    }
    const w = Number(pesos[f.id_metrica]) || 0;
    u.acumulado += (Number(f.valor_metrica) || 0) * w;
  }
  return [...porUniversidad.values()]
    .map(({ acumulado, ...u }) => ({ ...u, score_total: suma > 0 ? acumulado / suma : 0 }))
    .sort((a, b) => b.score_total - a.score_total || a.nombre_universidad.localeCompare(b.nombre_universidad));
}

/**
 * Posición de cada universidad en cada año, con los mismos pesos en todos.
 *
 * Devuelve el mismo formato que `useRankingHistorico`: por universidad, su serie
 * `{anio, posicion, score}` ordenada por año.
 */
export function historico(porAnio, pesos) {
  const mapa = {};
  for (const anio of Object.keys(porAnio).map(Number).sort((a, b) => a - b)) {
    clasificar(porAnio[anio] || [], pesos).forEach((u, i) => {
      if (!mapa[u.id_universidad]) mapa[u.id_universidad] = { historico: [] };
      mapa[u.id_universidad].historico.push({ anio, posicion: i + 1, score: u.score_total });
    });
  }
  return mapa;
}

/**
 * Cuántos puestos cambió una universidad entre la edición anterior del ranking
 * y la elegida. Positivo si subió. Nulo si no estaba en alguna de las dos.
 *
 * `anioAnterior` es la edición previa del ranking, no el año menos uno: hay
 * rankings con ediciones salteadas, y una universidad ausente en la edición
 * anterior no debe compararse con una más vieja como si fuera la misma cosa.
 */
export function variacion(entrada, anio, anioAnterior) {
  const serie = entrada?.historico;
  if (!serie || anioAnterior == null) return null;
  const actual = serie.find((h) => h.anio === anio);
  const previa = serie.find((h) => h.anio === anioAnterior);
  if (!actual || !previa) return null;
  return previa.posicion - actual.posicion;
}
