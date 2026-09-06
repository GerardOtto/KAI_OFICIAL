// Paleta de 12 series del rediseño, en hex.
//
// Los valores nacieron como oklch() en el diseño, pero html2canvas (1.4.1) no sabe
// parsear esa función y aborta la captura, que es lo que rompía la exportación a
// PDF. Se conserva el oklch original en el comentario de cada color por si hay que
// reajustarlos. La conversión es exacta a sRGB.
export const P12 = [
  "#60aaf3", // azul    · oklch(.72 .13 250)
  "#e8aa4e", // ámbar   · oklch(.78 .13 75)
  "#5ec386", // verde   · oklch(.74 .13 155)
  "#ab8be3", // violeta · oklch(.7 .13 300)
  "#e66e68", // rojo    · oklch(.68 .15 25)
  "#46c6cd", // cian    · oklch(.76 .11 200)
  "#c9c261", // lima    · oklch(.8 .12 105)
  "#d37db8", // rosa    · oklch(.7 .13 340)
  "#82a5e4", // índigo  · oklch(.72 .1 262)
  "#93c88c", // jade    · oklch(.78 .1 142)
  "#ea906d", // naranja · oklch(.74 .12 42)
  "#9a8bd7", // púrpura · oklch(.68 .11 292)
];

// Semánticos, también en hex por la misma razón.
export const POSITIVO = "#5ec386";
export const NEGATIVO = "#e66e68";

// Sin tope de series: los colores se repiten a partir de la 13.
export const colorDeIndice = (i) => P12[i % P12.length];

export const alpha = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export const fmt = (v, d = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : Number(v).toFixed(d).replace(".", ",");

// Decimales razonables según la escala de la métrica.
export const decimalesPara = (techo) => (techo >= 1000 ? 0 : techo >= 100 ? 1 : 2);
