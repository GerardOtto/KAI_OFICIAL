// Sonda CDP: comprueba el renderizado de Markdown de las respuestas del
// asistente en un navegador real, con una respuesta fija que incluye lo que
// suele romperse.
const APP = process.env.KAI_APP_URL || "http://localhost:5199";
// El backend es un servicio distinto del que sirve la aplicacion. Estas dos
// sondas necesitan uno con el proveedor de lenguaje sustituido por un doble,
// para ejercitar la interfaz del asistente sin gastar creditos.
const API = process.env.KAI_API_URL || "http://localhost:8010";

const fallos = [];
function comprobar(nombre, cond, detalle = "") {
  console.log(`  [${cond ? "OK " : "FALLA"}] ${nombre}` + (!cond && detalle ? ` -> ${detalle}` : ""));
  if (!cond) fallos.push(nombre);
}

const correo = `sonda_md_${Date.now()}@ejemplo.test`;
const alta = await (await fetch(`${API}/auth/registro`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ nombre: "Sonda MD", correo, clave: "clave-de-sonda-123" }),
})).json();
if (!alta.token) { console.error("No se pudo registrar:", alta); process.exit(1); }

const objetivos = await (await fetch("http://localhost:9222/json/list")).json();
const pagina = objetivos.find((t) => t.type === "page");
const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pendientes = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
};
function cdp(method, params = {}) {
  const n = ++id;
  ws.send(JSON.stringify({ id: n, method, params }));
  return new Promise((r) => pendientes.set(n, r));
}
async function evaluar(expr) {
  const r = await cdp("Runtime.evaluate", {
    expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true,
  });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result?.result?.value;
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

await cdp("Runtime.enable");
await cdp("Page.enable");
await cdp("Console.enable");
const erroresConsola = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Console.messageAdded" && m.params.message.level === "error") {
    erroresConsola.push(m.params.message.text);
  }
});

// Ventana estrecha a propósito: es donde una tabla ancha rompe la maquetación.
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 1100, height: 800, deviceScaleFactor: 1, mobile: false,
});

await cdp("Page.navigate", { url: APP });
await esperar(1500);
await evaluar(`localStorage.setItem("kai_token", ${JSON.stringify(alta.token)});`);
await cdp("Page.navigate", { url: `${APP}/asistente` });
await esperar(2500);

await evaluar(`
  const i = document.querySelector('main input[type=text]');
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(i, 'Compara la PUCV en THE Latam');
  i.dispatchEvent(new Event('input', { bubbles: true }));
`);
await esperar(300);
await evaluar(`document.querySelector('main button[title=Enviar]').click();`);
await esperar(2500);

console.log("=== 1. Negritas ===");
const negritas = await evaluar(`
  return [...document.querySelectorAll('main strong')].map(e => e.innerText);
`);
comprobar("los ** ** se convierten en <strong>", negritas.length >= 2, JSON.stringify(negritas));
comprobar("negrita bien escrita", negritas.includes("subió 12 posiciones"), JSON.stringify(negritas));
comprobar("negrita con espacios sobrantes también se corrige",
  negritas.some((t) => t.trim() === "mal escrita"), JSON.stringify(negritas));
const quedanAsteriscos = await evaluar(`
  return /\\*\\*/.test(document.querySelector('main').innerText);
`);
comprobar("no quedan asteriscos a la vista", !quedanAsteriscos);

console.log("\n=== 2. Tabla ===");
const tabla = await evaluar(`
  const t = document.querySelector('main table');
  if (!t) return null;
  return {
    encabezados: [...t.querySelectorAll('th')].map(e => e.innerText.trim()),
    filas: t.querySelectorAll('tbody tr').length,
    celdas: [...t.querySelectorAll('tbody tr')].map(f => f.children.length),
    bordeCelda: getComputedStyle(t.querySelector('td')).borderTopWidth,
    alineacion: [...t.querySelectorAll('tbody tr:first-child td')].map(e => getComputedStyle(e).textAlign),
  };
`);
comprobar("se renderiza como <table>", tabla !== null);
comprobar("4 columnas de encabezado", tabla?.encabezados.length === 4, JSON.stringify(tabla?.encabezados));
comprobar("3 filas de datos", tabla?.filas === 3, tabla?.filas);
comprobar("todas las filas con 4 celdas",
  tabla?.celdas.every((n) => n === 4), JSON.stringify(tabla?.celdas));
comprobar("las celdas tienen borde visible", tabla?.bordeCelda !== "0px", tabla?.bordeCelda);
// `start` es el valor calculado que devuelve el navegador cuando no hay
// alineación explícita; en un texto de izquierda a derecha equivale a `left`.
comprobar("la primera columna queda a la izquierda",
  ["left", "start"].includes(tabla?.alineacion[0]), JSON.stringify(tabla?.alineacion));
