// Sonda CDP de la portada convertida en chat: estructura, fondo, planes y que
// nada desborde en pantallas pequeñas.
import fs from "fs";
const APP = process.env.KAI_APP_URL || "http://localhost:5199";
// Las capturas van junto a la sonda, no a una carpeta temporal de una
// maquina concreta. Se crea si no existe.
const SALIDA = new URL("./capturas/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
fs.mkdirSync(SALIDA, { recursive: true });

const fallos = [];
function comprobar(nombre, cond, detalle = "") {
  console.log(`  [${cond ? "OK " : "FALLA"}] ${nombre}` + (!cond && detalle ? ` -> ${detalle}` : ""));
  if (!cond) fallos.push(nombre);
}

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
const cdp = (method, params = {}) => {
  const n = ++id;
  ws.send(JSON.stringify({ id: n, method, params }));
  return new Promise((r) => pendientes.set(n, r));
};
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
const errores = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Console.messageAdded" && m.params.message.level === "error") errores.push(m.params.message.text);
});

async function ir(url, ancho = 1440, alto = 900) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: ancho, height: alto, deviceScaleFactor: 2, mobile: false });
  await cdp("Page.navigate", { url });
  await esperar(2200);
}
async function capturar(nombre) {
  const r = await cdp("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${SALIDA}/${nombre}.png`, Buffer.from(r.result.data, "base64"));
}
const clicTexto = (texto, sel = "button") => evaluar(`
  const b = [...document.querySelectorAll(${JSON.stringify(sel)})]
    .find(e => e.innerText.trim().toLowerCase().includes(${JSON.stringify(texto.toLowerCase())}));
  if (!b) return false; b.click(); return true;
`);

await ir(APP);

console.log("=== 1. El recuadro de chat y su fondo ===");
const marco = await evaluar(`
  const ill = [...document.querySelectorAll('div')].find(d => /La_scuola_di_Atene/.test(getComputedStyle(d).backgroundImage));
  const hilo = document.querySelector('[data-lenis-prevent]');
  const caja = hilo ? hilo.parentElement : null;
  return {
    fondoIlustracion: !!ill,
    fondoFijo: ill ? getComputedStyle(ill).position : null,
    hayHilo: !!hilo,
    hiloDesplazable: hilo ? getComputedStyle(hilo).overflowY : null,
    cajaConBorde: caja ? getComputedStyle(caja).borderTopWidth : null,
    desenfoque: caja ? getComputedStyle(caja).backdropFilter : null,
  };
`);
comprobar("la ilustración de la portada sigue de fondo", marco.fondoIlustracion, JSON.stringify(marco));
comprobar("y queda fija tras el chat", marco.fondoFijo === "fixed", marco.fondoFijo);
comprobar("hay un hilo de conversación con desplazamiento propio",
  marco.hayHilo && marco.hiloDesplazable === "auto", JSON.stringify(marco));
comprobar("el recuadro tiene marco visible", marco.cajaConBorde !== "0px", marco.cajaConBorde);

console.log("\n=== 2. Contenido de la portada anterior, ya como mensajes ===");
const inicio = await evaluar(`return document.body.innerText;`);
comprobar("conserva el titular", /Evolución\s+dato a dato/i.test(inicio), inicio.slice(0, 160));
comprobar("conserva la bajada", /ciencia de datos/i.test(inicio));
comprobar("conserva el rótulo de bibliometría", /Bibliometría digital de academia/i.test(inicio));
comprobar("ofrece las tres preguntas",
  /Qué puedo consultar/i.test(inicio) && /De dónde salen los datos/i.test(inicio) && /Cuánto cuesta/i.test(inicio));
comprobar("el compositor invita a entrar", /KAI_PROMPT_/.test(inicio));
comprobar("conserva el pie legal", /Todos los derechos reservados/i.test(inicio));
await capturar("landing-1-inicio");

console.log("\n=== 3. Las preguntas abren turnos ===");
await clicTexto("¿Qué puedo consultar aquí?");
await esperar(700);
const t1 = await evaluar(`return document.body.innerText;`);
comprobar("responde con los módulos",
  /Rankings/.test(t1) && /Tendencias/.test(t1) && /Simulación/.test(t1) && /Investigadores/.test(t1));
comprobar("esa pregunta ya no se ofrece de nuevo",
  (t1.match(/¿Qué puedo consultar aquí\?/g) || []).length === 1,
  (t1.match(/¿Qué puedo consultar aquí\?/g) || []).length);

await clicTexto("¿De dónde salen los datos?");
await esperar(700);
const t2 = await evaluar(`return document.body.innerText;`);
comprobar("conserva los dos fundamentos",
  /Datos confiables/.test(t2) && /Muestreo y análisis avanzado/.test(t2));
comprobar("conserva la cita de Kurosawa", /Una piedra se esconde entre las piedras/.test(t2));
const hayMuestra = await evaluar(`return !!document.querySelector('img[alt*="Muestra"]');`);
comprobar("conserva la imagen de muestra", hayMuestra);

console.log("\n=== 4. Planes por tokens ===");
await clicTexto("¿Cuánto cuesta?");
await esperar(900);
const planes = await evaluar(`
  const t = document.body.innerText;
  const tarjetas = [...document.querySelectorAll('#planes [class*="border"]')]
      .filter(e => /US\\$|Gratis/.test(e.innerText) && e.querySelector('button'));
  return { texto: t, tarjetas: tarjetas.length,
           precios: (t.match(/US\\$ [\\d.,]+/g) || []) };
`);
comprobar("aparecen los cuatro planes", planes.tarjetas === 4, planes.tarjetas);
comprobar("el gratuito se anuncia como gratis", /Gratis/.test(planes.texto));
comprobar("hay precios mensuales", planes.precios.length >= 3, JSON.stringify(planes.precios));
comprobar("se explica el cobro por tokens", /consumo de tokens/i.test(planes.texto));
comprobar("se muestran las cuotas de cada motor",
  /Gemini · respuestas rápidas/.test(planes.texto) && /Claude · razonamiento profundo/.test(planes.texto));
// El CSS pone este renglón en mayúsculas: la comparación va sin distinguirlas.
comprobar("se traducen a consultas aproximadas", /≈ [\d.]+ consultas/i.test(planes.texto),
  (planes.texto.match(/≈[^\n]*/i) || ["no aparece"])[0]);
comprobar("se indican los topes diarios", /consultas al día/.test(planes.texto));
comprobar("el gratuito marca Claude como no incluido", /No incluido/.test(planes.texto));
comprobar("se explica que sin plan queda el gratuito",
  /sin plan contratado quedas en el plan gratuito/i.test(planes.texto));
comprobar("se advierte que Claude es de pago",
  /Claude solo se incluye en los planes\s+de pago/i.test(planes.texto.replace(/\s+/g, " "))
  || /Claude solo se incluye en los planes de pago/i.test(planes.texto.replace(/\s+/g, " ")));
await capturar("landing-2-planes");

console.log("\n=== 5. Nada desborda ===");
// Entre ~710 y ~900 px el <nav> del Header mide 985 px fijos y desborda la
// página. Es un defecto preexistente del Header, común a todas las vistas, no
// de esta portada: por eso se mide aquí el contenido propio, y aparte se
// comprueba que el desborde que quede sea atribuible al Header.
for (const ancho of [1440, 1024, 768, 420]) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: ancho, height: 900, deviceScaleFactor: 1, mobile: false });
  await esperar(500);
  const d = await evaluar(`
    const vw = document.documentElement.clientWidth;
    const fuera = [...document.querySelectorAll('main *, footer *')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1; })
      .slice(0, 3).map(e => e.tagName + '.' + String(e.className).split(' ')[0]);
    return {
      contenidoFuera: fuera,
      hilo: (() => { const h = document.querySelector('[data-lenis-prevent]');
                     return h ? h.scrollWidth > h.clientWidth : null; })(),
      paginaDesborda: document.documentElement.scrollWidth > vw,
      culpableEsHeader: [...document.querySelectorAll('header *, nav')]
        .some(e => e.getBoundingClientRect().right > vw + 1),
    };
  `);
  comprobar(`a ${ancho}px el contenido de la portada cabe`,
    d.contenidoFuera.length === 0 && !d.hilo, JSON.stringify(d));
  if (d.paginaDesborda) {
    comprobar(`a ${ancho}px el desborde restante es del Header (preexistente)`,
      d.culpableEsHeader, JSON.stringify(d));
  }
}
await cdp("Emulation.setDeviceMetricsOverride", { width: 420, height: 800, deviceScaleFactor: 2, mobile: false });
await esperar(500);
await capturar("landing-3-movil");

console.log("\n=== 6. El enlace directo a planes los abre solo ===");
await ir(`${APP}/#planes`);
const directo = await evaluar(`return document.body.innerText;`);
comprobar("entrando por /#planes ya se ven", /consumo de tokens/i.test(directo), directo.slice(0, 200));

console.log("\n=== 7. Sin errores de JavaScript ===");
const relevantes = errores.filter((t) => !/favicon|DevTools/i.test(t));
comprobar("la consola no registró errores", relevantes.length === 0, JSON.stringify(relevantes).slice(0, 400));

await cdp("Emulation.clearDeviceMetricsOverride");
console.log("\n" + "=".repeat(62));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${JSON.stringify(fallos)}` : "  (todo correcto)"));
ws.close();
process.exit(fallos.length ? 1 : 0);
