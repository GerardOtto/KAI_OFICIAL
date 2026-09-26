// Sonda de la simulación sobre cifras medidas: la aritmética del percentil.
//
// Lógica pura, sin navegador ni servidor:
//   node pruebas/simulacion_cifras.mjs
import {
  prepararCifras, percentil, evaluar, posiciones, pasoPara, topePara,
} from "../src/utils/simulacionCifras.js";

const fallos = [];
const comprobar = (nombre, cond, detalle = "") => {
  console.log(`  [${cond ? "OK " : "FALLA"}] ${nombre}` + (!cond && detalle ? ` -> ${detalle}` : ""));
  if (!cond) fallos.push(nombre);
};
const cerca = (a, b) => Math.abs(a - b) < 1e-9;

console.log("=== 1. Percentil: la misma fórmula del backend ===");
comprobar("la mejor de cinco supera a las otras cuatro: 100", percentil(50, [10, 20, 30, 40]) === 100);
comprobar("la peor no supera a nadie: 0", percentil(10, [20, 30, 40, 50]) === 0);
comprobar("la del medio supera a dos de cuatro: 50", percentil(30, [10, 20, 40, 50]) === 50);
comprobar("los empates no cuentan como superadas", percentil(30, [30, 30, 10]) === 100 / 3 * 1);
comprobar("en «menos es mejor», el valor más bajo es el mejor", percentil(10, [20, 30], "menor") === 100);
comprobar("sola en la población, recibe 100", percentil(7, []) === 100);

console.log("\n=== 2. Evaluar una población ===");
const filas = [
  // universidad, métrica, cifra
  ...[["A", 18], ["B", 25], ["C", 30]].flatMap(([u, v], i) => [
    { id_universidad: i + 1, nombre_universidad: u, id_metrica: 1, nombre_metrica: "Estudiantes por académico",
      peso_metrica: "50", pondera: true, sentido: "menor", unidad: "estudiantes", valor_metrica: v },
  ]),
  ...[["A", 40], ["B", 60], ["C", 50]].map(([u, v], i) => (
    { id_universidad: i + 1, nombre_universidad: u, id_metrica: 2, nombre_metrica: "Doctorados",
      peso_metrica: "50", pondera: true, sentido: "mayor", unidad: "%", valor_metrica: v })),
];
const { metricas, universidades } = prepararCifras(filas);
comprobar("se reconocen dos métricas y tres universidades", metricas.length === 2 && universidades.length === 3);
comprobar("el sentido se conserva", metricas.find(m => m.id_metrica === 1).sentido === "menor");
const base = evaluar(universidades, metricas);
// A: 18 estudiantes (mejor) -> 100; doctorados 40 (peor) -> 0; total 50.
// B: 25 -> 50; 60 -> 100; total 75.   C: 30 -> 0; 50 -> 50; total 25.
comprobar("A queda en 50", cerca(base.get(1).total, 50), base.get(1).total);
comprobar("B queda en 75", cerca(base.get(2).total, 75), base.get(2).total);
comprobar("C queda en 25", cerca(base.get(3).total, 25), base.get(3).total);
const pos = posiciones(base, universidades);
comprobar("el orden es B, A, C", pos.get(2) === 1 && pos.get(1) === 2 && pos.get(3) === 3);

console.log("\n=== 3. Simular mueve también a las demás ===");
// C sube sus doctorados a 70: pasa a ser la mejor en esa métrica.
const sim = evaluar(universidades, metricas, { 3: { 2: 70 } });
comprobar("C gana: doctorados pasa de 50 a 100", cerca(sim.get(3).puntajes[2], 100));
comprobar("B pierde puntos sin haber cambiado nada", sim.get(2).total < base.get(2).total,
  `${base.get(2).total} -> ${sim.get(2).total}`);
comprobar("A no cambia: seguía siendo la peor en doctorados", cerca(sim.get(1).total, base.get(1).total));
comprobar("un override de otra universidad no altera la cifra original guardada",
  universidades.find(u => u.id_universidad === 3).valores[2] === 50);

console.log("\n=== 4. Controles ===");
comprobar("el paso es 1, 2 o 5 por una potencia de diez", [pasoPara(100), pasoPara(16e6), pasoPara(0.8)]
  .every(p => /^[125]$/.test(String(p / 10 ** Math.floor(Math.log10(p))).slice(0, 1))), [pasoPara(100), pasoPara(16e6), pasoPara(0.8)].join(" "));
comprobar("sin máximo, el paso es 1", pasoPara(0) === 1);
const tope = topePara(metricas[0], universidades, 0);
comprobar("el tope deja holgura sobre la mayor cifra observada", tope >= 30 * 1.25 - 1e-9, tope);
comprobar("el tope nunca queda bajo la cifra actual", topePara(metricas[0], universidades, 500) >= 500);

console.log("\n" + "=".repeat(60));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${fallos.join("; ")}` : "  (todo correcto)"));
process.exit(fallos.length ? 1 : 0);
