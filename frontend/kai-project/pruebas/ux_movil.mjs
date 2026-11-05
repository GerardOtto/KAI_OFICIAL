// Sonda de disposición y accesibilidad básica, sobre todo en el teléfono (390 px).
//
// Cubre lo que se rompió alguna vez: la tabla del Resumen dejaba el nombre en
// ancho cero, la simulación unitaria dejaba el resultado fuera de la pantalla, la
// comparada aplastaba la matriz contra el ranking simulado y el asistente dejaba
// la conversación en una franja de 70 px. Además: un solo h1 por página, título de
// pestaña por sección, idioma del documento, la página 404 y la matriz comparada
// manejable con el teclado.
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

const telefono = () => cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
const escritorio = () => cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const ir = async (ruta, ms = 4000) => { await cdp("Page.navigate", { url: APP + ruta }); await esperar(ms); };
const desborde = () => ev(`return document.documentElement.scrollWidth - innerWidth;`);

console.log("=== 1. Todas las secciones caben en el teléfono ===");
await telefono();
for (const ruta of ["/ranking", "/tendencias", "/simulacion/comparada", "/simulacion/unitaria", "/simulacion/objetivo", "/metricas", "/asistente"]) {
  await ir(ruta);
  const d = await desborde();
  comprobar(`${ruta}: sin desplazamiento horizontal de la página`, d <= 0, `${d} px de más`);
  const h1 = await ev(`return [...document.querySelectorAll('h1')].map(h => h.textContent.trim());`);
  comprobar(`${ruta}: un solo h1`, h1.length === 1, JSON.stringify(h1));
  const titulo = await ev(`return document.title;`);
  comprobar(`${ruta}: la pestaña dice la sección`, / · KAI$/.test(titulo), titulo);
}
comprobar("el documento se declara en español", (await ev(`return document.documentElement.lang;`)) === "es");

console.log("\n=== 2. Resumen: el nombre de cada institución se lee ===");
await ir("/ranking");
const nombres = await ev(`
  return [...document.querySelectorAll('main span.font-body.font-semibold')]
    .map(s => ({ t: s.textContent.trim(), ancho: Math.round(s.getBoundingClientRect().width) }))
    .filter(s => s.t.startsWith('Universidad') || s.t.startsWith('Pontificia'));`);
comprobar("hay filas con nombre", nombres.length > 5, nombres.length);
comprobar("ningún nombre queda angosto (≥ 100 px)", nombres.every(n => n.ancho >= 100),
  JSON.stringify(nombres.filter(n => n.ancho < 100).slice(0, 3)));
await foto("ux-movil-resumen");

console.log("\n=== 3. Simulación unitaria: el resultado se ve ===");
await ir("/simulacion/unitaria", 5000);
const unitaria = await ev(`
  const barra = document.querySelector('[data-resumen-movil]');
  const panel = [...document.querySelectorAll('p')].find(p => /Resultado simulado/i.test(p.textContent))?.parentElement;
  const r = panel?.getBoundingClientRect();
  const deslizadores = [...document.querySelectorAll('input[type=range]')];
  return { barra: !!barra && getComputedStyle(barra).display !== 'none', barraTexto: barra?.innerText.replace(/\\s+/g, ' '),
           panelDentro: !!r && r.left >= 0 && r.right <= innerWidth + 1,
           conNombre: deslizadores.length > 0 && deslizadores.every(i => i.getAttribute('aria-label')) };`);
comprobar("la barra fija resume posición y puntaje", unitaria.barra && /Posición \d+/.test(unitaria.barraTexto || "")
  && /Puntaje \d/.test(unitaria.barraTexto || ""), unitaria.barraTexto);
comprobar("el panel de resultado cabe en la pantalla", unitaria.panelDentro);
comprobar("cada deslizador tiene nombre accesible", unitaria.conNombre);

console.log("\n=== 4. Simulación comparada: matriz y ranking simulado no se pisan ===");
await ir("/simulacion/comparada", 5000);
const comparada = await ev(`
  const matriz = document.querySelector('[role=region][aria-label^="Matriz de la simulación"]');
  const ranking = [...document.querySelectorAll('p')].find(p => /Ranking simulado/i.test(p.textContent))?.parentElement;
  const m = matriz?.getBoundingClientRect(), r = ranking?.getBoundingClientRect();
  return m && r ? { matrizAncho: Math.round(m.width), debajo: r.top >= m.bottom - 1, rankingDentro: r.right <= innerWidth + 1 } : null;`);
comprobar("la matriz usa el ancho de la pantalla", comparada?.matrizAncho >= 300, JSON.stringify(comparada));
comprobar("el ranking simulado va debajo y cabe", comparada?.debajo && comparada?.rankingDentro, JSON.stringify(comparada));

console.log("\n=== 5. Asistente: el historial es un cajón ===");
await ir("/asistente", 4000);
const cajon = () => ev(`
  const a = document.getElementById('panel-historial');
  const r = a.getBoundingClientRect();
  return { visible: r.right > 10 && r.left > -10, ancho: Math.round(r.width) };`);
