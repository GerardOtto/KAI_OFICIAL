/** Informe PDF del módulo de Tendencias.
 *
 *  Antes era una captura de la pantalla oscura seguida del volcado de todas las
 *  filas. Ahora se lee como un análisis: cifras clave de la institución propia,
 *  una lectura en frases, el gráfico dibujado en vectores y una tabla de una
 *  fila por institución. El detalle año a año queda en la exportación XLSX.
 */
import { linearRegression, rSquared } from "../utils/regression";
import {
  barras, cifra, cifrasClave, conSigno, crearDocumento, fichaDeEmision, guardar, hallazgos, lineas,
  nombreArchivo, nota, portada, seccion, tabla, tono,
} from "./documento";

const ETIQUETA = "KAI · INFORME DE TENDENCIAS";
const pct = (v) => (v == null || !Number.isFinite(v) ? "—" : `${conSigno(v, 1)} %`);
const orden = (n) => `${n}.º`;

// ---------------------------------------------------------------------------
// Evolución: una métrica, varios años
// ---------------------------------------------------------------------------

/** Estadística de una serie: extremos, variación y tendencia lineal. */
function analizarSerie(serie, anos, acotar) {
  const puntos = [...serie.puntos].sort((a, b) => a.x - b.x);
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];
  const delta = ultimo.y - primero.y;
  const reg = linearRegression(puntos);
  const horizonte = anos ? ultimo.x + anos : null;
  // Un puntaje normalizado vive entre 0 y 100: la recta no puede sacarlo de ahí.
  const recta = (x) => {
    const y = reg.slope * x + reg.intercept;
    return acotar ? Math.max(0, Math.min(100, y)) : y;
  };
  return {
    ...serie,
    puntos,
    primero,
    ultimo,
    delta,
    deltaPct: primero.y ? (delta / Math.abs(primero.y)) * 100 : null,
    pendiente: reg?.slope ?? null,
    r2: reg ? rSquared(puntos, reg.slope, reg.intercept) : null,
    proyectado: reg && horizonte ? recta(horizonte) : null,
    proyeccion: reg && anos
      ? Array.from({ length: anos }, (_, i) => ({ x: ultimo.x + i + 1, y: recta(ultimo.x + i + 1) }))
      : [],
  };
}

