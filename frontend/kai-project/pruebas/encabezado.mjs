// Encabezado: sin desborde horizontal en ningún ancho, y navegación disponible
// siempre —el nav ancho por encima de `lg`, el menú compacto por debajo—.
const APP = process.env.KAI_APP_URL || "http://localhost:5199";
const ANCHOS = [360, 420, 700, 768, 800, 850, 900, 950, 1000, 1023, 1024, 1100, 1280, 1600];

const fallos = [];
const comprobar = (nombre, cond, detalle = "") => {
  console.log(`  [${cond ? "OK " : "FALLA"}] ${nombre}` + (!cond && detalle ? ` -> ${detalle}` : ""));
  if (!cond) fallos.push(nombre);
};

const objetivos = await (await fetch("http://localhost:9222/json/list")).json();
const ws = new WebSocket(objetivos.find(t => t.type === "page").webSocketDebuggerUrl);
await new Promise(r => (ws.onopen = r));
let id = 0; const p = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } };
const cdp = (method, params = {}) => { const n = ++id; ws.send(JSON.stringify({ id: n, method, params })); return new Promise(r => p.set(n, r)); };
const ev = async expr => {
  const r = await cdp("Runtime.evaluate", { expression: `(() => { ${expr} })()`, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(String(r.result.exceptionDetails.exception?.description).slice(0, 300));
  return r.result?.result?.value;
};
const esperar = ms => new Promise(r => setTimeout(r, ms));

await cdp("Runtime.enable");
await cdp("Page.enable");
await cdp("Console.enable");
const errores = [];
ws.addEventListener("message", e => {
  const m = JSON.parse(e.data);
  if (m.method === "Console.messageAdded" && m.params.message.level === "error") errores.push(m.params.message.text);
});

console.log("=== 1. Sin desborde horizontal y con navegación en todos los anchos ===");
for (const ancho of ANCHOS) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: ancho, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: `${APP}/tendencias` });
  await esperar(1400);
  const m = await ev(`
    const h = document.querySelector('header');
    const nav = h.querySelector('nav');
    // El menú compacto es el botón rotulado "Menú" del encabezado.
    const compacto = [...h.querySelectorAll('button')].find(b => /^men\\u00fa$/i.test(b.innerText.trim().replace(/[\\u25be\\s]+$/,'')));
    const visible = e => e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
    // Se mide el desborde imputable al encabezado, no el de la página: el
    // contenido de algunas vistas desborda por su cuenta en anchos estrechos, y
    // mezclarlo aquí haría que esta prueba fallara por un motivo ajeno.
    const desbordeHeader = h.scrollWidth - window.innerWidth;
    return {
      desbordeHeader,
      desbordePagina: document.documentElement.scrollWidth - window.innerWidth,
      navVisible: visible(nav),
      compactoVisible: visible(compacto),
    };
  `);
  const navegable = m.navVisible || m.compactoVisible;
  comprobar(`${ancho}px sin desborde del encabezado`, m.desbordeHeader <= 0, `+${m.desbordeHeader}px`);
  if (m.desbordePagina > 0) {
    console.log(`         (nota: el contenido de la página desborda +${m.desbordePagina}px en este ancho; ajeno al encabezado)`);
  }
  comprobar(`${ancho}px con navegación`, navegable,
    `nav=${m.navVisible} compacto=${m.compactoVisible}`);
  comprobar(`${ancho}px no duplica la navegación`, !(m.navVisible && m.compactoVisible),
    "el nav ancho y el compacto se muestran a la vez");
}

console.log("\n=== 2. El menú compacto navega de verdad ===");
await cdp("Emulation.setDeviceMetricsOverride", { width: 820, height: 900, deviceScaleFactor: 1, mobile: false });
await cdp("Page.navigate", { url: `${APP}/tendencias` });
await esperar(1500);

await ev(`
  const h = document.querySelector('header');
  const b = [...h.querySelectorAll('button')].find(x => /^men\\u00fa/i.test(x.innerText.trim()));
  b.click();
  return true;
`);
// React repinta de forma asíncrona: consultar en el mismo turno que el clic
// devuelve el árbol anterior. Además, innerText de un elemento con display:none
// devuelve igualmente su texto, así que hay que filtrar por visibilidad real.
await esperar(400);
const opciones = await ev(`
  const visible = e => e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none';
  return [...document.querySelectorAll('header button')]
    .filter(visible).map(x => x.innerText.trim())
    .filter(t => t && !/^men\\u00fa/i.test(t) && !/iniciar sesi/i.test(t));
`);
console.log("    opciones:", JSON.stringify(opciones));
comprobar("el menú abre con los seis destinos", opciones.length >= 6, String(opciones.length));
comprobar("incluye las dos simulaciones y los dos censos",
  opciones.some(o => /Simulaci/i.test(o)) && opciones.some(o => /Investigadores/i.test(o)),
  JSON.stringify(opciones));

const destino = await ev(`
  const b = [...document.querySelectorAll('header button')].find(x => /Glosario/i.test(x.innerText));
  if (!b) return 'no se encontró la opción Glosario';
  b.click();
  return null;
`);
await esperar(1200);
const ruta = await ev(`return location.pathname;`);
comprobar("al elegir una opción navega a su ruta", ruta === "/metricas", `${destino || ""} ruta=${ruta}`);

const cerrado = await ev(`
  const h = document.querySelector('header');
  return [...h.querySelectorAll('button')].filter(x => /Glosario|Resumen/i.test(x.innerText)).length === 0;
`);
comprobar("el menú se cierra tras navegar", cerrado, "las opciones siguen visibles");

console.log("\n=== 3. Sin errores de consola ===");
const relevantes = errores.filter(t => !/favicon|DevTools|Failed to load resource/i.test(t));
comprobar("la consola no registró errores", relevantes.length === 0, JSON.stringify(relevantes).slice(0, 300));

console.log("\n" + "=".repeat(60));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${JSON.stringify(fallos)}` : "  (todo correcto)"));
ws.close();
process.exit(fallos.length ? 1 : 0);
