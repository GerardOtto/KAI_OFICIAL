// Sonda CDP del Glosario: exclusión de QS por Disciplina, cifras de Shanghai
// GRAS ya proporcionadas, y el globo flotante de las celdas.
import fs from "fs";
const APP = process.env.KAI_APP_URL || "http://localhost:5199";
// Las capturas van junto a la sonda, no a una carpeta temporal de una
// maquina concreta. Se crea si no existe.
const SALIDA = new URL("./capturas/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
fs.mkdirSync(SALIDA, { recursive: true });

// Calculado aparte en SQL sobre la misma base.
const ESPERADO_GRAS = { Articulos: 53.2, Reputacion: 15.0, Academicos: 13.3, Investigacion: 12.1, Internacionalizacion: 6.4 };

const fallos = [];
function comprobar(nombre, cond, detalle = "") {
  console.log(`  [${cond ? "OK " : "FALLA"}] ${nombre}` + (!cond && detalle ? ` -> ${detalle}` : ""));
  if (!cond) fallos.push(nombre);
}

const objetivos = await (await fetch("http://localhost:9222/json/list")).json();
const ws = new WebSocket(objetivos.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const p = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } };
const cdp = (method, params = {}) => { const n = ++id; ws.send(JSON.stringify({ id: n, method, params })); return new Promise((r) => p.set(n, r)); };
async function ev(expr) {
  const r = await cdp("Runtime.evaluate", { expression: `(() => { ${expr} })()`, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(String(r.result.exceptionDetails.exception?.description).slice(0, 300));
  return r.result?.result?.value;
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

await cdp("Runtime.enable");
await cdp("Page.enable");
await cdp("Console.enable");
const errores = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Console.messageAdded" && m.params.message.level === "error") errores.push(m.params.message.text);
});

await cdp("Emulation.setDeviceMetricsOverride", { width: 1600, height: 950, deviceScaleFactor: 1, mobile: false });
await cdp("Page.navigate", { url: `${APP}/metricas` });
await esperar(4000);

console.log("=== 1. QS por Disciplina queda fuera ===");
const columnas = await ev(`
  const cab = document.querySelectorAll('.grid.gap-1\\\\.5.mb-1\\\\.5 > div');
  return [...cab].map(e => e.innerText.trim()).filter(Boolean);
`);
comprobar("hay columnas de rankings", columnas.length > 0, JSON.stringify(columnas));
comprobar("«QS por Disciplina» no aparece como columna",
  !columnas.some(c => /QS POR DISCIPLINA/i.test(c)), JSON.stringify(columnas));
comprobar("los demás rankings siguen",
  ["THE Latam", "QS Latam", "Scimago Latam", "Shanghai GRAS", "QS Global", "Shanghai ARWU"]
    .every(n => columnas.some(c => c.toUpperCase() === n.toUpperCase())), JSON.stringify(columnas));
comprobar("quedan seis columnas", columnas.length === 6, columnas.length);

console.log("\n=== 2. Shanghai GRAS: cifras proporcionadas ===");
const gras = await ev(`
  const cab = [...document.querySelectorAll('.grid.gap-1\\\\.5.mb-1\\\\.5 > div')].map(e => e.innerText.trim());
  const col = cab.findIndex(t => /SHANGHAI GRAS/i.test(t));   // 0 es la celda vacía
  const filas = [...document.querySelectorAll('.space-y-1\\\\.5 > .grid')];
  return filas.map(f => {
    const hijos = [...f.children];
    const dim = hijos[0].innerText.trim();
    const celda = hijos[col];
    return { dim, texto: celda ? celda.innerText.trim().replace(/\\n/g, ' | ') : null };
  });
`);
console.log(JSON.stringify(gras, null, 1));

let suma = 0;
for (const { dim, texto } of gras) {
  if (!texto || /no mide/.test(texto)) continue;
  const m = texto.match(/([\d.,]+)\s*%/);
  if (!m) { comprobar(`${dim}: se pudo leer el porcentaje`, false, texto); continue; }
  const pct = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  suma += pct;
  const esperado = ESPERADO_GRAS[dim];
  if (esperado != null) {
    comprobar(`${dim}: ${pct} % coincide con el cálculo en SQL (${esperado} %)`,
      Math.abs(pct - esperado) <= 0.15, `${pct} vs ${esperado}`);
  }
  comprobar(`${dim}: el porcentaje es proporcionado (≤ 100)`, pct <= 100, pct);
  comprobar(`${dim}: lleva la marca de promedio`, /prom/i.test(texto), texto);
}
comprobar(`las dimensiones de GRAS suman 100 % (dan ${suma.toFixed(1)})`,
  Math.abs(suma - 100) <= 0.5, suma.toFixed(2));

console.log("\n=== 3. Un ranking de una sola disciplina no lleva la marca ===");
const qs = await ev(`
  const cab = [...document.querySelectorAll('.grid.gap-1\\\\.5.mb-1\\\\.5 > div')].map(e => e.innerText.trim());
  const col = cab.findIndex(t => /^QS LATAM$/i.test(t));
  const filas = [...document.querySelectorAll('.space-y-1\\\\.5 > .grid')];
  return filas.map(f => ({ dim: f.children[0].innerText.trim(),
                           texto: f.children[col]?.innerText.trim().replace(/\\n/g, ' | ') })).filter(x => x.texto);
`);
comprobar("QS Latam no muestra la marca de promedio en ninguna celda",
  qs.every(c => !/prom/i.test(c.texto)), JSON.stringify(qs.filter(c => /prom/i.test(c.texto))));
const sumaQs = qs.reduce((s, c) => {
  const m = c.texto.match(/([\d.,]+)\s*%/);
  return s + (m ? parseFloat(m[1].replace(/\./g, "").replace(",", ".")) : 0);
}, 0);
comprobar(`QS Latam conserva sus pesos originales (suman ${sumaQs.toFixed(0)} %)`,
  Math.abs(sumaQs - 100) <= 1, sumaQs.toFixed(1));

console.log("\n=== 4. El globo flotante ===");
const antes = await ev(`return document.querySelectorAll('[role=tooltip]').length;`);
comprobar("sin cursor encima no hay globo", antes === 0, antes);

// Se pasa el cursor por la celda de Articulos × Shanghai GRAS.
const rect = await ev(`
  const cab = [...document.querySelectorAll('.grid.gap-1\\\\.5.mb-1\\\\.5 > div')].map(e => e.innerText.trim());
  const col = cab.findIndex(t => /SHANGHAI GRAS/i.test(t));
  const fila = [...document.querySelectorAll('.space-y-1\\\\.5 > .grid')]
    .find(f => f.children[0].innerText.trim() === 'Articulos');
  const c = fila.children[col];
  const r = c.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
`);
await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y });
await esperar(500);

