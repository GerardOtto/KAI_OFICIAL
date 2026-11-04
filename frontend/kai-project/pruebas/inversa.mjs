// Sonda de la lógica de análisis: simulación inversa, desglose del cambio entre
// ediciones e intervalo de predicción. Es lógica pura: importa los módulos sin
// navegador ni servidor.
//
//   node pruebas/inversa.mjs
import {
  MARGEN, brechaPorMetrica, clasificar, meta, pasar, planCifras, planConcentrado, planParejo,
  prepararPuntajes, puestoCon, unaSolaMetrica, unaSolaMetricaCifras,
} from "../src/utils/simulacionInversa.js";
import { evaluar } from "../src/utils/simulacionCifras.js";
import { desglose } from "../src/utils/desgloseCambio.js";
import { intervaloPrediccion, linearRegression } from "../src/utils/regression.js";

const fallos = [];
const comprobar = (nombre, cond, detalle = "") => {
  console.log(`  [${cond ? "OK " : "FALLA"}] ${nombre}` + (!cond && detalle ? ` -> ${detalle}` : ""));
  if (!cond) fallos.push(nombre);
};
const cerca = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

// Tres universidades, dos métricas (60 % y 40 %).
const filas = [];
for (const [id, nombre, a, b] of [[1, "Propia", 50, 50], [2, "Rival", 70, 40], [3, "Líder", 90, 90]]) {
  filas.push({ id_universidad: id, nombre_universidad: nombre, id_metrica: 10, nombre_metrica: "A", peso_metrica: "60", factor: 0.6, valor_metrica: a });
  filas.push({ id_universidad: id, nombre_universidad: nombre, id_metrica: 11, nombre_metrica: "B", peso_metrica: "40", factor: 0.4, valor_metrica: b });
}
const { metricas, universidades } = prepararPuntajes(filas);
const cl = clasificar(universidades);

console.log("=== 1. Simulación inversa sobre puntajes ===");
comprobar("ordena por total", cl.map(u => u.nombre).join() === "Líder,Rival,Propia");
const m = meta(cl, 1, { tipo: "superar", id: 2 });
comprobar("la brecha es la diferencia más el margen", cerca(m.brecha, 58 - 50 + MARGEN), m.brecha);
const origen = brechaPorMetrica(m.propia, m.referencia, metricas);
comprobar("el origen de la brecha suma la diferencia de totales",
  cerca(origen.reduce((s, o) => s + o.aporte, 0), 8), origen.map(o => o.aporte));
const una = unaSolaMetrica(m.propia, metricas, m.brecha);
for (const u of una) {
  const nuevo = m.propia.total + u.cambio * u.factor;
  comprobar(`con solo ${u.nombre_metrica} (${u.de} → ${u.a.toFixed(2)}) supera a la rival`, nuevo > m.referencia.total);
}
const concentrado = planConcentrado(m.propia, metricas, m.brecha);
comprobar("el plan concentrado empieza por la métrica de más peso", concentrado.pasos[0].id_metrica === 10);
comprobar("y cubre la brecha justa", cerca(concentrado.pasos.reduce((s, p) => s + p.aporte, 0), m.brecha));
const parejo = planParejo(m.propia, metricas, m.brecha);
comprobar("el plan parejo cierra la misma fracción en cada métrica",
  cerca(parejo.pasos[0].cambio / (100 - 50), parejo.pasos[1].cambio / (100 - 50)));
comprobar("y deja a la propia en el puesto 2",
  puestoCon(cl, 1, m.propia.total + parejo.pasos.reduce((s, p) => s + p.aporte, 0)) === 2);
const parejos = metricas.map(x => ({ ...x, factor: 0.5 }));
const propiaDispareja = { ...m.propia, valores: { 10: 95, 11: 40 } };
comprobar("a igual peso, el plan concentrado empieza por la métrica con más margen",
  planConcentrado(propiaDispareja, parejos, 5).pasos[0].id_metrica === 11);
const imposible = meta(cl, 1, { tipo: "superar", id: 3 });
const sinTecho = planConcentrado(imposible.propia, metricas.map(x => ({ ...x, techo: 60 })), imposible.brecha);
comprobar("si ni con todo al techo alcanza, lo dice", !sinTecho.alcanzable && sinTecho.falta > 0);
comprobar("un puesto ya alcanzado no pide nada", meta(cl, 2, { tipo: "puesto", puesto: 3 }).cumplido);

