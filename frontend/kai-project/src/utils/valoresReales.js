// Modo numérico de la pantalla de ranking: los valores medidos detrás de cada
// componente, en vez de sus puntajes normalizados.
//
// Los valores medidos no se suman: una razón de estudiantes por académico, un
// porcentaje y millones de pesos no tienen una escala común. Por eso esta vista
// no tiene total propio; conserva la posición del puntaje y deja ordenar por
// cualquier componente.

/** Qué significa cada calidad, en una marca y una frase para el usuario. */
export const CALIDADES = {
  directa: {
    marca: "",
    etiqueta: "medido",
    texto: "Medido con la misma definición y la misma fuente de datos que usa el ranking.",
  },
  aproximada: {
    marca: "≈",
    etiqueta: "aproximado",
    texto: "Misma definición que el ranking, pero con otro universo de datos (por ejemplo, OpenAlex en vez de Scopus).",
  },
  parcial: {
    marca: "◐",
    etiqueta: "parcial",
    texto: "Capta solo una parte de lo que el ranking mide (por ejemplo, los fondos ANID en vez del ingreso de investigación total).",
  },
};

const numero = (v, decimales) =>
  Number(v).toLocaleString("es-CL", { maximumFractionDigits: decimales, minimumFractionDigits: 0 });

/**
 * Formato legible y compacto. Los montos en pesos se abrevian en millones; las
 * razones pequeñas conservan los decimales que las distinguen (0,084 no es 0,1).
 */
export function formatearValor(valor) {
  if (valor == null || Number.isNaN(Number(valor))) return "—";
  const v = Number(valor);
  const a = Math.abs(v);
  if (a >= 1e6) return `${numero(v / 1e6, 1)} M`;
  if (a >= 1000) return numero(v, 0);
  if (a >= 100) return numero(v, 1);
  if (a >= 1) return numero(v, 2);
  return numero(v, 3);
}

/** Componentes que se muestran como columna: las que tienen algún valor, por peso. */
export function columnas(metricas) {
  return metricas
    .filter((m) => m.es_componente && m.tiene_valores)
    .sort((a, b) => b.peso_metrica - a.peso_metrica || a.nombre_metrica.localeCompare(b.nombre_metrica));
}

/** Componentes del ranking sin ningún valor este año, para decirlo en el aviso. */
export function sinValor(metricas) {
  return metricas
    .filter((m) => m.es_componente && !m.tiene_valores && m.peso_metrica > 0)
    .sort((a, b) => b.peso_metrica - a.peso_metrica);
}

/**
 * Una fila por universidad, con su posición en el puntaje del año y sus valores
 * por métrica. `ordenPuntaje` es la lista de universidades en el orden de la
 * tabla de puntajes —con los pesos del usuario, si el ranking los admite—.
 */
export function matriz(valores, ordenPuntaje) {
  const posicion = new Map(ordenPuntaje.map((id, i) => [id, i + 1]));
  const filas = new Map();
  for (const v of valores) {
    let f = filas.get(v.id_universidad);
    if (!f) {
      f = {
        id_universidad: v.id_universidad,
        nombre_universidad: v.nombre_universidad,
        posicion: posicion.get(v.id_universidad) ?? null,
        celdas: {},
      };
      filas.set(v.id_universidad, f);
    }
    f.celdas[v.id_metrica] = v;
  }
  return [...filas.values()];
}

/**
 * Ordena las filas. Por posición, o por una métrica «de mejor a peor» según su
 * sentido: en «estudiantes por académico» lo mejor es el número más bajo. Las
 * universidades sin ese valor van siempre al final, en cualquier dirección.
 */
export function ordenar(filas, criterio, metricas) {
  const copia = [...filas];
  const porNombre = (a, b) => a.nombre_universidad.localeCompare(b.nombre_universidad);
  if (!criterio || criterio.tipo === "posicion") {
    return copia.sort((a, b) =>
      (a.posicion ?? Infinity) - (b.posicion ?? Infinity) || porNombre(a, b));
  }
  const m = metricas.find((x) => x.id_metrica === criterio.id_metrica);
  const menorEsMejor = m?.sentido === "menor";
  const signo = (criterio.direccion === "peor" ? -1 : 1) * (menorEsMejor ? 1 : -1);
  return copia.sort((a, b) => {
    const va = a.celdas[criterio.id_metrica]?.valor;
    const vb = b.celdas[criterio.id_metrica]?.valor;
    if (va == null && vb == null) return porNombre(a, b);
    if (va == null) return 1;
    if (vb == null) return -1;
    return signo * (Number(va) - Number(vb)) || porNombre(a, b);
  });
}

/** Texto de ayuda de una celda: qué es, de dónde sale y cuánto se parece a lo que mide el ranking. */
export function detalleCelda(v, origen) {
  if (!v) return "Sin valor para esta universidad.";
  const calidad = origen === "fuente"
    ? "Publicado tal cual por la fuente."
    : CALIDADES[v.calidad]?.texto ?? v.calidad;
  return [
    `${formatearValor(v.valor)}${v.unidad ? " " + v.unidad : ""}`,
    calidad,
    v.formula ? `Fórmula: ${v.formula}` : null,
    v.fuentes ? `Fuentes: ${v.fuentes}` : null,
    v.anios_origen ? `Datos: ${v.anios_origen}` : null,
  ].filter(Boolean).join("\n");
}

/** Filas del CSV en formato largo: una por valor, con todo lo necesario para citarlo. */
export function filasCSV(valores, metricas, origen) {
  const nombre = new Map(metricas.map((m) => [m.id_metrica, m.nombre_metrica]));
  return [
    ["Institución", "Métrica", "Valor", "Unidad", "Calidad", "Fórmula", "Fuentes", "Datos"],
    ...[...valores]
      .sort((a, b) => a.nombre_universidad.localeCompare(b.nombre_universidad)
        || String(nombre.get(a.id_metrica)).localeCompare(String(nombre.get(b.id_metrica))))
      .map((v) => [
        v.nombre_universidad,
        nombre.get(v.id_metrica) ?? v.id_metrica,
        v.valor,
        v.unidad ?? "",
        origen === "fuente" ? "publicado por la fuente" : (CALIDADES[v.calidad]?.etiqueta ?? v.calidad),
        v.formula ?? "",
        v.fuentes ?? "",
        v.anios_origen ?? "",
      ]),
  ];
}