const globo = await ev(`
  const g = document.querySelector('[role=tooltip]');
  if (!g) return null;
  const r = g.getBoundingClientRect();
  return { texto: g.innerText, dentroX: r.left >= 0 && r.right <= window.innerWidth,
           dentroY: r.top >= 0 && r.bottom <= window.innerHeight,
           ancho: Math.round(r.width), sinPuntero: getComputedStyle(g).pointerEvents };
`);
comprobar("aparece el globo al pasar el cursor", globo !== null);
if (globo) {
  console.log("  --- contenido ---\n" + globo.texto.split("\n").map(l => "    " + l).join("\n"));
  comprobar("nombra la dimensión y el ranking",
    /Articulos/.test(globo.texto) && /Shanghai GRAS/i.test(globo.texto), globo.texto.slice(0, 80));
  comprobar("explica que el peso es promedio entre disciplinas",
    /promedio sobre 57 disciplinas/i.test(globo.texto), globo.texto.slice(0, 200));
  comprobar("agrupa las métricas por nombre en pocas líneas",
    globo.texto.split("\n").length <= 16, globo.texto.split("\n").length);
  // Los pesos del desglose también tienen que ser cuotas, no sumas crudas: si
  // aquí reaparecen miles por ciento, el problema solo se habrá movido de sitio.
  const pesosGlobo = [...globo.texto.matchAll(/([\d.,]+)\s*%/g)]
    .map(m => parseFloat(m[1].replace(/\./g, "").replace(",", ".")));
  comprobar("ningún peso del desglose se dispara",
    pesosGlobo.every(v => v <= 100), JSON.stringify(pesosGlobo));
  // El primero es el de la dimensión; los siguientes, los de sus métricas.
  const [dimension, ...porMetrica] = pesosGlobo;
  const sumaMetricas = porMetrica.reduce((s, v) => s + v, 0);
  comprobar(`los pesos de las métricas suman el de la dimensión (${sumaMetricas.toFixed(1)} vs ${dimension})`,
    Math.abs(sumaMetricas - dimension) <= 0.6, `${sumaMetricas} vs ${dimension}`);
  comprobar("cabe dentro de la ventana", globo.dentroX && globo.dentroY, JSON.stringify(globo));
  comprobar("no intercepta el cursor", globo.sinPuntero === "none", globo.sinPuntero);
}