console.log("\n=== 2. Simulación inversa sobre cifras (percentiles) ===");
const cifras = {
  metricas: [
    { id_metrica: 1, nombre_metrica: "Doctorados", peso_metrica: 50, pondera: true, sentido: "mayor" },
    { id_metrica: 2, nombre_metrica: "Estudiantes por académico", peso_metrica: 50, pondera: true, sentido: "menor" },
  ],
  universidades: [
    { id_universidad: 1, nombre: "P", valores: { 1: 10, 2: 30.5 } },
    { id_universidad: 2, nombre: "Q", valores: { 1: 20, 2: 20.25 } },
    { id_universidad: 3, nombre: "R", valores: { 1: 30, 2: 25.1 } },
    { id_universidad: 4, nombre: "S", valores: { 1: 40, 2: 10.4 } },
    { id_universidad: 5, nombre: "T", valores: { 1: 50, 2: 15.7 } },
  ],
};
const objetivo = { tipo: "superar", id: 3 };
for (const u of unaSolaMetricaCifras(cifras.universidades, cifras.metricas, 1, objetivo).filter(x => x.alcanzable)) {
  const r = evaluar(cifras.universidades, cifras.metricas, { 1: { [u.id_metrica]: u.a } });
  comprobar(`con solo ${u.nombre_metrica} (${u.de} → ${u.a}) supera a R, recalculando a todas`,
    r.get(1).total > r.get(3).total);
}
const plan = planCifras(cifras.universidades, cifras.metricas, 1, objetivo);
const r = evaluar(cifras.universidades, cifras.metricas, { 1: Object.fromEntries(plan.pasos.map(p => [p.id_metrica, p.a])) });
comprobar("el plan combinado cumple el objetivo", plan.alcanzable && r.get(1).total > r.get(3).total);
comprobar("los conteos se proponen en enteros", pasar(20, "mayor", true) === 21 && pasar(20, "menor", true) === 19);
comprobar("las cifras con decimales, en la centésima siguiente", pasar(25.1, "menor") === 25.09 && pasar(55.123, "mayor") === 55.13);

console.log("\n=== 3. Desglose del cambio entre ediciones ===");
const fila = (metrica, valor, peso, factor, total) => ({
  nombre_metrica: metrica, valor_metrica: valor, peso_metrica: peso, factor, puntaje_total: total,
});
const d = desglose(
  [fila("Teaching", 40, 35, 0.35, 30), fila("Research", 30, 33.5, 0.335, 30), fila("Vieja", 10, 10, 0.1, 30)],
  [fila("Teaching", 44, 35, 0.35, 31.2), fila("Research", 28, 33.5, 0.335, 31.2), fila("Nueva", 5, 10, 0.1, 31.2)],
);
comprobar("la suma de los aportes es la variación del total", cerca(d.metricas.reduce((s, x) => s + x.delta, 0), d.delta));
comprobar("cada métrica aporta su cambio por su peso", cerca(d.metricas.find(x => x.nombre === "Teaching").delta, 4 * 0.35));
comprobar("una métrica que aparece se marca como nueva",
  d.metricas.find(x => x.nombre === "Nueva")?.estado === "nueva"
  && d.metricas.find(x => x.nombre === "Vieja")?.estado === "retirada");
comprobar("y el total registrado viaja aparte", d.registradoAntes === 30 && d.registradoDespues === 31.2);

console.log("\n=== 4. Intervalo de predicción ===");
const puntos = [[2019, 60], [2020, 62.5], [2021, 61], [2022, 64], [2023, 65.5], [2024, 66]].map(([x, y]) => ({ x, y }));
const reg = linearRegression(puntos);
const cerca1 = intervaloPrediccion(puntos, reg.slope, reg.intercept, 2025);
const lejos = intervaloPrediccion(puntos, reg.slope, reg.intercept, 2028);
comprobar("rodea a la proyección", cerca1.bajo < reg.slope * 2025 + reg.intercept && cerca1.alto > reg.slope * 2025 + reg.intercept);
comprobar("se abre con la distancia", lejos.margen > cerca1.margen);
const recta = [1, 2, 3, 4].map(x => ({ x, y: 2 * x }));
const rr = linearRegression(recta);
comprobar("una serie exactamente lineal no tiene margen",
  cerca(intervaloPrediccion(recta, rr.slope, rr.intercept, 6).margen, 0, 1e-9));
comprobar("con dos puntos no se calcula", intervaloPrediccion(puntos.slice(0, 2), reg.slope, reg.intercept, 2025) === null);

console.log("\n" + "=".repeat(58));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${JSON.stringify(fallos)}` : "  (todo correcto)"));
process.exit(fallos.length ? 1 : 0);
