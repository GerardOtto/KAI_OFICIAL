// Por qué cambió el total de una institución entre dos ediciones de un ranking.
//
// El total que la plataforma calcula es Σ puntaje × aporte (peso / 100, o 1 donde
// el puntaje ya viene ponderado). Su variación se reparte exactamente entre las
// métricas: Δ total = Σ (puntaje_después × aporte_después − puntaje_antes ×
// aporte_antes). Las métricas se emparejan por nombre, no por identificador: GRAS
// guarda una métrica por época metodológica y «IC» de 2023 y de 2024 son dos filas
// distintas de la base. Una que solo existe en una de las dos ediciones aparece
// como nueva o como retirada.
//
// El total registrado (el publicado por el ranking o calculado con su método)
// puede no ser esa suma —QS reescala el suyo, ARWU lo expresa respecto de la
// primera del mundo—; se informa aparte, para que la diferencia se vea.

function porNombre(filas) {
  const mapa = new Map();
  let registrado = null;
  for (const f of filas) {
    const factor = f.factor != null ? Number(f.factor) : (Number(f.peso_metrica) || 0) / 100;
    if (factor <= 0) continue;
    const valor = Number(f.valor_metrica) || 0;
    mapa.set(f.nombre_metrica, { valor, factor, aporte: valor * factor, peso: Number(f.peso_metrica) || 0 });
    if (f.puntaje_total != null) registrado = Number(f.puntaje_total);
  }
  return { mapa, registrado };
}

/** `antes` y `despues`: filas de /simulacion de una universidad (y una
 *  disciplina) en cada edición. */
export function desglose(antes, despues) {
  const a = porNombre(antes);
  const d = porNombre(despues);
  const nombres = [...new Set([...a.mapa.keys(), ...d.mapa.keys()])];
  const metricas = nombres.map(nombre => {
    const x = a.mapa.get(nombre);
    const y = d.mapa.get(nombre);
    return {
      nombre,
      antes: x?.valor ?? null,
      despues: y?.valor ?? null,
      peso: (y || x).peso,
      delta: (y?.aporte ?? 0) - (x?.aporte ?? 0),
      estado: !x ? "nueva" : !y ? "retirada" : "",
    };
  }).sort((p, q) => Math.abs(q.delta) - Math.abs(p.delta));
  const totalAntes = [...a.mapa.values()].reduce((s, m) => s + m.aporte, 0);
  const totalDespues = [...d.mapa.values()].reduce((s, m) => s + m.aporte, 0);
  return {
    metricas, totalAntes, totalDespues, delta: totalDespues - totalAntes,
    registradoAntes: a.registrado, registradoDespues: d.registrado,
  };
}
