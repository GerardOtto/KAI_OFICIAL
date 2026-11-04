// Sonda del análisis: simulación inversa (puntajes y cifras), el paso del plan a
// la simulación unitaria, el desglose del cambio en Tendencias, los grupos
// guardados y el lugar en cada ranking del Glosario.
//
// Usa el Ranking KAI, que el plan gratuito de la cuenta de la sonda abre, y la
// PUCV como institución: no es la primera, así que tiene a quién superar.
import fs from "fs";
import { crearSesion } from "./sesion.mjs";
const APP = process.env.KAI_APP_URL || "http://localhost:5199";
const SALIDA = new URL("./capturas/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
fs.mkdirSync(SALIDA, { recursive: true });

const fallos = [];
const comprobar = (nombre, cond, detalle = "") => {
  console.log(`  [${cond ? "OK " : "FALLA"}] ${nombre}` + (!cond && detalle ? ` -> ${detalle}` : ""));
  if (!cond) fallos.push(nombre);
};

const objetivos = await (await fetch("http://localhost:9222/json/list")).json();
const ws = new WebSocket(objetivos.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const p = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } };
const cdp = (method, params = {}) => { const n = ++id; ws.send(JSON.stringify({ id: n, method, params })); return new Promise((r) => p.set(n, r)); };
const ev = async (expr) => {
  const r = await cdp("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(String(r.result.exceptionDetails.exception?.description).slice(0, 300));
  return r.result?.result?.value;
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const foto = async (n) => fs.writeFileSync(`${SALIDA}/${n}.png`,
  Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).result.data, "base64"));

await cdp("Runtime.enable");
await cdp("Page.enable");
await cdp("Console.enable");
const errores = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Console.messageAdded" && m.params.message.level === "error") errores.push(m.params.message.text);
});

