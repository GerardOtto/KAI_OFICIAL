/** Informe PDF del módulo de Simulación.
 *
 *  El informe anterior listaba todas las métricas, o la matriz completa de
 *  instituciones por métricas con cada celda. Pero de un escenario importa otra
 *  cosa: qué se movió, qué cambia en la posición y dónde está el margen. Así
 *  que el informe muestra solo los ajustes hechos, su efecto y, en la
 *  simulación unitaria, las métricas donde mejorar rinde más puntos. La matriz
 *  completa queda en la exportación CSV.
 *
 *  Sirve a las cuatro variantes —unitaria y comparada, con puntajes o con
 *  cifras medidas—, que el módulo entrega ya calculadas.
 */
import {
  barras, cifra, cifrasClave, conSigno, crearDocumento, fichaDeEmision, guardar, hallazgos,
  nombreArchivo, nota, portada, puestos, seccion, tabla, tono, vacio,
} from "./documento";

const ETIQUETA = "KAI · INFORME DE SIMULACIÓN";
const orden = (n) => (n == null ? "—" : `${n}.º`);
const lista = (nombres, max = 4) => {
  const n = nombres.slice(0, max).map((x) => `**${x}**`);
  const resto = nombres.length - n.length;
  if (resto > 0) n.push(`${resto} más`);
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}` : n[0] || "";
};
const movimiento = (base, sim) => (base != null && sim != null ? base - sim : 0);
const METODO = {
  puntajes: "El puntaje total es la suma de cada métrica por su peso. En la simulación con puntajes, la posición de las demás instituciones no cambia.",
  cifras: "Con cifras medidas, cada cifra se convierte en el percentil que ocupa entre todas las universidades del año, y el total es la suma de percentiles por peso: al mejorar una institución, las demás pueden perder puntos sin haber cambiado nada.",
};

// ---------------------------------------------------------------------------
// Unitaria
// ---------------------------------------------------------------------------

async function unitaria(d) {
  const { ranking, anio, disciplina, institucion, base, simulado, total, cifras, usuario } = d;
  const ajustadas = d.metricas.filter((m) => m.modificada);
  const mov = movimiento(base.posicion, simulado.posicion);
  const deltaScore = simulado.score - base.score;

  const { doc, l, fecha } = await crearDocumento({ titulo: `Simulación · ${institucion}`, asunto: ranking, ranking });
  portada(l, {
    antetitulo: "Simulación · unitaria",
    titulo: `Escenario para ${institucion}`,
    ficha: [
      `Año: ${anio}${disciplina ? ` · ${disciplina}` : ""}`,
      `Simulación sobre ${cifras ? "cifras medidas (percentiles)" : "puntajes"}`,
      `${ajustadas.length} de ${d.metricas.length} métricas ajustadas`,
      ...fichaDeEmision(usuario, fecha),
    ],
  });

  seccion(l, 1, "Resultado del escenario");
  cifrasClave(l, [
    { etiqueta: "Posición simulada", valor: orden(simulado.posicion), destacada: true,
      detalle: `antes ${orden(base.posicion)}${total ? ` de ${total}` : ""} · ${mov ? `${mov > 0 ? "sube" : "baja"} ${Math.abs(mov)} ${Math.abs(mov) === 1 ? "puesto" : "puestos"}` : "sin cambio"}` },
    { etiqueta: "Puntaje simulado", valor: cifra(simulado.score, 1), tono: tono(deltaScore),
      detalle: `antes ${cifra(base.score, 1)} · ${conSigno(deltaScore)} puntos` },
    { etiqueta: "Métricas ajustadas", valor: `${ajustadas.length} de ${d.metricas.length}`,
      detalle: ajustadas.length ? ajustadas.slice(0, 2).map((m) => m.nombre).join(" · ") : "escenario sin cambios" },
  ]);
  const masAporta = [...ajustadas].sort((a, b) => b.efecto - a.efecto)[0];
  hallazgos(l, ajustadas.length ? [
    `Con los ajustes, **${institucion}** ${mov > 0 ? `sube del puesto ${orden(base.posicion)} al **${orden(simulado.posicion)}**`
      : mov < 0 ? `baja del puesto ${orden(base.posicion)} al **${orden(simulado.posicion)}**` : `se mantiene en el puesto **${orden(simulado.posicion)}**`}, y su puntaje pasa de ${cifra(base.score, 1)} a **${cifra(simulado.score, 1)}**.`,
    masAporta && masAporta.efecto > 0 && `El ajuste que más aporta es **${masAporta.nombre}** (${conSigno(masAporta.efecto)} puntos).`,
    d.superadas.length && `Supera a ${lista(d.superadas)}.`,
    d.perdidas.length && `Queda por detrás de ${lista(d.perdidas)}.`,
    d.siguiente && `Para subir un puesto más le faltan **${cifra(d.siguiente.brecha, 1)} puntos** frente a **${d.siguiente.nombre}**.`,
  ] : [
    `El escenario no ajusta ninguna métrica: refleja la posición real de **${institucion}** en ${anio}, el puesto **${orden(base.posicion)}** con ${cifra(base.score, 1)} puntos.`,
    d.siguiente && `Para subir un puesto le faltan **${cifra(d.siguiente.brecha, 1)} puntos** frente a **${d.siguiente.nombre}**.`,
  ]);

  seccion(l, 2, "Ajustes del escenario", "Solo las métricas que se movieron.");
  if (!ajustadas.length) {
    vacio(l, "No se ajustó ninguna métrica.");
  } else if (cifras) {
    tabla(l, {
      columnas: [
        { titulo: "Métrica", peso: 2.6 }, { titulo: "Peso", alinear: "right", peso: 0.7 },
        { titulo: "Cifra base", alinear: "right" }, { titulo: "Cifra simulada", alinear: "right" },
        { titulo: "Percentil", alinear: "right" }, { titulo: "Efecto", alinear: "right", peso: 0.8 },
      ],
      filas: ajustadas.map((m) => [
        `${m.nombre}${m.unidad ? ` (${m.unidad})` : ""}`, `${cifra(m.peso)} %`, cifra(m.base), cifra(m.simulado),
        `${cifra(m.percentilBase, 0)} a ${cifra(m.percentilSimulado, 0)}`,
        { texto: conSigno(m.efecto), tono: tono(m.efecto) },
      ]),
    });
  } else {
    tabla(l, {
      columnas: [
        { titulo: "Métrica", peso: 3 }, { titulo: "Peso", alinear: "right", peso: 0.8 },
        { titulo: "Base", alinear: "right" }, { titulo: "Simulado", alinear: "right" },
        { titulo: "Efecto en el puntaje", alinear: "right", peso: 1.3 },
      ],
      filas: ajustadas.map((m) => [
        m.nombre, `${cifra(m.peso)} %`, cifra(m.base, 1), cifra(m.simulado, 1),
        { texto: conSigno(m.efecto), tono: tono(m.efecto) },
      ]),
    });
  }

  // Dónde rinde más mejorar: lo que aportaría llevar cada métrica al máximo.
  const potencial = d.metricas
    .map((m) => {
      const actual = cifras ? m.percentilSimulado : m.simulado;
      return { ...m, actual, puntos: Math.max(0, ((100 - (Number(actual) || 0)) * m.peso) / 100) };
    })
    .filter((m) => m.puntos > 0.05)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, 5);
  seccion(l, 3, "Dónde rinde más mejorar",
    cifras ? "Puntos que sumaría cada métrica si su cifra alcanzara el percentil 100, ordenadas de mayor a menor."
      : "Puntos que sumaría cada métrica si llegara a 100, ordenadas de mayor a menor.",
    { junto: potencial.length * 8.5 + 16 });
  if (potencial.length) {
    barras(l, {
      unidad: "puntos posibles en el total",
      datos: potencial.map((m) => ({
        etiqueta: `${m.nombre} · peso ${cifra(m.peso)} % · hoy ${cifra(m.actual, cifras ? 0 : 1)}${cifras ? " (percentil)" : ""}`,
        valor: m.puntos, texto: `+${cifra(m.puntos, 1)}`,
      })),
    });
  } else {
    vacio(l, "Todas las métricas están en su máximo.");
  }
  nota(l, `${METODO[cifras ? "cifras" : "puntajes"]} El detalle de todas las métricas está en la exportación CSV del módulo.`);

  return { doc, fecha, nombre: nombreArchivo("simulacion", institucion, ranking, anio) };
}

// ---------------------------------------------------------------------------
// Comparada
// ---------------------------------------------------------------------------

async function comparada(d) {
  const { ranking, anio, disciplina, cifras, foco, usuario, universo } = d;
  const inst = [...d.instituciones].sort((a, b) => a.posSim - b.posSim);
  const modificadas = inst.filter((i) => i.modificada);
  const conMov = inst.map((i) => ({ ...i, mov: movimiento(i.posBase, i.posSim) }));
  const mayorAlza = [...conMov].sort((a, b) => b.mov - a.mov)[0];
  const propia = conMov.find((i) => i.id === foco) || null;

  const { doc, l, fecha } = await crearDocumento({ titulo: `Simulación comparada · ${ranking}`, asunto: ranking, ranking });
  portada(l, {
    antetitulo: "Simulación · comparada",
    titulo: `Escenario comparado en ${ranking} ${anio}`,
    ficha: [
      `Año: ${anio}${disciplina ? ` · ${disciplina}` : ""}`,
      `Simulación sobre ${cifras ? "cifras medidas (percentiles)" : "puntajes"}`,
      `${inst.length} instituciones · ${d.cambios.length} ${d.cambios.length === 1 ? "valor modificado" : "valores modificados"}`,
      ...fichaDeEmision(usuario, fecha),
    ],
  });

  seccion(l, 1, "Resultado del escenario");
  cifrasClave(l, [
    { etiqueta: "Instituciones", valor: String(inst.length),
      detalle: cifras && universo ? `posiciones entre las ${universo} universidades del año` : "posiciones dentro del grupo comparado" },
    { etiqueta: "Valores modificados", valor: String(d.cambios.length), detalle: modificadas.length ? `en ${modificadas.length} ${modificadas.length === 1 ? "institución" : "instituciones"}` : "escenario sin cambios" },
    mayorAlza?.mov > 0 && { etiqueta: "Mayor alza", valor: `${puestos(mayorAlza.mov)} puestos`, tono: "positivo", detalle: mayorAlza.nombre },
    propia && { etiqueta: "Posición propia", valor: orden(propia.posSim), destacada: true,
      detalle: `antes ${orden(propia.posBase)} · ${propia.nombre}` },
  ]);
  const lider = inst[0];
  hallazgos(l, [
    `En el escenario, **${lider.nombre}** encabeza el grupo con **${cifra(lider.scoreSim, 1)}** puntos.`,
    !d.cambios.length && "No se modificó ningún valor: la clasificación es la real del año.",
    ...conMov.filter((i) => i.mov !== 0).slice(0, 4).map((i) =>
      `**${i.nombre}** ${i.mov > 0 ? "sube" : "baja"} ${Math.abs(i.mov)} ${Math.abs(i.mov) === 1 ? "puesto" : "puestos"}, del ${orden(i.posBase)} al ${orden(i.posSim)}.`),
    cifras && d.cambios.length && "Con cifras medidas, las instituciones que no se tocaron también pueden moverse: su percentil depende de las demás.",
  ]);

  seccion(l, 2, "Clasificación simulada", "", { junto: Math.min(inst.length * 8.5 + 16, 90) });
  barras(l, {
    unidad: cifras ? "puntaje (suma de percentiles por peso)" : "puntaje",
    datos: inst.map((i) => ({ etiqueta: `${orden(i.posSim)}  ${i.nombre}`, valor: i.scoreSim, texto: cifra(i.scoreSim, 1), destacada: i.id === foco })),
  });
  tabla(l, {
    columnas: [
      { titulo: "Institución", peso: 3 }, { titulo: "Puntaje base", alinear: "right" },
      { titulo: "Simulado", alinear: "right" }, { titulo: "Diferencia", alinear: "right" },
      { titulo: "Posición", alinear: "right" },
    ],
    filas: conMov.map((i) => [
      i.nombre, cifra(i.scoreBase, 1), cifra(i.scoreSim, 1),
      { texto: conSigno(i.scoreSim - i.scoreBase), tono: tono(i.scoreSim - i.scoreBase) },
      { texto: `${orden(i.posSim)}${i.mov ? ` (${puestos(i.mov)})` : ""}`, tono: tono(i.mov) },
    ]),
    destacar: (_, k) => conMov[k].id === foco,
  });

  seccion(l, 3, "Valores modificados");
  if (!d.cambios.length) {
    vacio(l, "No se modificó ningún valor.");
  } else {
    tabla(l, {
      columnas: [
        { titulo: "Institución", peso: 2.4 }, { titulo: "Métrica", peso: 2.4 },
        { titulo: "Base", alinear: "right" }, { titulo: "Simulado", alinear: "right" },
      ],
      filas: d.cambios.map((c) => [
        c.institucion, `${c.metrica}${c.unidad ? ` (${c.unidad})` : ""}`, cifra(c.base),
        { texto: cifra(c.simulado), tono: tono(c.simulado - c.base, c.menorEsMejor) },
      ]),
    });
  }
  nota(l, `${METODO[cifras ? "cifras" : "puntajes"]} La matriz completa está en la exportación CSV del módulo.`);

  return { doc, fecha, nombre: nombreArchivo("simulacion-comparada", ranking, anio) };
}

/** Compone el informe sin descargarlo. */
export async function construirInformeSimulacion(datos) {
  return datos.tipo === "comparada" ? comparada(datos) : unitaria(datos);
}

/** Compone y descarga. Devuelve el nombre del archivo. */
export async function generarInformeSimulacion(datos) {
  const { doc, fecha, nombre } = await construirInformeSimulacion(datos);
  return guardar(doc, fecha, ETIQUETA, nombre);
}