comprobar("las tres columnas numéricas se alinean a la derecha",
  JSON.stringify(tabla?.alineacion.slice(1)) === JSON.stringify(["right", "right", "right"]),
  JSON.stringify(tabla?.alineacion));

console.log("\n=== 3. Una tabla ancha no rompe la página ===");

async function medirDesborde(ancho) {
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: ancho, height: 800, deviceScaleFactor: 1, mobile: false,
  });
  await esperar(600);
  return evaluar(`
    const t = document.querySelector('main table');
    const env = t.closest('div');
    return {
      tablaMasAnchaQueSuCaja: t.scrollWidth > env.clientWidth,
      envolturaDesplazable: env.scrollWidth > env.clientWidth,
      overflowX: getComputedStyle(env).overflowX,
      paginaDesborda: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      mainDesborda: document.querySelector('main').scrollWidth > document.querySelector('main').clientWidth,
    };
  `);
}

// A 760 px la barra lateral (320 px) deja un espacio en el que la tabla no cabe:
// es el caso que antes empujaba la página entera.
const estrecho = await medirDesborde(760);
comprobar("a 760 px la tabla efectivamente no cabe",
  estrecho.tablaMasAnchaQueSuCaja, JSON.stringify(estrecho));
comprobar("y es su propia envoltura la que se desplaza",
  estrecho.overflowX === "auto" && estrecho.envolturaDesplazable, JSON.stringify(estrecho));
comprobar("la página NO tiene barra horizontal", !estrecho.paginaDesborda, JSON.stringify(estrecho));
comprobar("el área de conversación tampoco desborda", !estrecho.mainDesborda, JSON.stringify(estrecho));

const ancho = await medirDesborde(1600);
comprobar("a 1600 px la tabla cabe entera y no hace falta desplazarla",
  !ancho.tablaMasAnchaQueSuCaja && !ancho.paginaDesborda, JSON.stringify(ancho));

console.log("\n=== 4. Listas y saltos de línea ===");
const estructura = await evaluar(`
  const m = document.querySelector('main');
  return {
    ol: m.querySelectorAll('ol').length,
    ul: m.querySelectorAll('ul').length,
    li: [...m.querySelectorAll('li')].map(e => e.innerText.trim()),
    br: m.querySelectorAll('br').length,
    blockquote: m.querySelectorAll('blockquote').length,
    pre: m.querySelectorAll('pre').length,
    codeEnLinea: [...m.querySelectorAll('p code, li code')].map(e => e.innerText),
    enlace: (() => { const a = m.querySelector('a[href*="timeshighereducation"]');
      return a ? { texto: a.innerText, target: a.target, rel: a.rel } : null; })(),
  };
`);
comprobar("la lista con viñetas se renderiza", estructura.ul >= 1, estructura.ul);
comprobar("los elementos de lista salen separados",
  estructura.li.some((t) => t.startsWith("Métrica usada")), JSON.stringify(estructura.li));
comprobar("los saltos de línea sueltos se respetan", estructura.br >= 2, estructura.br);
const renglones = await evaluar(`
  return document.querySelector('main').innerText.includes('1: THE Latam\\n2: QS Latam');
`);
comprobar("los tres rankings quedan en renglones distintos", renglones);
comprobar("la cita se renderiza", estructura.blockquote === 1, estructura.blockquote);
comprobar("el bloque de código se renderiza", estructura.pre === 1, estructura.pre);
comprobar("el código en línea se renderiza",
  estructura.codeEnLinea.includes("citations_per_faculty"), JSON.stringify(estructura.codeEnLinea));
comprobar("el enlace abre en pestaña nueva y con rel seguro",
  estructura.enlace?.target === "_blank" && /noopener/.test(estructura.enlace?.rel || ""),
  JSON.stringify(estructura.enlace));

console.log("\n=== 5. El HTML crudo no se ejecuta ===");
const inyectado = await evaluar(`return window.__inyectado === true;`);
comprobar("el <script> de la respuesta no se ejecutó", !inyectado);
const scriptEnDom = await evaluar(`return document.querySelector('main script') !== null;`);
comprobar("no se insertó como etiqueta en el DOM", !scriptEnDom);

console.log("\n=== 6. El mensaje del usuario se muestra literal ===");
const literal = await evaluar(`
  const u = document.querySelector('main .items-end p');
  return u ? u.innerText : null;
`);
comprobar("el texto del usuario no se interpreta como Markdown",
  literal === "Compara la PUCV en THE Latam", literal);

console.log("\n=== 7. Sin errores de JavaScript ===");
const relevantes = erroresConsola.filter((t) => !/favicon|DevTools/i.test(t));
comprobar("la consola no registró errores", relevantes.length === 0, JSON.stringify(relevantes).slice(0, 400));

await cdp("Emulation.clearDeviceMetricsOverride");
console.log("\n" + "=".repeat(60));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${JSON.stringify(fallos)}` : "  (todo correcto)"));
ws.close();
process.exit(fallos.length ? 1 : 0);
