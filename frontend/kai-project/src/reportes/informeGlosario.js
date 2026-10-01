/** Informe PDF del Glosario: qué mide cada ranking, y cuánto pesa.
 *
 *  El informe anterior listaba cada métrica de cada ranking, dimensión por
 *  dimensión: más de mil líneas, cientos de ellas de Shanghai GRAS repitiendo la
 *  misma métrica en cada disciplina. El informe nuevo es la matriz que se ve en
 *  pantalla —dimensiones por rankings, con el peso de cada cruce y el calor que
 *  lo acompaña—, una lectura en frases y, si hay institución y año elegidos,
 *  sus valores. El listado completo de métricas queda en la exportación CSV.
 */
import {
  calor, cifra, crearDocumento, fichaDeEmision, guardar, hallazgos, nombreArchivo, nota, portada,
  seccion, tabla,
} from "./documento";

const ETIQUETA = "KAI · INFORME DEL GLOSARIO";
const PESO_MAXIMO = 30; // desde aquí el calor ya no aumenta: evita que un 60 % apague al resto

/** Texto de una celda de la matriz de pesos. */
function textoPeso(c) {
  if (!c) return "";
  if (c.soloReferencia) return "ref";
  return `${cifra(c.peso, c.peso < 10 ? 1 : 0)} %${c.multi ? "*" : ""}`;
}

async function construir(datos) {
  const { rankings, dimensiones, institucion, anio, numerico, totalMetricas, usuario } = datos;
  const visibles = dimensiones.filter((d) => rankings.some((r) => d.celdas[r.id]));
  // Sin ningún valor para esa institución y año, la segunda matriz saldría en
  // blanco: se omite.
  const conValores = Boolean(institucion && anio)
    && visibles.some((d) => rankings.some((r) => !r.restringido && d.celdas[r.id]?.valor != null));

  const { doc, l, fecha } = await crearDocumento({ titulo: "Qué mide cada ranking, y cuánto pesa", asunto: "Glosario de métricas" });
  portada(l, {
    antetitulo: "Glosario",
    titulo: "Qué mide cada ranking, y cuánto pesa",
    ficha: [
      `${rankings.length} rankings · ${visibles.length} dimensiones${totalMetricas ? ` · ${cifra(totalMetricas)} métricas` : ""}`,
      conValores && `Valores de ${institucion} en ${anio} · ${numerico ? "cifras medidas" : "puntajes"}`,
      ...fichaDeEmision(usuario, fecha),
    ],
  });

  // 01 · Lectura --------------------------------------------------------------
  seccion(l, 1, "Lectura");
  const frasesRanking = rankings.map((r) => {
    const suyas = visibles
      .map((d) => ({ d, c: d.celdas[r.id] }))
      .filter((x) => x.c && !x.c.soloReferencia && x.c.peso > 0)
      .sort((a, b) => b.c.peso - a.c.peso);
    if (!suyas.length) return null;
    const [primera, segunda] = suyas;
    return `**${r.nombre}** concentra su mayor peso en **${primera.d.nombre}** (${cifra(primera.c.peso, 0)} %)`
      + (segunda ? `, seguida de ${segunda.d.nombre} (${cifra(segunda.c.peso, 0)} %).` : ".");
  });
  const cobertura = visibles
    .map((d) => ({ d, n: rankings.filter((r) => d.celdas[r.id] && !d.celdas[r.id].soloReferencia).length }))
    .sort((a, b) => b.n - a.n);
  const unicas = cobertura.filter((x) => x.n === 1).map((x) => x.d.nombre);
  hallazgos(l, [
    cobertura[0] && `**${cobertura[0].d.nombre}** es la dimensión que más rankings miden: ${cobertura[0].n} de ${rankings.length}.`,
    unicas.length && (unicas.length === 1
      ? `**${unicas[0]}** la mide un solo ranking.`
      : `Hay ${unicas.length} dimensiones que mide un solo ranking: ${unicas.slice(0, 5).join(", ")}${unicas.length > 5 ? " y otras" : ""}.`),
    ...frasesRanking,
  ]);

  // 02 · Matriz de pesos ----------------------------------------------------
  seccion(l, 2, "Matriz de pesos", "Cuánto pesa cada dimensión en cada ranking. Más intenso, más peso; vacío, el ranking no la mide.");
  const columnas = [{ titulo: "Dimensión", peso: 2.2 }, ...rankings.map((r) => ({ titulo: r.nombre, alinear: "center" }))];
  const puntos = rankings.length > 6 ? 7.2 : 8;
  tabla(l, {
    puntos,
    columnas,
    filas: visibles.map((d) => [
      { texto: d.nombre, negrita: true },
      ...rankings.map((r) => {
        const c = d.celdas[r.id];
        if (!c) return "";
        return { texto: textoPeso(c), fondo: c.soloReferencia ? null : calor(c.peso / PESO_MAXIMO) };
      }),
    ]),
  });

  // 03 · Valores de la institución -----------------------------------------
  if (conValores) {
    seccion(l, 3, `Valores de ${institucion} en ${anio}`,
      `El ${numerico ? "valor medido" : "puntaje"} de la métrica de mayor peso de cada dimensión. Los rankings de pago no incluidos en el plan quedan en blanco.`);
    tabla(l, {
      puntos,
      columnas,
      // Solo las dimensiones con algún valor: las demás serían filas en blanco.
      filas: visibles
        .filter((d) => rankings.some((r) => !r.restringido && d.celdas[r.id]?.valor != null))
        .map((d) => [
        { texto: d.nombre, negrita: true },
        ...rankings.map((r) => {
          const c = d.celdas[r.id];
          if (!c || r.restringido || c.valor == null) return c && r.restringido ? "plan de pago" : "";
          return { texto: cifra(c.valor) };
        }),
      ]),
    });
  }

  const notas = [];
  if (visibles.some((d) => rankings.some((r) => d.celdas[r.id]?.multi))) {
    notas.push("* Ranking multidisciplinario: el peso es la cuota que la dimensión ocupa dentro de cada disciplina, promediada entre todas; sumarlas daría porcentajes de varios miles.");
  }
  if (visibles.some((d) => rankings.some((r) => d.celdas[r.id]?.soloReferencia))) {
    notas.push("«ref»: el ranking mide la dimensión dentro de otro pilar, sin peso propio en el total.");
  }
  notas.push("El listado completo de métricas, con su peso y ranking, está en la exportación CSV del módulo.");
  nota(l, notas.join(" "));

  return { doc, fecha, nombre: nombreArchivo("glosario", institucion, anio) };
}

export const construirInformeGlosario = construir;

/** Compone y descarga. Devuelve el nombre del archivo. */
export async function generarInformeGlosario(datos) {
  const { doc, fecha, nombre } = await construir(datos);
  return guardar(doc, fecha, ETIQUETA, nombre);
}
