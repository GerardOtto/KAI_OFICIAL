// Sonda del switch global de valores: Puntajes / Valores, en el header.
//
// Comprueba que el switch aparezca solo en los cuatro módulos donde tiene efecto,
// que su estado se conserve al navegar y al recargar, y que Tendencias,
// Simulación y Glosario respondan a él. Resumen lo cubre `modo_numerico.mjs`.
// Si se pasa en KAI_TOKEN_PAGO un testigo de un plan de pago, revisa además que
// la simulación en THE explique por qué no se puede simular en cifras.
import fs from "fs";
import { crearSesion } from "./sesion.mjs";
const APP = process.env.KAI_APP_URL || "http://localhost:5199";
const CDP = process.env.KAI_CDP_URL || "http://localhost:9222";
const SALIDA = new URL("./capturas/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
fs.mkdirSync(SALIDA, { recursive: true });

const fallos = [];
const comprobar = (nombre, cond, detalle = "") => {
  console.log(`  [${cond ? "OK " : "FALLA"}] ${nombre}` + (!cond && detalle ? ` -> ${detalle}` : ""));
  if (!cond) fallos.push(nombre);
};

const objetivos = await (await fetch(`${CDP}/json/list`)).json();
const ws = new WebSocket(objetivos.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const p = new Map(); const errores = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); }
  if (m.method === "Console.messageAdded" && m.params.message.level === "error") errores.push(m.params.message.text);
};
const cdp = (method, params = {}) => { const n = ++id; ws.send(JSON.stringify({ id: n, method, params })); return new Promise((r) => p.set(n, r)); };
const ev = async (expr) => {
  const r = await cdp("Runtime.evaluate", { expression: `(() => { ${expr} })()`, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(String(r.result.exceptionDetails.exception?.description).slice(0, 300));
  return r.result?.result?.value;
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const capturar = async (nombre) => {
  const { result } = await cdp("Page.captureScreenshot", { format: "png" });
  if (result?.data) fs.writeFileSync(`${SALIDA}${nombre}.png`, Buffer.from(result.data, "base64"));
};
const ir = async (ruta, ms = 3500) => { await cdp("Page.navigate", { url: `${APP}${ruta}` }); await esperar(ms); };
const switchHeader = (texto) => `[...document.querySelectorAll('header button')].find(b => b.textContent.trim() === ${JSON.stringify(texto)})`;
const hayswitch = () => ev(`return Boolean(${switchHeader("Valores")});`);
const activo = () => ev(`return [...document.querySelectorAll('header [role=group] button')].find(b => b.getAttribute('aria-pressed') === 'true')?.textContent.trim() ?? null;`);
const elegirRanking = (nombre) => ev(`
  const s = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.text.startsWith(${JSON.stringify(nombre)})));
  if (!s) return false;
  const o = [...s.options].find(o => o.text.startsWith(${JSON.stringify(nombre)}));
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return true;
`);
const avisoTipo = () => ev(`return [...document.querySelectorAll('[role=note]')].map(n => n.textContent).join(' | ');`);

async function entrar(token) {
  await cdp("Page.navigate", { url: APP });
  await esperar(1200);
  await ev(`localStorage.setItem("kai_token", ${JSON.stringify(token)}); localStorage.removeItem("kai_modo_valores");`);
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1100, deviceScaleFactor: 1, mobile: false });
}

await cdp("Runtime.enable"); await cdp("Page.enable"); await cdp("Console.enable");
const { token } = await crearSesion();
await entrar(token);

console.log("=== 1. Dónde aparece el switch ===");
for (const ruta of ["/ranking", "/tendencias", "/simulacion/unitaria", "/metricas"]) {
  await ir(ruta, 2500);
  comprobar(`aparece en ${ruta}`, await hayswitch());
}
await ir("/asistente", 2500);
comprobar("no aparece en el asistente", !(await hayswitch()));

console.log("\n=== 2. Es un estado único y se recuerda ===");
await ir("/ranking", 2500);
comprobar("arranca en Puntajes", (await activo()) === "Puntajes", await activo());
await ev(`${switchHeader("Valores")}.click();`);
await esperar(400);
await ir("/tendencias", 2500);
comprobar("al navegar a otro módulo sigue en Valores", (await activo()) === "Valores", await activo());
await ir("/tendencias", 2500);
comprobar("tras recargar la página sigue en Valores", (await activo()) === "Valores", await activo());

console.log("\n=== 3. Tendencias ===");
await elegirRanking("Ranking KAI");
await esperar(3500);
const subtitulo = await ev(`return [...document.querySelectorAll('main h2 + p')].map(p => p.textContent).join(' | ');`);
comprobar("el subtítulo dice que es una cifra medida y su unidad", /Cifra medida · /.test(subtitulo), subtitulo);
// Los rótulos del gráfico no son texto SVG: se comparan las cifras que el usuario
// lee, todos los números con decimales de la vista.
const grafico = `(document.querySelector('main')?.textContent.match(/\\d+,\\d{2}/g) || []).join(' ')`;
const serieValores = await ev(`return ${grafico};`);
await capturar("switch_tendencias_valores");
await ev(`${switchHeader("Puntajes")}.click();`);
await esperar(3000);
const subtituloP = await ev(`return [...document.querySelectorAll('main h2 + p')].map(p => p.textContent).join(' | ');`);
comprobar("en Puntajes vuelve la serie histórica", /Serie histórica/.test(subtituloP), subtituloP);
const seriePuntajes = await ev(`return ${grafico};`);
comprobar("el gráfico cambia entre un modo y otro", serieValores && seriePuntajes && serieValores !== seriePuntajes);
await elegirRanking("Shanghai GRAS");
await ev(`${switchHeader("Valores")}.click();`);
await esperar(3000);
comprobar("en un ranking sin cifras, Tendencias lo avisa", /solo publica puntajes/.test(await avisoTipo()), await avisoTipo());

console.log("\n=== 4. Simulación en cifras (Ranking KAI) ===");
await ir("/simulacion/unitaria", 3000);
await elegirRanking("Ranking KAI");
await esperar(2500);
await ev(`[...document.querySelectorAll('button')].find(b => /Seleccionar/.test(b.textContent))?.click();`);
await esperar(500);
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Pontificia Universidad Catolica de Valparaiso')?.click();`);
await esperar(3500);
const controles = await ev(`return document.querySelectorAll('input[type=range][id^=cifra-]').length;`);
comprobar("aparecen los diez controles sobre la cifra real", controles === 10, controles);
const antes = await ev(`return [...document.querySelectorAll('span')].find(s => /^\\d+,\\d$|^\\d+\\.\\d$/.test(s.textContent.trim()) && s.className.includes('text-[26px]'))?.textContent;`);
await ev(`
  const i = [...document.querySelectorAll('input[type=range][id^=cifra-]')]
    .find(x => /Doctorados otorgados/.test(document.querySelector('label[for=' + x.id + ']')?.textContent || ''));
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(i, i.max); i.dispatchEvent(new Event('input', { bubbles: true }));
`);
await esperar(600);
const despues = await ev(`return [...document.querySelectorAll('span')].find(s => s.className.includes('text-[26px]'))?.textContent;`);
comprobar("mover una cifra cambia el puntaje", antes && despues && antes !== despues, `${antes} -> ${despues}`);
// La posición puede no cambiar si la mejora no alcanza para superar a nadie; lo
// que siempre cambia es el efecto de esa métrica sobre el puntaje.
const efecto = await ev(`return [...document.querySelectorAll('.text-positive')].some(e => /^\\+\\d/.test(e.textContent.trim()));`);
comprobar("el efecto de la métrica movida aparece como puntos ganados", efecto);
await capturar("switch_simulacion_cifras");

await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Comparada'))?.click();`);
await esperar(2000);
// En la comparada hay que elegir instituciones; si no, la vista pide hacerlo.
await ev(`[...document.querySelectorAll('button')].find(b => /Seleccionar/.test(b.textContent))?.click();`);
await esperar(500);
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Pontificia Universidad Catolica de Valparaiso')?.click();`);
await esperar(2500);
comprobar("la simulación comparada también opera en cifras",
  /Cifras medidas\. Haz clic en una celda/.test(await ev(`return document.body.textContent;`)));

console.log("\n=== 5. Glosario ===");
await ir("/metricas", 4000);
const descripcion = await ev(`return document.querySelector('main')?.textContent || '';`);
comprobar("la descripción dice que el número es la cifra medida", /Número = cifra medida/.test(descripcion));
await ev(`${switchHeader("Puntajes")}.click();`);
await esperar(1500);
comprobar("en Puntajes dice que es el puntaje", /Número = puntaje/.test(await ev(`return document.querySelector('main')?.textContent || '';`)));

if (process.env.KAI_TOKEN_PAGO) {
  console.log("\n=== 6. THE: no se puede simular en cifras, y se dice ===");
  await entrar(process.env.KAI_TOKEN_PAGO);
  await ir("/simulacion/unitaria", 2500);
  await ev(`${switchHeader("Valores")}.click();`);
  await elegirRanking("THE Latam");
  await esperar(2500);
  comprobar("aparece el aviso de que THE no se puede recalcular desde la cifra",
    /no se puede recalcular desde la cifra medida/.test(await avisoTipo()), await avisoTipo());
  comprobar("no aparecen controles sobre cifras", (await ev(`return document.querySelectorAll('input[type=range][id^=cifra-]').length;`)) === 0);
}

console.log("\n=== Sin errores en la consola ===");
comprobar("la consola no registró errores", errores.length === 0, errores.slice(0, 3).join(" | "));

console.log("\n" + "=".repeat(60));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${fallos.join("; ")}` : "  (todo correcto)"));
ws.close();
process.exit(fallos.length ? 1 : 0);