const conversacion = await ev(`return Math.round(document.querySelector('main').getBoundingClientRect().width);`);
comprobar("la conversación ocupa el ancho del teléfono", conversacion >= 380, conversacion);
comprobar("el historial empieza cerrado", (await cajon()).visible === false);
const saludo = await ev(`
  const p = [...document.querySelectorAll('main p')].find(p => /^Hola/.test(p.textContent.trim()));
  if (!p) return null;
  p.scrollIntoView({ block: 'center' });
  const r = p.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= innerHeight;`);
comprobar("el saludo inicial se alcanza (no queda recortado arriba)", saludo === true, saludo);
await ev(`[...document.querySelectorAll('main button')].find(b => /Historial/.test(b.textContent)).click(); return 1;`);
await esperar(500);
comprobar("«Historial» lo abre", (await cajon()).visible === true, JSON.stringify(await cajon()));
await foto("ux-movil-historial");
await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await esperar(500);
comprobar("Escape lo cierra", (await cajon()).visible === false);

console.log("\n=== 6. Escritorio: el historial sigue fijo al lado ===");
await escritorio();
await ir("/asistente", 3000);
const fijo = await cajon();
comprobar("en escritorio el panel se ve sin abrirlo", fijo.visible && fijo.ancho >= 300, JSON.stringify(fijo));
comprobar("y no aparece el botón «Historial»",
  await ev(`const b = [...document.querySelectorAll('main button')].find(b => /Historial/.test(b.textContent)); return !b || b.offsetParent === null;`));

console.log("\n=== 7. Matriz comparada con el teclado ===");
await ir("/simulacion/comparada", 5000);
const celda = await ev(`
  const c = document.querySelector('[role=region] [role=button][aria-label]');
  if (!c) return null;
  c.focus();
  return { foco: document.activeElement === c, antes: c.querySelector('span')?.textContent.trim(), etiqueta: c.getAttribute('aria-label') };`);
comprobar("las celdas se enfocan y se nombran", celda?.foco === true && /:/.test(celda?.etiqueta || ""), JSON.stringify(celda));
await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowUp", code: "ArrowUp", windowsVirtualKeyCode: 38 });
await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowUp", code: "ArrowUp", windowsVirtualKeyCode: 38 });
await esperar(400);
const despues = await ev(`return document.activeElement?.querySelector('span')?.textContent.trim();`);
const num = (t) => parseFloat(String(t).replace(/\./g, "").replace(",", "."));
comprobar("flecha arriba sube la cifra en un punto", Math.abs(num(despues) - num(celda?.antes) - 1) < 0.05, `${celda?.antes} → ${despues}`);
await ev(`[...document.querySelectorAll('button')].find(b => /Restablecer/.test(b.textContent))?.click(); return 1;`);

console.log("\n=== 8. Página no encontrada ===");
await ir("/no-existe", 2500);
const p404 = await ev(`return { h1: document.querySelector('main h1')?.textContent, titulo: document.title,
  enlaces: [...document.querySelectorAll('main a')].map(a => a.getAttribute('href')) };`);
comprobar("explica qué pasó", /no existe/i.test(p404.h1 || ""), JSON.stringify(p404));
comprobar("y ofrece salida al Resumen y a la portada", p404.enlaces.includes("/ranking") && p404.enlaces.includes("/"), JSON.stringify(p404.enlaces));
comprobar("la pestaña lo dice", /no encontrada/i.test(p404.titulo), p404.titulo);

console.log("\n=== 9. Una sesión que vence con la página abierta ===");
// Antes los módulos quedaban vacíos, sin aviso, hasta recargar: cada petición
// recibía 401 y los hooks lo tomaban por «sin datos».
await escritorio();
await ir("/ranking", 4000);
await ev(`localStorage.setItem("kai_token", "vencido.invalido.x"); return 1;`);
await ev(`[...document.querySelectorAll('main button')].find(b => !b.disabled && /Shanghai ARWU/.test(b.textContent))?.click(); return 1;`);
await esperar(3000);
const tras401 = await ev(`return { ruta: location.pathname, dialogo: !!document.querySelector('[role=dialog]') };`);
comprobar("un 401 cierra la sesión y vuelve a la portada", tras401.ruta === "/", JSON.stringify(tras401));
comprobar("y pide entrar de nuevo", tras401.dialogo, JSON.stringify(tras401));
await ev(`localStorage.setItem("kai_token", ${JSON.stringify(TESTIGO)}); return 1;`);
const erroresEsperados = errores.length;

console.log("\n=== 10. Sin errores de JavaScript ===");
// Los 401 de la sección 9 son los provocados a propósito.
const relevantes = errores.slice(0, erroresEsperados).filter((t) => !/favicon|DevTools|401/i.test(t))
  .concat(errores.slice(erroresEsperados).filter((t) => !/favicon|DevTools/i.test(t)));
comprobar("la consola no registró errores", relevantes.length === 0, JSON.stringify(relevantes).slice(0, 300));

console.log("\n" + "=".repeat(58));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${JSON.stringify(fallos)}` : "  (todo correcto)"));
ws.close();
process.exit(fallos.length ? 1 : 0);