const { token: TESTIGO } = await crearSesion({ institucion: "Pontificia Universidad Catolica de Valparaiso" });
await cdp("Page.navigate", { url: APP });
await esperar(1200);
await ev(`localStorage.setItem("kai_token", ${JSON.stringify(TESTIGO)}); localStorage.removeItem("kai_modo_valores");`);
await cdp("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });

const elegirRanking = (nombre) => ev(`
  const sel = [...document.querySelectorAll('main select')].find(s => [...s.options].some(o => o.text === ${JSON.stringify(nombre)}));
  if (!sel) return false;
  const valor = [...sel.options].find(o => o.text === ${JSON.stringify(nombre)}).value;
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, valor);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
`);
const numero = (t) => (t == null ? null : parseFloat(String(t).replace(/\./g, "").replace(",", ".")));

console.log("=== 1. Simulación inversa sobre puntajes ===");
await cdp("Page.navigate", { url: `${APP}/simulacion/objetivo` });
await esperar(4000);
comprobar("se elige el Ranking KAI", await elegirRanking("Ranking KAI"));
await esperar(3500);
const objetivo = await ev(`
  const main = document.querySelector('main');
  const tab = [...document.querySelectorAll('button')].find(b => /Objetivo/.test(b.innerText));
  const plan = document.querySelector('[data-plan="concentrado"]');
  return {
    pestanaActiva: tab ? getComputedStyle(tab).backgroundColor : null,
    brecha: document.querySelector('[data-brecha]')?.innerText || null,
    origen: document.querySelectorAll('[data-seccion="origen"] .grid').length,
    una: document.querySelectorAll('[data-seccion="una-metrica"] .grid').length,
    plan: plan?.innerText || null,
    parejo: document.querySelector('[data-plan="parejo"]')?.innerText || null,
    hoy: [...main.querySelectorAll('p')].find(x => /^Hoy /.test(x.innerText))?.innerText || null,
  };
`);
console.log("  " + JSON.stringify({ ...objetivo, plan: objetivo.plan?.slice(0, 90), parejo: objetivo.parejo?.slice(0, 60) }));
comprobar("dice cuánto falta", /^\d+,\d/.test(objetivo.brecha || ""), objetivo.brecha);
comprobar("explica de dónde viene la brecha, métrica por métrica", objetivo.origen >= 10, objetivo.origen);
comprobar("dice cuánto tendría que subir cada métrica por sí sola", objetivo.una >= 10, objetivo.una);
const puestos = (objetivo.plan || "").match(/puesto (\d+) → (\d+)/);
comprobar("el plan concentrado sube de puesto", puestos && Number(puestos[2]) < Number(puestos[1]), objetivo.plan);
comprobar("hay un plan parejo", /Plan parejo/.test(objetivo.parejo || ""));
await foto("analisis-objetivo");

console.log("\n=== 2. El plan se prueba en la simulación unitaria ===");
await ev(`[...document.querySelectorAll('[data-plan="concentrado"] button')].find(b => /Probar/.test(b.innerText)).click(); return 1;`);
await esperar(3500);
const unitaria = await ev(`
  const etiqueta = [...document.querySelectorAll('main p')].find(p => p.innerText.trim() === 'Posición');
  return {
    ruta: location.pathname,
    posicion: etiqueta?.nextElementSibling?.innerText.replace(/\\s+/g, ' ').trim(),
    modificadas: document.querySelectorAll('main .text-accent').length,
  };
`);
console.log("  " + JSON.stringify(unitaria));
comprobar("se abre la simulación unitaria", unitaria.ruta === "/simulacion/unitaria", unitaria.ruta);
comprobar("con las métricas del plan ya movidas", unitaria.modificadas > 0, unitaria.modificadas);
comprobar("y en el puesto que prometía el plan", puestos && unitaria.posicion?.startsWith(puestos[2]), unitaria.posicion);

console.log("\n=== 3. Simulación inversa sobre cifras medidas ===");
await ev(`localStorage.setItem("kai_modo_valores", "numerico"); return 1;`);
await cdp("Page.navigate", { url: `${APP}/simulacion/objetivo` });
await esperar(4000);
await elegirRanking("Ranking KAI");
await esperar(4500);
const cifras = await ev(`
  const plan = document.querySelector('[data-plan="cifras"]');
  return { plan: plan?.innerText || null, filas: document.querySelectorAll('[data-seccion="una-metrica"] > div').length };
`);
console.log("  " + JSON.stringify({ ...cifras, plan: cifras.plan?.slice(0, 120) }));
const pc = (cifras.plan || "").match(/puesto (\d+) → (\d+)/);
comprobar("propone un plan en cifras reales que sube de puesto", pc && Number(pc[2]) < Number(pc[1]), cifras.plan);
comprobar("y la cifra mínima de cada métrica por separado", cifras.filas >= 10, cifras.filas);
await foto("analisis-objetivo-cifras");
await ev(`localStorage.removeItem("kai_modo_valores"); return 1;`);

console.log("\n=== 4. Tendencias: por qué cambió el total ===");
await cdp("Page.navigate", { url: `${APP}/tendencias` });
await esperar(4500);
await elegirRanking("Ranking KAI");
await esperar(4500);
const desglose = await ev(`
  const s = document.querySelector('[data-seccion="desglose-cambio"]');
  return { hay: !!s, resumen: s?.querySelector('[data-resumen-cambio]')?.innerText || null,
           filas: s ? s.querySelectorAll('.grid').length : 0 };
`);
console.log("  " + JSON.stringify(desglose));
comprobar("aparece el panel del cambio", desglose.hay);
comprobar("con el total de las dos ediciones", /pasa de [\d,]+ a [\d,]+/.test(desglose.resumen || ""), desglose.resumen);
comprobar("y el aporte de cada una de las diez métricas", desglose.filas === 10, desglose.filas);

console.log("\n=== 5. Grupos guardados ===");
const nombreGrupo = `Sonda ${Math.random().toString(36).slice(2, 6)}`;
await ev(`document.querySelector('[data-grupos] button').click(); return 1;`);
await esperar(600);
await ev(`
  const input = document.querySelector('[data-grupos] input');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(nombreGrupo)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return 1;`);
await esperar(200);
await ev(`document.querySelector('[data-grupos] form button[type=submit]').click(); return 1;`);
await esperar(1200);
const guardado = await ev(`return document.querySelector('[data-grupos]').innerText;`);
comprobar("se guarda la selección con un nombre", guardado.includes(`Guardado «${nombreGrupo}»`), guardado.slice(0, 200));
const antes = await ev(`return [...document.querySelectorAll('[title="Quitar"]')].length;`);
await ev(`[...document.querySelectorAll('button')].find(b => /^limpiar \\(/i.test(b.innerText)).click(); return 1;`);
await esperar(500);
await ev(`
  if (!document.querySelector('[data-grupos] form')) document.querySelector('[data-grupos] button').click();
  return 1;`);
await esperar(500);
await ev(`[...document.querySelectorAll('[data-grupos] button')].find(b => b.innerText.startsWith(${JSON.stringify(nombreGrupo)})).click(); return 1;`);
await esperar(1200);
const despues = await ev(`return [...document.querySelectorAll('[title="Quitar"]')].length;`);
comprobar("elegirlo devuelve la misma selección", antes > 0 && despues === antes, `${antes} → ${despues}`);
// Limpieza: se borra el grupo de la sonda.
await ev(`
  document.querySelector('[data-grupos] button').click();
  await new Promise(r => setTimeout(r, 400));
  document.querySelector('[aria-label="Borrar el grupo ${nombreGrupo}"]')?.click();
  return 1;`);
await esperar(800);

console.log("\n=== 6. Glosario: su lugar en cada ranking ===");
await cdp("Page.navigate", { url: `${APP}/metricas` });
await esperar(5000);
const lugar = await ev(`
  const s = document.querySelector('[data-seccion="entre-rankings"]');
  const celdas = s ? [...s.querySelectorAll('[data-celda-posicion]')].map(c => c.innerText.replace(/\\s+/g, ' ')) : [];
  return { hay: !!s, celdas: celdas.length, muestra: celdas.slice(0, 3), texto: s?.innerText.slice(0, 200) || '' };
`);
console.log("  " + JSON.stringify(lugar));
comprobar("aparece la sección", lugar.hay);
comprobar("con el puesto entre las chilenas en varias ediciones", lugar.celdas >= 5 && /^\d+\/\d+/.test(lugar.muestra[0] || ""), lugar.muestra);
comprobar("el plan gratuito no ve THE ni QS en ella", !/THE Latam|QS Latam|QS Global/.test(lugar.texto), lugar.texto);
await ev(`document.querySelector('[data-seccion="entre-rankings"]').scrollIntoView(); return 1;`);
await esperar(400);
await foto("analisis-entre-rankings");

console.log("\n=== 7. Sin errores de JavaScript ===");
const relevantes = errores.filter((t) => !/favicon|DevTools/i.test(t));
comprobar("la consola no registró errores", relevantes.length === 0, JSON.stringify(relevantes).slice(0, 300));

console.log("\n" + "=".repeat(58));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${JSON.stringify(fallos)}` : "  (todo correcto)"));
ws.close();
process.exit(fallos.length ? 1 : 0);
