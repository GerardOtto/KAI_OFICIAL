// Sonda del Ranking KAI en la pantalla de ranking.
//
// Verifica lo que el usuario hace con él: que aparezca como una pestaña más, que
// el plan gratuito lo abra, que el panel de pesos arranque parejo, que mover un
// peso reordene la tabla al instante y que «Pesos parejos» devuelva el orden de
// fábrica. También que los rankings externos no muestren el panel: sus pesos son
// los que publica su editor.
//
// Requiere un backend cuya base tenga las migraciones 008 y 009 y los datos de
// `cargar_ranking_kai.py`, y la aplicación compilada apuntando a él.
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
let id = 0; const p = new Map();
const errores = [];
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

await cdp("Runtime.enable");
await cdp("Page.enable");
await cdp("Console.enable");

// Cuenta del plan gratuito: el Ranking KAI debe abrirse sin pagar.
const { token } = await crearSesion();
await cdp("Page.navigate", { url: APP });
await esperar(1200);
await ev(`localStorage.setItem("kai_token", ${JSON.stringify(token)});`);
await cdp("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1100, deviceScaleFactor: 1, mobile: false });
await cdp("Page.navigate", { url: `${APP}/ranking` });
await esperar(4000);

const pestana = (texto) => `[...document.querySelectorAll('button')].find(b => b.innerText.trim().startsWith(${JSON.stringify(texto)}))`;
const hayPanel = () => ev(`return Boolean(document.getElementById('titulo-pesos'));`);
const orden = () => ev(`
  return [...document.querySelectorAll('main .grid')]
    .map(f => f.querySelector('span.font-body'))
    .filter(Boolean).map(s => s.innerText.trim()).slice(0, 10);
`);

console.log("=== 1. El Ranking KAI es una pestaña más ===");
const kai = await ev(`const b = ${pestana("Ranking KAI")}; return b ? { deshabilitada: b.disabled, texto: b.innerText } : null;`);
comprobar("la pestaña existe", Boolean(kai), JSON.stringify(kai));
comprobar("el plan gratuito puede abrirla", kai && !kai.deshabilitada, JSON.stringify(kai));

console.log("\n=== 2. Un ranking externo no muestra el panel de pesos ===");
// Se abre primero uno externo permitido al plan gratuito.
const externo = await ev(`
  const b = [...document.querySelectorAll('button')]
    .find(b => /Scimago Latam|Shanghai/.test(b.innerText) && !b.disabled);
  if (!b) return null; b.click(); return b.innerText.trim();
`);
await esperar(2500);
comprobar(`«${externo}» no muestra el panel`, externo && !(await hayPanel()), externo);

console.log("\n=== 3. El Ranking KAI arranca con pesos parejos ===");
await ev(`${pestana("Ranking KAI")}.click();`);
await esperar(4500);
comprobar("aparece el panel de pesos", await hayPanel());
const controles = await ev(`
  return [...document.querySelectorAll('input[type=range][id^=peso-]')]
    .map(i => ({ id: i.id, valor: Number(i.value), etiqueta: document.querySelector('label[for=' + i.id + ']')?.innerText }));
`);
comprobar("hay diez controles, uno por métrica", controles.length === 10, controles.length);
comprobar("todos parten en el mismo peso", new Set(controles.map(c => c.valor)).size === 1,
  JSON.stringify(controles.map(c => c.valor)));
const partes = await ev(`
  return [...document.querySelectorAll('#titulo-pesos ~ div span.font-mono, section[aria-labelledby=titulo-pesos] span.font-mono')]
    .map(s => s.innerText.trim()).filter(t => t.endsWith('%'));
`);
comprobar("cada métrica representa el 10 % del total", partes.length === 10 && partes.every(t => t === "10 %"),
  JSON.stringify(partes));
const restablecerDeshabilitado = await ev(`return [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Pesos parejos')?.disabled;`);
comprobar("«Pesos parejos» está inactivo mientras no se cambie nada", restablecerDeshabilitado === true);
const inicial = await orden();
comprobar("la tabla lista universidades", inicial.length >= 10, JSON.stringify(inicial));
const cabecera = await ev(`return [...document.querySelectorAll('span')].find(s => /^Score en/.test(s.textContent))?.textContent;`);
comprobar("la cabecera no dice «tus pesos» antes de tocarlos", cabecera && !/tus pesos/.test(cabecera), cabecera);
await capturar("ranking_kai_parejo");

console.log("\n=== 4. Mover un peso reordena la tabla ===");
// Se lleva «Doctorados otorgados» al máximo y el resto a cero: el orden debe
// quedar encabezado por la universidad con más doctorados por académico.
await ev(`
  const fijar = (input, valor) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(valor));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  for (const i of document.querySelectorAll('input[type=range][id^=peso-]')) {
    const etiqueta = document.querySelector('label[for=' + i.id + ']')?.innerText || '';
    fijar(i, /Doctorados otorgados/.test(etiqueta) ? 30 : 0);
  }
`);
await esperar(800);
const reponderado = await orden();
comprobar("el orden cambió", JSON.stringify(reponderado) !== JSON.stringify(inicial),
  `antes ${inicial.slice(0, 3)} · después ${reponderado.slice(0, 3)}`);
const partesSolo = await ev(`
  return [...document.querySelectorAll('section[aria-labelledby=titulo-pesos] span.font-mono')]
    .map(s => s.innerText.trim()).filter(t => t.endsWith('%'));
`);
comprobar("una sola métrica representa ahora el 100 %",
  partesSolo.filter(t => t === "100 %").length === 1 && partesSolo.filter(t => t === "0 %").length === 9,
  JSON.stringify(partesSolo));
const cabecera2 = await ev(`return [...document.querySelectorAll('span')].find(s => /^Score en/.test(s.textContent))?.textContent;`);
comprobar("la cabecera avisa que el orden usa tus pesos", /tus pesos/.test(cabecera2 || ""), cabecera2);
await capturar("ranking_kai_doctorados");

console.log("\n=== 5. Sin peso en ninguna métrica se avisa, no se inventa un orden ===");
await ev(`
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  for (const i of document.querySelectorAll('input[type=range][id^=peso-]')) {
    setter.call(i, '0'); i.dispatchEvent(new Event('input', { bubbles: true }));
  }
`);
await esperar(500);
const alerta = await ev(`return document.querySelector('section[aria-labelledby=titulo-pesos] [role=alert]')?.innerText || null;`);
comprobar("aparece el aviso de pesos en cero", Boolean(alerta), alerta);

console.log("\n=== 6. «Pesos parejos» devuelve el orden de fábrica ===");
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Pesos parejos').click();`);
await esperar(800);
const restaurado = await orden();
comprobar("el orden vuelve a ser el inicial", JSON.stringify(restaurado) === JSON.stringify(inicial),
  `${restaurado.slice(0, 3)} frente a ${inicial.slice(0, 3)}`);
const valores = await ev(`return [...document.querySelectorAll('input[type=range][id^=peso-]')].map(i => Number(i.value));`);
comprobar("los diez controles vuelven al mismo peso", new Set(valores).size === 1, JSON.stringify(valores));

console.log("\n=== 7. Cambiar de año conserva los pesos del usuario ===");
await ev(`
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const i = document.querySelector('input[type=range][id^=peso-]');
  setter.call(i, '25'); i.dispatchEvent(new Event('input', { bubbles: true }));
`);
await esperar(300);
const anioCambiado = await ev(`
  const s = [...document.querySelectorAll('select')].find(s => [...s.options].every(o => /^20\\d\\d$/.test(o.value)));
  if (!s || s.options.length < 2) return null;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(s, s.options[1].value); s.dispatchEvent(new Event('change', { bubbles: true }));
  return s.options[1].value;
`);
await esperar(800);
const primero = await ev(`return Number(document.querySelector('input[type=range][id^=peso-]')?.value);`);
comprobar(`tras pasar a ${anioCambiado}, el peso modificado sigue en 25`, primero === 25, primero);
const filasAnio = await orden();
comprobar("la tabla del otro año también se dibuja", filasAnio.length >= 10, filasAnio.length);

console.log("\n=== 8. Sin errores en la consola ===");
comprobar("la consola no registró errores", errores.length === 0, errores.slice(0, 3).join(" | "));

console.log("\n" + "=".repeat(60));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${fallos.join("; ")}` : "  (todo correcto)"));
ws.close();
process.exit(fallos.length ? 1 : 0);
