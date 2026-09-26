// Sonda del reponderado del Ranking KAI en el cliente.
//
// Es lógica pura —no necesita navegador ni servidor—, así que importa el módulo
// directamente. Verifica lo que haría incoherente la tabla si fallara: que con
// los pesos de fábrica el orden coincida con el del servidor, que el total siga
// en 0-100 cuando los pesos ya no suman 100, que una métrica en cero desaparezca
// del cálculo, y que la variación de puestos compare con la edición anterior.
//
//   node pruebas/ponderado.mjs
import {
  metricasDe, pesosIniciales, pesosModificados, sumaPesos, participacion,
  clasificar, historico, variacion,
} from "../src/utils/rankingPonderado.js";

const fallos = [];
const comprobar = (nombre, cond, detalle = "") => {
  console.log(`  [${cond ? "OK " : "FALLA"}] ${nombre}` + (!cond && detalle ? ` -> ${detalle}` : ""));
  if (!cond) fallos.push(nombre);
};
const cerca = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

// Tres universidades, dos métricas de peso 10 cada una: el caso mínimo en que
// cambiar los pesos invierte el orden.
const fila = (id, nombre, metrica, valor, peso = 10) => ({
  id_universidad: id, nombre_universidad: nombre, pais_universidad: "Chile",
  id_metrica: metrica, nombre_metrica: `M${metrica}`, peso_metrica: String(peso), valor_metrica: valor,
});
const anio2024 = [
  fila(1, "Alfa", 1, 100), fila(1, "Alfa", 2, 0),
  fila(2, "Beta", 1, 0), fila(2, "Beta", 2, 90),
  fila(3, "Gama", 1, 50), fila(3, "Gama", 2, 50),
];
const anio2025 = [
  fila(1, "Alfa", 1, 100), fila(1, "Alfa", 2, 0),
  fila(2, "Beta", 1, 10), fila(2, "Beta", 2, 100),
  fila(3, "Gama", 1, 40), fila(3, "Gama", 2, 40),
];

console.log("=== 1. Métricas y pesos por defecto ===");
const metricas = metricasDe(anio2024);
comprobar("se reconocen las dos métricas", metricas.length === 2, JSON.stringify(metricas));
comprobar("el peso llega como número aunque la base lo mande como texto",
  metricas.every(m => m.peso_metrica === 10));
const iniciales = pesosIniciales(metricas);
comprobar("los pesos iniciales son los de la base", iniciales[1] === 10 && iniciales[2] === 10);
comprobar("sin tocar nada, los pesos no figuran como modificados", !pesosModificados(iniciales, metricas));
comprobar("al mover uno, sí", pesosModificados({ ...iniciales, 2: 20 }, metricas));

console.log("\n=== 2. El total, con los pesos de fábrica, coincide con el del servidor ===");
// El servidor calcula Σ valor·peso/100; con pesos que suman 100 es lo mismo que
// el promedio ponderado. Aquí suman 20, así que se compara contra el promedio.
const base = clasificar(anio2024, iniciales);
comprobar("con pesos parejos Beta queda última (45 frente a 50 y 50)",
  base[2].nombre_universidad === "Beta",
  base.map(u => `${u.nombre_universidad}=${u.score_total}`).join(" "));
comprobar("el total es el promedio de los percentiles",
  cerca(base.find(u => u.nombre_universidad === "Beta").score_total, 45));
comprobar("los empates se desempatan por nombre, de forma estable",
  base[0].nombre_universidad === "Alfa" && base[1].nombre_universidad === "Gama",
  base.map(u => u.nombre_universidad).join(" "));

console.log("\n=== 3. Cambiar los pesos cambia el orden ===");
const soloM2 = clasificar(anio2024, { 1: 0, 2: 10 });
comprobar("con todo el peso en la métrica 2, Beta pasa a primera",
  soloM2[0].nombre_universidad === "Beta", soloM2.map(u => u.nombre_universidad).join(" "));
comprobar("una métrica en cero no aporta nada", cerca(soloM2[0].score_total, 90));
const triple = clasificar(anio2024, { 1: 30, 2: 10 });
comprobar("el total sigue en 0-100 aunque los pesos sumen 40",
  triple.every(u => u.score_total >= 0 && u.score_total <= 100));
comprobar("y vale el promedio ponderado: Alfa = (100·30 + 0·10) / 40 = 75",
  cerca(triple.find(u => u.nombre_universidad === "Alfa").score_total, 75));
const nada = clasificar(anio2024, { 1: 0, 2: 0 });
comprobar("con todos los pesos en cero no se divide por cero", nada.every(u => u.score_total === 0));

console.log("\n=== 4. La parte de cada peso ===");
const partes = participacion({ 1: 30, 2: 10 });
comprobar("30 y 10 son el 75 % y el 25 %", cerca(partes[1], 75) && cerca(partes[2], 25));
comprobar("la suma de los pesos se calcula bien", sumaPesos({ 1: 30, 2: 10 }) === 40);
comprobar("sin pesos, las partes son cero y no NaN",
  Object.values(participacion({ 1: 0, 2: 0 })).every(v => v === 0));

console.log("\n=== 5. Historia y variación con los mismos pesos ===");
const hist = historico({ 2024: anio2024, 2025: anio2025 }, { 1: 0, 2: 10 });
comprobar("cada universidad tiene su serie de dos años",
  Object.values(hist).every(h => h.historico.length === 2));
comprobar("la serie va ordenada por año", hist[2].historico[0].anio === 2024);
// Con peso solo en la métrica 2, Beta es primera en ambos años.
comprobar("Beta no se mueve: variación 0", variacion(hist[2], 2025, 2024) === 0);
// Gama: 2024 segunda (50), 2025 segunda (40) frente a Alfa (0).
comprobar("Gama tampoco", variacion(hist[3], 2025, 2024) === 0);
comprobar("sin edición anterior no hay variación", variacion(hist[2], 2024, null) === null);
comprobar("si la universidad no estaba en la edición anterior, tampoco",
  variacion({ historico: [{ anio: 2025, posicion: 1 }] }, 2025, 2024) === null);
const histParejo = historico({ 2024: anio2024, 2025: anio2025 }, iniciales);
// Pesos parejos: 2024 Alfa=50 Gama=50 Beta=45; 2025 Beta=55 Alfa=50 Gama=40.
comprobar("con pesos parejos Beta sube dos puestos de 2024 a 2025",
  variacion(histParejo[2], 2025, 2024) === 2,
  JSON.stringify(histParejo[2]?.historico));

console.log("\n" + "=".repeat(60));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${fallos.join("; ")}` : "  (todo correcto)"));
process.exit(fallos.length ? 1 : 0);