async function evolucion(datos) {
  const { ranking, disciplina, metrica, numerico, unidad, anosProyeccion, foco, usuario } = datos;
  const series = datos.series
    .filter((s) => s.puntos.length)
    .map((s) => analizarSerie(s, anosProyeccion, !numerico));
  if (!series.length) throw new Error("No hay datos que incluir en el informe.");

  const anoFinal = Math.max(...series.map((s) => s.ultimo.x));
  const anoInicial = Math.min(...series.map((s) => s.primero.x));
  const alDia = series.filter((s) => s.ultimo.x === anoFinal).sort((a, b) => b.ultimo.y - a.ultimo.y);
  const propia = series.find((s) => s.id === foco) || null;
  const lider = alDia[0];
  const conTendencia = series.filter((s) => s.pendiente != null);
  const horizonte = anosProyeccion ? anoFinal + anosProyeccion : null;
  const u = unidad ? ` ${unidad}` : "";
  const valores = numerico ? `Cifras medidas${unidad ? ` (${unidad})` : ""}` : "Puntajes normalizados de 0 a 100";

  const { doc, l, fecha } = await crearDocumento({ titulo: `Tendencias · ${metrica.nombre}`, asunto: ranking, ranking });
  portada(l, {
    antetitulo: "Tendencias · evolución",
    titulo: `${metrica.nombre} en ${ranking}`,
    ficha: [
      disciplina && `Disciplina: ${disciplina}`,
      `Métrica: ${metrica.nombre}${Number(metrica.peso) > 0 ? ` · peso ${cifra(metrica.peso)} %` : ""}`,
      `Período: ${anoInicial}–${anoFinal} · ${series.length} instituciones`,
      `Valores: ${valores}`,
      horizonte && `Proyección lineal a ${horizonte}`,
      ...fichaDeEmision(usuario, fecha),
    ],
  });

  // 01 · Cifras clave ------------------------------------------------------
  const ref = propia || lider;
  const pos = alDia.findIndex((s) => s.id === ref.id) + 1;
  seccion(l, 1, "Cifras clave", propia ? `De ${ref.nombre}, la institución de quien emite el informe.`
    : `De ${ref.nombre}, que encabeza el grupo en ${anoFinal}.`);
  cifrasClave(l, [
    { etiqueta: `Valor ${ref.ultimo.x}`, valor: `${cifra(ref.ultimo.y)}${u}`, detalle: ref.nombre, destacada: true },
    { etiqueta: `Variación ${ref.primero.x}–${ref.ultimo.x}`, valor: conSigno(ref.delta), tono: tono(ref.delta),
      detalle: ref.deltaPct != null ? `${pct(ref.deltaPct)} desde ${cifra(ref.primero.y)}` : "" },
    pos > 0 && { etiqueta: `Posición ${anoFinal}`, valor: orden(pos), detalle: `entre las ${alDia.length} instituciones con dato ese año` },
    horizonte && ref.proyectado != null
      ? { etiqueta: `Proyección ${horizonte}`, valor: `${cifra(ref.proyectado, 1)}${u}`,
          detalle: `tendencia lineal, R² ${cifra(ref.r2, 2)}` }
      : ref.pendiente != null && { etiqueta: "Tendencia anual", valor: conSigno(ref.pendiente, 2),
          tono: tono(ref.pendiente), detalle: "pendiente de la recta ajustada" },
  ]);

  // 02 · Lectura -------------------------------------------------------------
  seccion(l, 2, "Lectura");
  const alzas = [...series].sort((a, b) => b.delta - a.delta);
  const mayorAlza = alzas[0];
  const mayorCaida = alzas[alzas.length - 1];
  const ultimoDelGrupo = alDia[alDia.length - 1];
  const mejorProyeccion = horizonte ? [...conTendencia].sort((a, b) => b.proyectado - a.proyectado)[0] : null;
  const r2Medio = conTendencia.length ? conTendencia.reduce((s, x) => s + (x.r2 ?? 0), 0) / conTendencia.length : null;
  hallazgos(l, [
    `En ${anoFinal}, **${lider.nombre}** encabeza el grupo con **${cifra(lider.ultimo.y)}${u}**.`,
    propia && propia.id !== lider.id && pos > 0
      && `**${propia.nombre}** ocupa el puesto **${orden(pos)}** de ${alDia.length}, a ${cifra(lider.ultimo.y - propia.ultimo.y)}${u} del primero.`,
    propia && `**${propia.nombre}** pasó de ${cifra(propia.primero.y)} en ${propia.primero.x} a **${cifra(propia.ultimo.y)}** en ${propia.ultimo.x} (${conSigno(propia.delta)}${propia.deltaPct != null ? `, ${pct(propia.deltaPct)}` : ""}).`,
    series.length > 1 && mayorAlza.delta > 0
      && `El mayor avance del período es de **${mayorAlza.nombre}** (${conSigno(mayorAlza.delta)})${mayorCaida.delta < 0 ? `, y el mayor retroceso, de **${mayorCaida.nombre}** (${conSigno(mayorCaida.delta)})` : ""}.`,
    alDia.length > 2 && `En ${anoFinal}, la distancia entre el primero y el último del grupo es de **${cifra(lider.ultimo.y - ultimoDelGrupo.ultimo.y)}${u}**.`,
    mejorProyeccion && `Si la tendencia lineal se mantiene, **${mejorProyeccion.nombre}** llegaría a **${cifra(mejorProyeccion.proyectado, 1)}${u}** en ${horizonte}${r2Medio != null ? ` (ajuste medio R² ${cifra(r2Medio, 2)}: tómese como orientación, no como pronóstico)` : ""}.`,
  ]);

  // 03 · Gráfico ------------------------------------------------------------
  seccion(l, 3, "Evolución", "", { junto: 120 });
  lineas(l, {
    titulo: `${metrica.nombre} · ${anoInicial}–${horizonte || anoFinal}`,
    unidad: numerico ? unidad || "cifra medida" : "puntaje 0–100",
    series: series.map((s) => ({
      nombre: s.nombre, color: s.color, destacada: s.id === foco,
      puntos: s.puntos, proyeccion: horizonte ? s.proyeccion : [],
    })),
    fuente: `Fuente: ${ranking} · base de datos de KAI`,
  });

  // 04 · Tabla por institución ----------------------------------------------
  seccion(l, 4, "Resumen por institución", "Una fila por institución: primer y último año con dato, variación y tendencia.");
  const ordenadas = [...series].sort((a, b) => b.ultimo.y - a.ultimo.y);
  tabla(l, {
    columnas: [
      { titulo: "Institución", peso: 3 },
      { titulo: "Primer dato", alinear: "right", peso: 1.2 },
      { titulo: "Último dato", alinear: "right", peso: 1.2 },
      { titulo: "Variación", alinear: "right" },
      { titulo: "Tend. anual", alinear: "right" },
      ...(horizonte ? [{ titulo: `Proy. ${horizonte}`, alinear: "right" }] : []),
    ],
    filas: ordenadas.map((s) => [
      s.nombre,
      `${cifra(s.primero.y)} (${s.primero.x})`,
      `${cifra(s.ultimo.y)} (${s.ultimo.x})`,
      { texto: conSigno(s.delta), tono: tono(s.delta) },
      { texto: s.pendiente == null ? "—" : conSigno(s.pendiente, 2), tono: tono(s.pendiente) },
      ...(horizonte ? [s.proyectado == null ? "—" : cifra(s.proyectado, 1)] : []),
    ]),
    destacar: (_, i) => ordenadas[i].id === foco,
  });
  nota(l, [
    numerico ? "Cifras medidas tal como las informa la fuente." : "Puntajes normalizados tal como los publica cada ranking.",
    "La tendencia anual es la pendiente de una recta de mínimos cuadrados y exige al menos tres años de datos.",
    "El detalle año a año de cada institución está en la exportación XLSX del módulo.",
  ].join(" "));

  return { doc, fecha, nombre: nombreArchivo("tendencias", metrica.nombre, ranking) };
}

