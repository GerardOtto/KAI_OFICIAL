// Sonda de la lógica del modo numérico: formato, columnas, orden y exportación.
//
// Lógica pura, sin navegador ni servidor:
//   node pruebas/valores_medidos.mjs
import {
  CALIDADES, formatearValor, columnas, sinValor, matriz, ordenar, detalleCelda, filasCSV,
} from "../src/utils/valoresReales.js";

const fallos = [];
const comprobar = (nombre, cond, detalle = "") => {
  console.log(`  [${cond ? "OK " : "FALLA"}] ${nombre}` + (!cond && detalle ? ` -> ${detalle}` : ""));
  if (!cond) fallos.push(nombre);
};

console.log("=== 1. Formato ===");
comprobar("los montos en pesos se abrevian en millones", formatearValor(16480417.9) === "16,5 M", formatearValor(16480417.9));
comprobar("los miles llevan separador de miles, sin decimales", formatearValor(5052) === "5.052", formatearValor(5052));
comprobar("una razón mediana conserva dos decimales", formatearValor(24.7619) === "24,76", formatearValor(24.7619));
comprobar("una razón pequeña conserva tres, para no confundir 0,084 con 0,1",
  formatearValor(0.0842) === "0,084", formatearValor(0.0842));
comprobar("cero se muestra como cero, no como vacío", formatearValor(0) === "0", formatearValor(0));
comprobar("un valor ausente se muestra como guion", formatearValor(null) === "—");

console.log("\n=== 2. Columnas y huecos ===");
const metricas = [
  { id_metrica: 1, nombre_metrica: "Student staff ratio", peso_metrica: 4.5, es_componente: true, tiene_valores: true, sentido: "menor" },
  { id_metrica: 2, nombre_metrica: "Research reputation", peso_metrica: 18, es_componente: true, tiene_valores: false },
  { id_metrica: 3, nombre_metrica: "International staff", peso_metrica: 2.5, es_componente: true, tiene_valores: true, sentido: "mayor" },
  { id_metrica: 4, nombre_metrica: "Teaching", peso_metrica: 30, es_componente: false, tiene_valores: false },
];
const cols = columnas(metricas);
comprobar("solo son columna las componentes con valor", cols.map(m => m.id_metrica).join() === "1,3", cols.map(m => m.id_metrica).join());
comprobar("las columnas van de mayor a menor peso", cols[0].peso_metrica >= cols[1].peso_metrica);
const faltan = sinValor(metricas);
comprobar("las componentes sin valor se listan aparte, sin los pilares",
  faltan.length === 1 && faltan[0].nombre_metrica === "Research reputation", JSON.stringify(faltan.map(m => m.nombre_metrica)));

console.log("\n=== 3. Orden ===");
const valores = [
  { id_universidad: 10, nombre_universidad: "Alfa", id_metrica: 1, valor: 30, calidad: "directa" },
  { id_universidad: 10, nombre_universidad: "Alfa", id_metrica: 3, valor: 2, calidad: "directa" },
  { id_universidad: 20, nombre_universidad: "Beta", id_metrica: 1, valor: 18, calidad: "directa" },
  { id_universidad: 20, nombre_universidad: "Beta", id_metrica: 3, valor: 9, calidad: "aproximada" },
  { id_universidad: 30, nombre_universidad: "Gama", id_metrica: 1, valor: 24, calidad: "directa" },
];
const filas = matriz(valores, [30, 10, 20]);
comprobar("cada fila recuerda su posición en el puntaje",
  filas.find(f => f.id_universidad === 30).posicion === 1 && filas.find(f => f.id_universidad === 20).posicion === 3);
const porPos = ordenar(filas, { tipo: "posicion" }, metricas).map(f => f.nombre_universidad).join();
comprobar("por defecto, el orden del puntaje", porPos === "Gama,Alfa,Beta", porPos);
const ssr = ordenar(filas, { id_metrica: 1, direccion: "mejor" }, metricas).map(f => f.nombre_universidad).join();
comprobar("en «menos es mejor», lo mejor es el número más bajo", ssr === "Beta,Gama,Alfa", ssr);
const ssrPeor = ordenar(filas, { id_metrica: 1, direccion: "peor" }, metricas).map(f => f.nombre_universidad).join();
comprobar("y al invertir, el más alto primero", ssrPeor === "Alfa,Gama,Beta", ssrPeor);
const intl = ordenar(filas, { id_metrica: 3, direccion: "mejor" }, metricas).map(f => f.nombre_universidad).join();
comprobar("en «más es mejor», el más alto primero, y sin valor al final", intl === "Beta,Alfa,Gama", intl);
const intlPeor = ordenar(filas, { id_metrica: 3, direccion: "peor" }, metricas).map(f => f.nombre_universidad).join();
comprobar("sin valor sigue al final aunque se invierta el orden", intlPeor.endsWith("Gama"), intlPeor);

console.log("\n=== 4. Lo que se le dice al usuario ===");
comprobar("cada calidad tiene marca y explicación",
  ["directa", "aproximada", "parcial"].every(k => CALIDADES[k].texto && typeof CALIDADES[k].marca === "string"));
comprobar("lo directo no lleva marca; lo aproximado y lo parcial, sí",
  CALIDADES.directa.marca === "" && CALIDADES.aproximada.marca && CALIDADES.parcial.marca);
const detalle = detalleCelda({ valor: 9, unidad: "%", calidad: "aproximada", formula: "a / b", fuentes: "OpenAlex", anios_origen: "publicaciones 2020-2024" }, "medido");
comprobar("el detalle de una celda dice valor, calidad, fórmula, fuentes y años",
  /9 %/.test(detalle) && /otro universo/.test(detalle) && /Fórmula/.test(detalle) && /OpenAlex/.test(detalle) && /2020-2024/.test(detalle), detalle);
comprobar("en un ranking de valores de la fuente, la celda lo dice",
  /tal cual por la fuente/.test(detalleCelda({ valor: 5052, calidad: "directa" }, "fuente")));

console.log("\n=== 5. Exportación ===");
const csv = filasCSV(valores, metricas, "medido");
comprobar("una fila por valor, más la cabecera", csv.length === valores.length + 1, csv.length);
comprobar("la cabecera nombra calidad, fórmula, fuentes y años",
  ["Calidad", "Fórmula", "Fuentes", "Datos"].every(c => csv[0].includes(c)));
comprobar("la calidad se exporta en palabras", csv.some(f => f.includes("aproximado")));
comprobar("en una fuente de valores crudos, la calidad dice de dónde viene",
  filasCSV(valores, metricas, "fuente").slice(1).every(f => f[4] === "publicado por la fuente"));

console.log("\n" + "=".repeat(60));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${fallos.join("; ")}` : "  (todo correcto)"));
process.exit(fallos.length ? 1 : 0);
