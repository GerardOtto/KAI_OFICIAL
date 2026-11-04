// Sonda de la actualización de los rankings: el aviso de una edición publicada que
// aún no está cargada, el puesto oficial en el Resumen y THE World en el catálogo.
//
// La cuenta de la sonda es del plan gratuito: Scimago, ARWU y el Ranking KAI se
// abren; THE y QS aparecen reservados.
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
await ev(`localStorage.setItem("kai_token", ${JSON.stringify(TESTIGO)}); localStorage.removeItem("kai_modo_valores"); return 1;`);
await cdp("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });

// En el Ranking los rankings son pestañas: botones con el nombre del ranking.
const pestana = (nombre) => `[...document.querySelectorAll('main button')].find(b => b.innerText.trim().startsWith(${JSON.stringify(nombre)}))`;
const elegirRanking = (nombre) => ev(`
  const b = ${pestana(nombre)};
  if (!b || b.disabled) return false;
  b.click();
  return true;
`);
const aviso = () => ev(`return document.querySelector('[data-aviso-edicion]')?.innerText || null;`);

console.log("=== 1. Aviso de edición publicada y no cargada ===");
await cdp("Page.navigate", { url: `${APP}/ranking` });
await esperar(4000);
comprobar("se elige Scimago Latam", await elegirRanking("Scimago Latam"));
await esperar(3000);
const enScimago = await aviso();
console.log("  " + enScimago);
comprobar("en Scimago avisa que la 2026 se publicó sin cifras", /Scimago Latam 2026/.test(enScimago || "")
  && /sin las cifras/.test(enScimago || ""), enScimago);
await foto("actualizacion-aviso");
comprobar("se elige Shanghai ARWU", await elegirRanking("Shanghai ARWU"));
await esperar(3000);
comprobar("en un ranking al día no hay aviso", (await aviso()) === null, await aviso());

console.log("\n=== 2. Puesto oficial en el Resumen ===");
const oficiales = await ev(`return [...document.querySelectorAll('[data-posicion-oficial]')].map(e => e.innerText.trim());`);
console.log("  " + JSON.stringify(oficiales));
comprobar("cada institución de ARWU lleva su puesto oficial", oficiales.length >= 2 && oficiales.every(o => /^oficial \d/i.test(o)),
  JSON.stringify(oficiales));
comprobar("tal como lo publica ARWU (rango)", oficiales.some(o => /\d+-\d+/.test(o)), JSON.stringify(oficiales));
await foto("actualizacion-oficial");

console.log("\n=== 3. THE World en el catálogo ===");
const opciones = await ev(`
  const b = ${pestana("THE World")};
  return b ? { texto: b.innerText.trim(), deshabilitada: b.disabled } : null;`);
comprobar("aparece entre los rankings", opciones !== null, JSON.stringify(opciones));
comprobar("y, para el plan gratuito, reservado", opciones?.deshabilitada === true && /plan de pago/i.test(opciones?.texto || ""), JSON.stringify(opciones));

console.log("\n=== 4. Sin errores de JavaScript ===");
const relevantes = errores.filter((t) => !/favicon|DevTools/i.test(t));
comprobar("la consola no registró errores", relevantes.length === 0, JSON.stringify(relevantes).slice(0, 300));

console.log("\n" + "=".repeat(58));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${JSON.stringify(fallos)}` : "  (todo correcto)"));
ws.close();
process.exit(fallos.length ? 1 : 0);
