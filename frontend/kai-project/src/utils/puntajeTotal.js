/** El puntaje total de cada ranking es una métrica más, de tipo «Puntaje»: una por
 *  ranking y, en los multidisciplinarios, una por disciplina (migración 020).
 *
 *  No reparte peso —su peso es 0 y no pondera—, así que no puede tratarse como
 *  una dimensión: se muestra primero, sin porcentaje, y nunca entra en una suma.
 */
export const TIPO_PUNTAJE_TOTAL = "Puntaje";

export const esPuntajeTotal = (m) => m?.tipo_metrica === TIPO_PUNTAJE_TOTAL;

/** El total primero; las demás, de mayor a menor peso. */
export const totalPrimeroPorPeso = (lista) =>
  [...lista].sort((a, b) =>
    (esPuntajeTotal(b) - esPuntajeTotal(a))
    || Number(b.peso_metrica || 0) - Number(a.peso_metrica || 0));

/** El peso tal como se lee junto al nombre: el total no tiene. */
export const pesoVisible = (m) => (esPuntajeTotal(m) || m?.peso_metrica == null ? null : m.peso_metrica);
