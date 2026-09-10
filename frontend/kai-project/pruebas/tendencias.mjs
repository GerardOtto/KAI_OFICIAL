// Comprueba que Tendencias abre en Evolución y que las pestañas quedaron
// intercambiadas, sin que cambie nada más del comportamiento.
import fs from "fs";
const APP = process.env.KAI_APP_URL || "http://localhost:5199";
// Las capturas van junto a la sonda, no a una carpeta temporal de una
// maquina concreta. Se crea si no existe.
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

await cdp("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
await cdp("Page.navigate", { url: `${APP}/tendencias` });
await esperar(5000);

/** Pestañas de vista, en el orden en que se dibujan, y cuál está activa. */
const pestanas = () => ev(`
  const botones = [...document.querySelectorAll('button')]
    .filter(b => /Comparación anual|Evolución/.test(b.innerText));
  return botones.map(b => ({
    texto: b.innerText.replace(/\\n/g, ' · ').trim(),
    // La activa se distingue por fondo claro o borde; se compara el estilo.
    fondo: getComputedStyle(b).backgroundColor,
    color: getComputedStyle(b).color,
  }));
`);

console.log("=== 1. Orden de las pestañas ===");
const tabs = await pestanas();
comprobar("hay dos pestañas de vista", tabs.length === 2, JSON.stringify(tabs));
comprobar("Evolución va primera", /Evolución/.test(tabs[0]?.texto || ""), tabs[0]?.texto);
comprobar("Comparación anual va segunda", /Comparación anual/.test(tabs[1]?.texto || ""), tabs[1]?.texto);
comprobar("conservan su subtítulo",
  /líneas/.test(tabs[0]?.texto || "") && /barras/.test(tabs[1]?.texto || ""),
  JSON.stringify(tabs.map(t => t.texto)));

console.log("\n=== 2. La vista activa al entrar es Evolución ===");
// El gráfico de evolución traza las series con <polyline> y marca los puntos con
// <circle>; el de barras usa <rect>. (Con <path> no se dibuja ninguno de los dos:
// el único path de la página pertenece a un icono.)
const medir = () => ev(`
  const t = document.body.innerText;
  const svg = document.querySelector('main svg');
  return {
    lineas: svg ? svg.querySelectorAll('polyline').length : 0,
    puntos: svg ? svg.querySelectorAll('circle').length : 0,
    // Las barras no son SVG: son div con altura animada (clase origin-bottom).
    barras: [...document.querySelectorAll('main .origin-bottom')]
      .filter(e => e.getBoundingClientRect().height > 2).length,
    diceComparacion: /Comparación \\d{4}/.test(t),
    proyeccion: /Proyección/i.test(t),
  };
`);
const estado = await medir();
comprobar("se dibuja el gráfico de líneas con sus series",
  estado.lineas > 0 && estado.puntos > 0, JSON.stringify(estado));
comprobar("no se dibujan barras", estado.barras === 0, JSON.stringify(estado));
comprobar("no se muestra el encabezado de comparación anual", !estado.diceComparacion, JSON.stringify(estado));
comprobar("aparecen los controles propios de Evolución (proyección)", estado.proyeccion, JSON.stringify(estado));

const activa = tabs.map(t => t.fondo);
comprobar("la pestaña activa es la primera",
  activa[0] !== activa[1], JSON.stringify(activa));

await cdp("Page.captureScreenshot", { format: "png" }).then(r =>
  fs.writeFileSync(`${SALIDA}/tendencias-evolucion.png`, Buffer.from(r.result.data, "base64")));

console.log("\n=== 3. Cambiar a Comparación anual sigue funcionando ===");
await ev(`
  const b = [...document.querySelectorAll('button')].find(x => /Comparación anual/.test(x.innerText));
  b.click(); return true;
`);
await esperar(3500);
const tras = await medir();
comprobar("cambia a barras", tras.barras > 0, JSON.stringify(tras));
comprobar("dejan de dibujarse las líneas", tras.lineas === 0, JSON.stringify(tras));
comprobar("muestra el encabezado de comparación", tras.diceComparacion, JSON.stringify(tras));

console.log("\n=== 4. Y volver a Evolución también ===");
await ev(`
  const b = [...document.querySelectorAll('button')].find(x => /Evolución/.test(x.innerText));
  b.click(); return true;
`);
await esperar(3500);
const vuelta = await medir();
comprobar("vuelve a dibujar líneas", vuelta.lineas > 0 && vuelta.barras === 0, JSON.stringify(vuelta));

console.log("\n=== 5. Sin errores de JavaScript ===");
const relevantes = errores.filter((t) => !/favicon|DevTools/i.test(t));
comprobar("la consola no registró errores", relevantes.length === 0, JSON.stringify(relevantes).slice(0, 300));

console.log("\n" + "=".repeat(58));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${JSON.stringify(fallos)}` : "  (todo correcto)"));
ws.close();
process.exit(fallos.length ? 1 : 0);
