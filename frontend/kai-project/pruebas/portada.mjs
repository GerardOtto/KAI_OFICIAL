// Sonda CDP de la portada: una página que se lee de arriba abajo, con los planes
// en pesos y botones de contratación evidentes, y que al entrar lleva al asistente.
//
// Necesita KAI_API_URL (el backend al que apunta la aplicación compilada) para
// crear la cuenta desechable con la que se prueba el inicio de sesión.
import fs from "fs";
import { crearSesion } from "./sesion.mjs";

const APP = process.env.KAI_APP_URL || "http://localhost:5199";
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
  await cdp("Emulation.setDeviceMetricsOverride", { width: ancho, height: alto, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url });
  await esperar(2500);
}
async function capturar(nombre) {
  const r = await cdp("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${SALIDA}/${nombre}.png`, Buffer.from(r.result.data, "base64"));
}
// textContent y no innerText: el CSS pone algunos rótulos en mayúsculas.
const botones = (texto) => `[...document.querySelectorAll('button')]
  .filter(b => b.textContent.trim().toLowerCase().includes(${JSON.stringify(texto.toLowerCase())}))`;

// Sin sesión previa en el navegador: la portada se mide como la ve alguien nuevo.
await ir(APP);
await evaluar(`localStorage.removeItem("kai_token");`);
await ir(APP);

console.log("=== 1. Se lee de arriba abajo, sin chat ===");
const estructura = await evaluar(`
  return {
    h1: document.querySelector('h1')?.textContent.trim(),
    chat: !!document.querySelector('[data-lenis-prevent]') || /KAI_PROMPT_/.test(document.body.textContent),
    secciones: [...document.querySelectorAll('main section')].map(s => s.id || '(presentación)'),
    planesDebajo: (() => { const h = document.querySelector('h1'), p = document.getElementById('planes');
                           return !!(h && p) && h.getBoundingClientRect().top < p.getBoundingClientRect().top; })(),
    pie: /Todos los derechos reservados/.test(document.body.textContent),
  };
`);
comprobar("el titular dice qué es KAI", /rankings/i.test(estructura.h1 || ""), estructura.h1);
comprobar("ya no hay chat interactivo", !estructura.chat);
comprobar("la presentación va antes que los planes", estructura.planesDebajo, JSON.stringify(estructura.secciones));
comprobar("hay secciones de planes, cómo empezar y datos",
  ["planes", "empezar", "datos"].every((s) => estructura.secciones.includes(s)), JSON.stringify(estructura.secciones));
comprobar("conserva el pie legal", estructura.pie);
await capturar("landing-1-inicio");

console.log("\n=== 2. Planes en pesos, con botones de contratación ===");
const planes = await evaluar(`
  const sec = document.getElementById('planes');
  const texto = sec.textContent;
  return {
    tarjetas: sec.querySelectorAll('article').length,
    precios: (texto.match(/\\$\\d{1,3}(\\.\\d{3})+/g) || []),
    tachados: [...sec.querySelectorAll('.line-through')].map(e => e.textContent.trim()),
    descuentos: (texto.match(/Descuento de lanzamiento/gi) || []).length,
    recomendada: (() => { const a = [...sec.querySelectorAll('article')].find(x => /Recomendado/i.test(x.textContent));
                          if (!a) return null; const b = a.querySelector('button');
                          return { fondo: getComputedStyle(a).backgroundColor, letra: getComputedStyle(a).color,
                                   boton: getComputedStyle(b).backgroundColor }; })(),
    dolares: /US\\$/.test(texto),
    gratis: /Gratis/.test(texto),
    iva: /\\+ IVA/.test(texto),
    contratar: ${botones("Contratar ahora")}.length,
    crearGratis: ${botones("Crear cuenta gratis")}.length,
    recomendado: /Recomendado/i.test(texto),
    theQs: /incluidos THE y QS/.test(texto) && /Sin rankings THE y QS/.test(texto),
    espera: /una consulta cada \\d+ días/.test(texto),
    consultas: /≈ [\\d.]+ consultas al mes/.test(texto),
    pucv: /disponible para cuentas de la PUCV/.test(texto),
    boton: (() => { const b = ${botones("Contratar ahora")}[0]; if (!b) return null;
                    const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
                    return { alto: Math.round(r.height), fondo: cs.backgroundColor, letra: cs.fontSize }; })(),
  };
`);
comprobar("aparecen los cuatro planes", planes.tarjetas === 4, planes.tarjetas);
comprobar("los tres de pago tienen precio en pesos y su precio de lista",
  planes.precios.length === 6, JSON.stringify(planes.precios));
comprobar("el de lista va tachado", planes.tachados.length === 3, JSON.stringify(planes.tachados));
comprobar("y el tachado es mayor que el vigente",
  planes.tachados.every((t) => { const n = (s) => Number(s.replace(/\D/g, ""));
    const i = planes.precios.indexOf(t); return i > 0 && n(t) > n(planes.precios[i - 1]); }),
  JSON.stringify(planes.precios));
comprobar("cada descuento se rotula «Descuento de lanzamiento»", planes.descuentos === 3, planes.descuentos);
comprobar("la tarjeta recomendada va invertida: fondo blanco, letra negra y botón negro",
  planes.recomendada?.fondo === "rgb(255, 255, 255)" && planes.recomendada?.letra === "rgb(0, 0, 0)"
    && planes.recomendada?.boton === "rgb(0, 0, 0)", JSON.stringify(planes.recomendada));
comprobar("sin precios en dólares", !planes.dolares);
comprobar("se aclara que es más IVA", planes.iva);
comprobar("el gratuito se anuncia como gratis", planes.gratis);
comprobar("cada plan de pago tiene «Contratar ahora»", planes.contratar === 3, planes.contratar);
comprobar("y el gratuito, «Crear cuenta gratis»", planes.crearGratis === 1, planes.crearGratis);
comprobar("el botón es grande y relleno",
  planes.boton && planes.boton.alto >= 44 && !/rgba\(0, 0, 0, 0\)|transparent/.test(planes.boton.fondo),
  JSON.stringify(planes.boton));
comprobar("hay un plan recomendado", planes.recomendado);
comprobar("se dice quién ve THE y QS", planes.theQs);
comprobar("el gratuito dice su espera entre consultas", planes.espera);
comprobar("las cuotas se traducen a consultas", planes.consultas);
comprobar("se avisa que el asistente es por ahora de la PUCV", planes.pucv);
await evaluar(`document.getElementById('planes').scrollIntoView();`);
await esperar(400);
await capturar("landing-2-planes");

console.log("\n=== 3. «Contratar ahora» abre el registro ===");
await evaluar(`${botones("Contratar ahora")}[0].click();`);
await esperar(600);
const modal = await evaluar(`
  const activa = [...document.querySelectorAll('button')].find(b => /border-b-2/.test(b.className));
  return { abierto: !!document.getElementById('correo'), pestana: activa?.textContent.trim(),
           nombre: !!document.getElementById('nombre') };
`);
comprobar("se abre el formulario", modal.abierto, JSON.stringify(modal));
comprobar("en la pestaña de registro", /Registrarse/i.test(modal.pestana || "") && modal.nombre, JSON.stringify(modal));
await capturar("landing-3-registro");

console.log("\n=== 4. Entrar desde la portada lleva al asistente ===");
if (!process.env.KAI_API_URL) {
  console.log("  (omitida: define KAI_API_URL para crear la cuenta de prueba)");
} else {
  const cuenta = await crearSesion();
  await ir(APP);
  await evaluar(`${botones("Ya tengo cuenta")}[0].click();`);
  await esperar(600);
  // Los campos son controlados por React: se escribe con el setter nativo y un
  // evento de entrada, que es lo que React escucha.
  await evaluar(`
    const poner = (id, v) => { const e = document.getElementById(id);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, v);
      e.dispatchEvent(new Event('input', { bubbles: true })); };
    poner('correo', ${JSON.stringify(cuenta.correo)});
    poner('clave', 'Prueba12345!');
    document.querySelector('form button[type="submit"]').click();
  `);
  await esperar(2500);
  const destino = await evaluar(`return location.pathname;`);
  comprobar("tras iniciar sesión se llega al asistente", destino === "/asistente", destino);
  await evaluar(`localStorage.removeItem("kai_token");`);

  // El mismo destino si se entra con el botón del encabezado estando en la portada.
  await ir(APP);
  await evaluar(`document.querySelector('header') && [...document.querySelectorAll('header button')]
    .find(b => /iniciar sesión/i.test(b.textContent)).click();`);
  await esperar(600);
  await evaluar(`
    const poner = (id, v) => { const e = document.getElementById(id);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, v);
      e.dispatchEvent(new Event('input', { bubbles: true })); };
    poner('correo', ${JSON.stringify(cuenta.correo)});
    poner('clave', 'Prueba12345!');
    document.querySelector('form button[type="submit"]').click();
  `);
  await esperar(2500);
  const desdeHeader = await evaluar(`return location.pathname;`);
  comprobar("y también entrando desde el encabezado", desdeHeader === "/asistente", desdeHeader);
  await evaluar(`localStorage.removeItem("kai_token");`);
}

console.log("\n=== 5. Nada desborda ===");
await ir(APP);
for (const ancho of [1440, 1024, 768, 390]) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: ancho, height: 900, deviceScaleFactor: 1, mobile: ancho < 500 });
  await esperar(500);
  const d = await evaluar(`
    const vw = document.documentElement.clientWidth;
    return { desborda: document.documentElement.scrollWidth > vw,
             fuera: [...document.querySelectorAll('main *, footer *')]
               .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1; })
               .slice(0, 3).map(e => e.tagName + '.' + String(e.className).split(' ')[0]) };
  `);
  comprobar(`a ${ancho}px la portada cabe`, !d.desborda && d.fuera.length === 0, JSON.stringify(d));
}
await capturar("landing-4-movil");

console.log("\n=== 6. El enlace directo a planes baja hasta ellos ===");
await ir(`${APP}/#planes`);
await esperar(1500);
const bajo = await evaluar(`return Math.abs(document.getElementById('planes').getBoundingClientRect().top) < 200;`);
comprobar("entrando por /#planes se ven los planes", bajo);

console.log("\n=== 7. Sin errores de JavaScript ===");
const relevantes = errores.filter((t) => !/favicon|DevTools/i.test(t));
comprobar("la consola no registró errores", relevantes.length === 0, JSON.stringify(relevantes).slice(0, 400));

await cdp("Emulation.clearDeviceMetricsOverride");
console.log("\n" + "=".repeat(62));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${JSON.stringify(fallos)}` : "  (todo correcto)"));
ws.close();
process.exit(fallos.length ? 1 : 0);