// ---------------------------------------------------------------------------
// Comparación anual: varias métricas, un año
// ---------------------------------------------------------------------------

async function anual(datos) {
  const { ranking, disciplina, anio, numerico, foco, usuario } = datos;
  const metricas = datos.metricas.slice(0, 6);
  const instituciones = datos.instituciones;
  // valores[idUni][idMet] = { valor, techo }
  const celda = (idU, idM) => datos.valores[idU]?.[idM] ?? null;
  const pctTecho = (c) => (c && Number(c.techo) ? (Number(c.valor) / Number(c.techo)) * 100 : null);

  const perfiles = instituciones.map((inst) => {
    const pcts = metricas.map((m) => pctTecho(celda(inst.id, m.id))).filter((v) => v != null);
    return { ...inst, promedio: pcts.length ? pcts.reduce((s, v) => s + v, 0) / pcts.length : null, conDato: pcts.length };
  }).filter((p) => p.conDato);
  if (!perfiles.length) throw new Error("No hay datos que incluir en el informe.");
  perfiles.sort((a, b) => b.promedio - a.promedio);

  const lideres = metricas.map((m) => {
    const conValor = instituciones.map((i) => ({ inst: i, c: celda(i.id, m.id) })).filter((x) => x.c?.valor != null);
    conValor.sort((a, b) => Number(b.c.valor) - Number(a.c.valor));
    return { m, lider: conValor[0] || null };
  });
  const propia = perfiles.find((p) => p.id === foco) || null;
  const ref = propia || perfiles[0];
  const pos = perfiles.findIndex((p) => p.id === ref.id) + 1;
  const lidera = lideres.filter((x) => x.lider?.inst.id === ref.id).map((x) => x.m.nombre);
  const suyas = metricas.map((m) => ({ m, p: pctTecho(celda(ref.id, m.id)) })).filter((x) => x.p != null)
    .sort((a, b) => b.p - a.p);

  const { doc, l, fecha } = await crearDocumento({ titulo: `Tendencias · comparación ${anio}`, asunto: ranking, ranking });
  portada(l, {
    antetitulo: "Tendencias · comparación anual",
    titulo: `Comparación ${anio} en ${ranking}`,
    ficha: [
      disciplina && `Disciplina: ${disciplina}`,
      `${metricas.length} métricas · ${perfiles.length} instituciones`,
      `Valores: ${numerico ? "cifras medidas" : "puntajes"}, expresados como porcentaje de la mayor observada`,
      ...fichaDeEmision(usuario, fecha),
    ],
  });

  seccion(l, 1, "Cifras clave", `De ${ref.nombre}${propia ? "" : ", que encabeza el promedio del grupo"}.`);
  cifrasClave(l, [
    { etiqueta: "Promedio del techo", valor: `${cifra(ref.promedio, 1)} %`, detalle: "promedio entre las métricas comparadas", destacada: true },
    { etiqueta: "Posición por promedio", valor: orden(pos), detalle: `entre ${perfiles.length} instituciones` },
    suyas[0] && { etiqueta: "Métrica más fuerte", valor: `${cifra(suyas[0].p, 0)} %`, detalle: suyas[0].m.nombre },
    { etiqueta: "Métricas que lidera", valor: `${lidera.length} de ${metricas.length}`, detalle: lidera.slice(0, 2).join(" · ") || "ninguna" },
  ]);

  seccion(l, 2, "Lectura");
  const masDebil = suyas[suyas.length - 1];
  hallazgos(l, [
    `Por promedio, **${perfiles[0].nombre}** encabeza el grupo con **${cifra(perfiles[0].promedio, 1)} %** del techo.`,
    ...lideres.filter((x) => x.lider).map((x) =>
      `En **${x.m.nombre}** lidera **${x.lider.inst.nombre}** con ${cifra(x.lider.c.valor)}${x.lider.c.unidad ? ` ${x.lider.c.unidad}` : ""}.`),
    propia && suyas.length > 1
      && `La métrica más fuerte de **${propia.nombre}** es **${suyas[0].m.nombre}** (${cifra(suyas[0].p, 0)} % del techo) y la más débil, **${masDebil.m.nombre}** (${cifra(masDebil.p, 0)} %).`,
  ]);

  seccion(l, 3, "Promedio por institución", "Porcentaje de la mayor cifra observada, promediado entre las métricas.",
    { junto: Math.min(perfiles.length * 8.5 + 16, 90) });
  barras(l, {
    unidad: "% del techo",
    maximo: 100,
    datos: perfiles.map((p) => ({ etiqueta: p.nombre, valor: p.promedio, texto: `${cifra(p.promedio, 1)} %`, destacada: p.id === foco })),
  });

  seccion(l, 4, "Valores por métrica", "La cifra más alta de cada métrica va en negrita.");
  const maximos = Object.fromEntries(lideres.map((x) => [x.m.id, x.lider ? Number(x.lider.c.valor) : null]));
  tabla(l, {
    puntos: metricas.length > 4 ? 7.8 : 8.5,
    columnas: [
      { titulo: "Institución", peso: 2.6 },
      ...metricas.map((m) => ({ titulo: m.nombre, alinear: "right" })),
    ],
    filas: perfiles.map((p) => [
      p.nombre,
      ...metricas.map((m) => {
        const c = celda(p.id, m.id);
        if (c?.valor == null) return "—";
        return { texto: cifra(c.valor), negrita: Number(c.valor) === maximos[m.id] };
      }),
    ]),
    destacar: (_, i) => perfiles[i].id === foco,
  });
  if (datos.metricas.length > metricas.length) {
    nota(l, `El informe muestra las primeras ${metricas.length} de ${datos.metricas.length} métricas seleccionadas.`);
  }
  nota(l, "El techo de cada métrica es la mayor cifra observada ese año en el ranking. La tabla completa está en la exportación XLSX del módulo.");

  return { doc, fecha, nombre: nombreArchivo("tendencias", `comparacion-${anio}`, ranking) };
}

/** Compone el informe sin descargarlo. */
export async function construirInformeTendencias(datos) {
  return datos.vista === "anual" ? anual(datos) : evolucion(datos);
}

/** Compone y descarga. Devuelve el nombre del archivo. */
export async function generarInformeTendencias(datos) {
  const { doc, fecha, nombre } = await construirInformeTendencias(datos);
  return guardar(doc, fecha, ETIQUETA, nombre);
}

