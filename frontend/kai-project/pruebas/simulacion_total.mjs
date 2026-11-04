// Sonda de Simulación: el puntaje total se ve en los dos modos, con el nombre que
// tiene en el resto del sitio, y junto al total que registra el ranking.
//
// Se usa el Ranking KAI, que el plan gratuito de la cuenta de la sonda abre: su
// total registrado es, por definición, la suma de sus métricas, así que al abrir
// —sin tocar nada— el simulado y el registrado deben coincidir.
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
  const r = await cdp("Runtime.evaluate", { expression: `(() => { ${expr} })()`, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(String(r.result.exceptionDetails.exception?.description).slice(0, 300));
  return r.result?.result?.value;
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

await cdp("Runtime.enable");
await cdp("Page.enable");
await cdp("Console.enable");
const errores = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Console.messageAdded" && m.params.message.level === "error") errores.push(m.params.message.text);
});

const { token: TESTIGO } = await crearSesion();
await cdp("Page.navigate", { url: APP });
await esperar(1200);
await ev(`localStorage.setItem("kai_token", ${JSON.stringify(TESTIGO)}); localStorage.removeItem("kai_modo_valores");`);
await cdp("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });

/** Elige el Ranking KAI en el selector de ranking de la página. */
const elegirKai = () => ev(`
  const sel = [...document.querySelectorAll('main select')]
    .find(s => [...s.options].some(o => o.text === 'Ranking KAI'));
  if (!sel) return false;
  const valor = [...sel.options].find(o => o.text === 'Ranking KAI').value;
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  set.call(sel, valor);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
`);
const numero = (t) => (t == null ? null : parseFloat(String(t).replace(/\./g, "").replace(",", ".")));

console.log("=== 1. Unitaria ===");
await cdp("Page.navigate", { url: `${APP}/simulacion/unitaria` });
await esperar(4000);
comprobar("se puede elegir el Ranking KAI", await elegirKai());
await esperar(3500);
const unitaria = await ev(`
  const t = document.querySelector('main').innerText;
  const reg = document.querySelector('[data-total-registrado]');
  const etiqueta = [...document.querySelectorAll('main p')].find(p => p.innerText.trim() === 'Puntaje total');
  const grande = etiqueta?.nextElementSibling?.querySelector('span')?.innerText;
  return { dicePuntaje: Boolean(etiqueta), diceScore: /\\bScore\\b/.test(t), grande,
           registrado: reg?.innerText || null, sliders: document.querySelectorAll('main input[type=range]').length };
`);
console.log("  " + JSON.stringify(unitaria));
comprobar("el resultado se llama «Puntaje total», no «Score»", unitaria.dicePuntaje && !unitaria.diceScore,
  JSON.stringify(unitaria));
comprobar("muestra el puntaje total registrado en el ranking",
  /Puntaje total registrado en Ranking KAI: [\d.,]+/.test(unitaria.registrado || ""), unitaria.registrado);
const registrado = numero((unitaria.registrado || "").match(/: ([\d.,]+)/)?.[1]);
comprobar("sin tocar nada, el simulado coincide con el registrado (±0,05)",
  registrado != null && Math.abs(numero(unitaria.grande) - registrado) <= 0.05, `${unitaria.grande} vs ${registrado}`);
comprobar("el total no aparece como un deslizador más (diez métricas)", unitaria.sliders === 10, unitaria.sliders);
await cdp("Page.captureScreenshot", { format: "png" }).then(r =>
  fs.writeFileSync(`${SALIDA}/simulacion-total-unitaria.png`, Buffer.from(r.result.data, "base64")));

console.log("\n=== 2. Comparada ===");
await cdp("Page.navigate", { url: `${APP}/simulacion/comparada` });
await esperar(4000);
await elegirKai();
await esperar(3500);
const comparada = await ev(`
  // innerText devuelve el texto en mayúsculas cuando el CSS lo pone así.
  const cab = [...document.querySelectorAll('main div')]
    .find(d => d.children.length === 0 && d.innerText.trim().toLowerCase() === 'puntaje total');
  const regs = [...document.querySelectorAll('[data-total-registrado]')].map(e => e.innerText.trim());
  return { cabecera: Boolean(cab), regs, diceScore: /\\bScore\\b/.test(document.querySelector('main').innerText) };
`);
console.log("  " + JSON.stringify(comparada));
comprobar("la columna se llama «Puntaje total»", comparada.cabecera && !comparada.diceScore, JSON.stringify(comparada));
comprobar("cada institución muestra su total registrado",
  comparada.regs.length > 0 && comparada.regs.every(r => /^reg\. [\d.,]+$/.test(r)), JSON.stringify(comparada.regs));
await cdp("Page.captureScreenshot", { format: "png" }).then(r =>
  fs.writeFileSync(`${SALIDA}/simulacion-total-comparada.png`, Buffer.from(r.result.data, "base64")));

console.log("\n=== 3. Sin errores de JavaScript ===");
const relevantes = errores.filter((t) => !/favicon|DevTools/i.test(t));
comprobar("la consola no registró errores", relevantes.length === 0, JSON.stringify(relevantes).slice(0, 300));

console.log("\n" + "=".repeat(58));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${JSON.stringify(fallos)}` : "  (todo correcto)"));
ws.close();
process.exit(fallos.length ? 1 : 0);