console.log("\n=== 5. El globo no lo recorta el scroll horizontal ===");
// Se estrecha la ventana para forzar el desplazamiento horizontal, y se busca en
// la última columna una celda CON datos: una que diga «no mide» no tiene globo
// por diseño, y probar con ella daría un falso fallo.
// 820 px: la matriz declara min-w-[900px], así que por debajo de ~965 px el
// contenedor desborda de verdad y hay algo que desplazar.
await cdp("Emulation.setDeviceMetricsOverride", { width: 820, height: 950, deviceScaleFactor: 1, mobile: false });
await esperar(600);
const ultimaCol = await ev(`
  const cont = document.querySelector('.overflow-x-auto');
  cont.scrollLeft = cont.scrollWidth;
  const filas = [...document.querySelectorAll('.space-y-1\\\\.5 > .grid')];
  for (const f of filas) {
    const c = f.children[f.children.length - 1];
    if (!c || /no mide/.test(c.innerText)) continue;
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
             dim: f.children[0].innerText.trim(), desplazado: cont.scrollLeft > 0 };
  }
  return null;
`);
comprobar("se encontró una celda con datos en la última columna", ultimaCol !== null, JSON.stringify(ultimaCol));
comprobar("la tabla quedó desplazada horizontalmente", ultimaCol?.desplazado === true, JSON.stringify(ultimaCol));
await esperar(300);
await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: ultimaCol.x, y: ultimaCol.y });
await esperar(500);
const globo2 = await ev(`
  const g = document.querySelector('[role=tooltip]');
  if (!g) return null;
  const r = g.getBoundingClientRect();
  return { dentro: r.left >= 0 && r.right <= window.innerWidth + 1, right: Math.round(r.right), vw: window.innerWidth };
`);
comprobar("en la última columna el globo sigue visible y dentro de la ventana",
  globo2 !== null && globo2.dentro, JSON.stringify(globo2));

const r2 = await cdp("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(`${SALIDA}/glosario.png`, Buffer.from(r2.result.data, "base64"));

console.log("\n=== 6. Se retira al salir ===");
await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5 });
await esperar(400);
comprobar("al salir de la celda desaparece",
  (await ev(`return document.querySelectorAll('[role=tooltip]').length;`)) === 0);

console.log("\n=== 7. Sin errores de JavaScript ===");
const relevantes = errores.filter((t) => !/favicon|DevTools/i.test(t));
comprobar("la consola no registró errores", relevantes.length === 0, JSON.stringify(relevantes).slice(0, 400));

console.log("\n" + "=".repeat(64));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${JSON.stringify(fallos)}` : "  (todo correcto)"));
ws.close();
process.exit(fallos.length ? 1 : 0);
