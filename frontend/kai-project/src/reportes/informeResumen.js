/** Informe PDF del Resumen: la clasificación de un ranking en un año.
 *
 *  Abre con la posición de la institución propia, lee los movimientos respecto
 *  de la edición anterior y muestra las diez primeras en barras y la
 *  clasificación en una tabla acotada. En el Ranking KAI, que se reordena con
 *  los pesos del usuario, lleva además los pesos con que se calculó: sin ellos
 *  el orden no se puede reproducir.
 */
import {
  barras, cifra, cifrasClave, crearDocumento, fichaDeEmision, guardar, hallazgos,
  nombreArchivo, nota, portada, puestos, seccion, tabla, tono,
} from "./documento";

const ETIQUETA = "KAI · INFORME DE CLASIFICACIÓN";
const MAX_FILAS = 25;
const orden = (n) => `${n}.º`;
const flecha = puestos;

async function construir(datos) {
  const { ranking, anio, anioAnterior, descripcion, pesos, pesosPropios, numerico, foco, usuario } = datos;
  const filas = datos.filas.map((f, i) => ({ ...f, pos: i + 1 }));
  if (!filas.length) throw new Error("No hay datos que incluir en el informe.");

  const lider = filas[0];
  const propia = filas.find((f) => f.id === foco) || null;
  const conDelta = filas.filter((f) => f.delta != null);
  const suben = [...conDelta].filter((f) => f.delta > 0).sort((a, b) => b.delta - a.delta);
  const bajan = [...conDelta].filter((f) => f.delta < 0).sort((a, b) => a.delta - b.delta);
  const media = filas.reduce((s, f) => s + f.score, 0) / filas.length;

  const { doc, l, fecha } = await crearDocumento({ titulo: `Clasificación ${ranking} ${anio}`, asunto: ranking, ranking });
  portada(l, {
    antetitulo: "Resumen · clasificación",
    titulo: `${ranking} ${anio}`,
    ficha: [
      `${filas.length} instituciones clasificadas`,
      anioAnterior && `Variación respecto de ${anioAnterior}`,
      pesosPropios && "Ordenado con pesos ajustados por el usuario",
      ...fichaDeEmision(usuario, fecha),
    ],
  });

  // 01 · Cifras clave --------------------------------------------------------
  seccion(l, 1, "Cifras clave", propia ? `De ${propia.nombre}.` : `Del conjunto de ${filas.length} instituciones.`);
  cifrasClave(l, propia ? [
    { etiqueta: "Posición", valor: orden(propia.pos), destacada: true, detalle: `de ${filas.length} instituciones` },
    { etiqueta: "Puntaje", valor: cifra(propia.score, 1), detalle: `media del ranking: ${cifra(media, 1)}` },
    propia.pos > 1
      ? { etiqueta: "Distancia al primero", valor: cifra(lider.score - propia.score, 1), detalle: `frente a ${lider.nombre}` }
      : { etiqueta: "Ventaja sobre el segundo", valor: filas[1] ? cifra(propia.score - filas[1].score, 1) : "—", detalle: filas[1]?.nombre || "" },
    anioAnterior && { etiqueta: `Frente a ${anioAnterior}`, valor: flecha(propia.delta), tono: tono(propia.delta),
      detalle: propia.delta == null ? "sin dato en la edición anterior" : propia.delta === 0 ? "misma posición" : `${Math.abs(propia.delta)} ${Math.abs(propia.delta) === 1 ? "puesto" : "puestos"}` },
  ] : [
    { etiqueta: "Primer lugar", valor: cifra(lider.score, 1), destacada: true, detalle: lider.nombre },
    { etiqueta: "Instituciones", valor: String(filas.length), detalle: `en ${anio}` },
    { etiqueta: "Puntaje medio", valor: cifra(media, 1), detalle: "promedio de las clasificadas" },
  ]);

  // 02 · Lectura -------------------------------------------------------------
  seccion(l, 2, "Lectura");
  const segundo = filas[1];
  hallazgos(l, [
    `**${lider.nombre}** encabeza ${ranking} ${anio} con **${cifra(lider.score, 1)}** puntos${segundo ? `, ${cifra(lider.score - segundo.score, 1)} por delante de ${segundo.nombre}` : ""}.`,
    propia && propia.pos > 1 && `**${propia.nombre}** ocupa el puesto **${orden(propia.pos)}** con ${cifra(propia.score, 1)} puntos${propia.delta ? `, ${propia.delta > 0 ? "sube" : "baja"} ${Math.abs(propia.delta)} ${Math.abs(propia.delta) === 1 ? "puesto" : "puestos"} respecto de ${anioAnterior}` : ""}.`,
    suben[0] && `El mayor ascenso respecto de ${anioAnterior} es de **${suben[0].nombre}** (${flecha(suben[0].delta)}), hoy en el puesto ${orden(suben[0].pos)}.`,
    bajan[0] && `El mayor retroceso es de **${bajan[0].nombre}** (${flecha(bajan[0].delta)}), hoy en el puesto ${orden(bajan[0].pos)}.`,
    conDelta.length > 0 && `${suben.length} instituciones mejoraron su posición, ${bajan.length} retrocedieron y ${conDelta.length - suben.length - bajan.length} se mantuvieron.`,
    numerico && "El informe ordena por puntaje; las cifras medidas de cada institución están en la exportación CSV.",
  ]);

  // 03 · Las diez primeras ---------------------------------------------------
  seccion(l, 3, "Las diez primeras", "", { junto: 60 });
  const diez = filas.slice(0, 10);
  if (propia && propia.pos > 10) diez.push(propia);
  barras(l, {
    unidad: pesosPropios ? "puntaje con tus pesos" : "puntaje",
    maximo: Math.max(lider.score, 1),
    datos: diez.map((f) => ({ etiqueta: `${orden(f.pos)}  ${f.nombre}`, valor: f.score, texto: cifra(f.score, 1), destacada: f.id === foco })),
    fuente: `Fuente: ${ranking} · base de datos de KAI`,
  });

  // 04 · Clasificación -------------------------------------------------------
  seccion(l, 4, "Clasificación", filas.length > MAX_FILAS ? `Las primeras ${MAX_FILAS} de ${filas.length}${propia && propia.pos > MAX_FILAS ? ", más la institución propia" : ""}.` : "");
  const visibles = filas.slice(0, MAX_FILAS);
  if (propia && propia.pos > MAX_FILAS) visibles.push(propia);
  tabla(l, {
    columnas: [
      { titulo: "Pos.", alinear: "right", peso: 0.6 },
      { titulo: "Institución", peso: 4 },
      { titulo: "País", peso: 1.1 },
      { titulo: "Puntaje", alinear: "right", peso: 1 },
      ...(anioAnterior ? [{ titulo: `Var. ${anioAnterior}`, alinear: "right", peso: 0.9 }] : []),
    ],
    filas: visibles.map((f) => [
      String(f.pos), f.nombre, f.pais || "", cifra(f.score, 1),
      ...(anioAnterior ? [{ texto: flecha(f.delta), tono: tono(f.delta) }] : []),
    ]),
    destacar: (_, i) => visibles[i].id === foco,
  });

  // 05 · Pesos ----------------------------------------------------------------
  if (pesos?.length) {
    seccion(l, 5, pesosPropios ? "Pesos usados (ajustados)" : "Pesos del ranking", "Con estos pesos se calculó el orden anterior.");
    tabla(l, {
      columnas: [{ titulo: "Métrica", peso: 4 }, { titulo: "Peso", alinear: "right" }, { titulo: "Parte del total", alinear: "right" }],
      filas: pesos.map((p) => [p.nombre, cifra(p.peso), `${cifra(p.parte, 1)} %`]),
    });
  }

  nota(l, [descripcion && `Metodología: ${descripcion}`,
    filas.length > MAX_FILAS && "La clasificación completa está en la exportación CSV del módulo."].filter(Boolean).join(" "));

  return { doc, fecha, nombre: nombreArchivo("clasificacion", ranking, anio) };
}

export const construirInformeResumen = construir;

/** Compone y descarga. Devuelve el nombre del archivo. */
export async function generarInformeResumen(datos) {
  const { doc, fecha, nombre } = await construir(datos);
  return guardar(doc, fecha, ETIQUETA, nombre);
}

