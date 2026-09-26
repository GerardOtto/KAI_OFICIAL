// Sonda del modo numérico de la pantalla de ranking.
//
// Comprueba que el conmutador aparezca solo donde hay valores medidos, que al
// entrar se vea la advertencia de cobertura, que la tabla muestre las
// componentes con sus unidades y que ordenar por una de ellas respete si más
// es mejor o peor. Los rankings reservados (THE, QS) se revisan solo si se pasa
// un testigo de un plan de pago en KAI_TOKEN_PAGO; la batería del backend cubre
// su acceso en cualquier caso.
//
// Requiere un backend con las migraciones 008 a 010, los datos del Ranking KAI y
// los valores de cargar_valores_reales.py, y la aplicación compilada contra él.
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

const pestana = (texto) => `[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(texto)}))`;
const boton = (texto) => `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(texto)})`;
const estadoModo = () => ev(`
  const b = ${boton("Valores medidos")};
  return b ? { deshabilitado: b.disabled, activo: b.getAttribute('aria-pressed') === 'true' } : null;
`);
const aviso = () => ev(`return document.getElementById('titulo-aviso-valores')?.closest('section')?.textContent || null;`);
const cabeceras = () => ev(`
  return [...document.querySelectorAll('table thead th')].slice(2)
    .map(th => th.textContent.replace(/\\s+/g, ' ').trim());
`);
const columna = (i) => ev(`
  return [...document.querySelectorAll('table tbody tr')].map(tr => ({
    u: tr.querySelector('th')?.textContent.trim(),
    v: tr.querySelectorAll('td')[${i} + 1]?.textContent.replace(/[≈◐]/g, '').trim(),
  }));
`);
const aNumero = (t) => Number(String(t).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));

async function abrir(token) {
  await cdp("Page.navigate", { url: APP });
  await esperar(1200);
  await ev(`localStorage.setItem("kai_token", ${JSON.stringify(token)});`);
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1100, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: `${APP}/ranking` });
  await esperar(4000);
}

await cdp("Runtime.enable"); await cdp("Page.enable"); await cdp("Console.enable");
const { token } = await crearSesion();
await abrir(token);

console.log("=== 1. Solo donde hay valores medidos ===");
await ev(`${pestana("Shanghai GRAS")}?.click();`);
await esperar(2500);
const gras = await estadoModo();
comprobar("en Shanghai GRAS el modo numérico está deshabilitado", gras?.deshabilitado === true, JSON.stringify(gras));
await ev(`${pestana("Ranking KAI")}.click();`);
await esperar(4000);
const kai = await estadoModo();
comprobar("en el Ranking KAI está disponible", kai && !kai.deshabilitado, JSON.stringify(kai));

console.log("\n=== 2. Ranking KAI en valores medidos ===");
await ev(`${boton("Valores medidos")}.click();`);
await esperar(2500);
const textoAviso = await aviso();
comprobar("aparece la advertencia", Boolean(textoAviso));
comprobar("dice que son valores medidos, no puntajes", /Valores medidos, no puntajes/i.test(textoAviso || ""), textoAviso?.slice(0, 80));
comprobar("dice que cubren las diez componentes", /las 10 componentes/.test(textoAviso || ""), textoAviso?.slice(0, 200));
comprobar("explica que no hay total", /no tiene total/.test(textoAviso || ""));
const heads = await cabeceras();
comprobar("la tabla tiene diez columnas de métricas", heads.length === 10, JSON.stringify(heads));
comprobar("cada columna muestra su unidad", heads.every(h => /peso/.test(h)) && heads.some(h => /estudiantes por académico/.test(h)),
  heads[0]);
comprobar("la métrica de «menos es mejor» lo anuncia", heads.some(h => /menos es mejor/.test(h)));
const i = heads.findIndex(h => h.startsWith("Estudiantes por académico"));
await ev(`[...document.querySelectorAll('table thead th button')].find(b => b.textContent.trim().startsWith('Estudiantes por académico')).click();`);
await esperar(400);
const col = (await columna(i)).map(x => aNumero(x.v)).filter(n => !Number.isNaN(n));
comprobar("ordenar por estudiantes por académico pone primero el valor más bajo",
  col.length > 10 && col.every((n, k) => k === 0 || col[k - 1] <= n), col.slice(0, 5).join(" "));
const exportar = await ev(`return ${boton("Exportar")}.disabled;`);
comprobar("se puede exportar lo que se ve", exportar === false);
await capturar("modo_numerico_kai");

console.log("\n=== 3. Scimago: valores de la fuente ===");
await ev(`${pestana("Scimago Latam")}.click();`);
await esperar(3500);
const sci = await estadoModo();
comprobar("el modo numérico se conserva al cambiar a un ranking que lo admite", sci?.activo === true, JSON.stringify(sci));
const avisoSci = await aviso();
comprobar("el aviso dice que la fuente los publica tal cual", /tal cual/.test(avisoSci || ""), avisoSci?.slice(0, 120));
comprobar("y nombra lo que falta", /Sin valor medido/.test(avisoSci || ""), avisoSci?.slice(0, 300));
await capturar("modo_numerico_scimago");

console.log("\n=== 4. Volver a un ranking sin valores devuelve los puntajes ===");
await ev(`${pestana("Shanghai GRAS")}.click();`);
await esperar(2500);
comprobar("en Shanghai GRAS no aparece la advertencia", !(await aviso()));
comprobar("y se ve la tabla de puntajes", await ev(`return [...document.querySelectorAll('span')].some(s => /^Score en/.test(s.textContent));`));

if (process.env.KAI_TOKEN_PAGO) {
  console.log("\n=== 5. THE Latam con un plan de pago ===");
  await abrir(process.env.KAI_TOKEN_PAGO);
  await ev(`${pestana("THE Latam")}.click();`);
  await esperar(3000);
  await ev(`${boton("Valores medidos")}.click();`);
  await esperar(3000);
  const avisoThe = await aviso();
  comprobar("advierte que no son las cifras enviadas a THE", /No son las cifras que cada universidad envió/.test(avisoThe || ""), avisoThe?.slice(0, 120));
  comprobar("dice qué parte del ranking cubren", /Cubren \d+ de 17 componentes/.test(avisoThe || ""), avisoThe?.slice(0, 250));
  comprobar("explica las marcas de calidad", /≈/.test(avisoThe || "") || /◐/.test(avisoThe || ""));
  const marcas = await ev(`return [...document.querySelectorAll('table tbody td')].filter(td => /[≈◐]/.test(td.textContent)).length;`);
  comprobar("las celdas aproximadas o parciales llevan su marca", marcas > 0, marcas);
  await capturar("modo_numerico_the");
}

console.log("\n=== Sin errores en la consola ===");
comprobar("la consola no registró errores", errores.length === 0, errores.slice(0, 3).join(" | "));

console.log("\n" + "=".repeat(60));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${fallos.join("; ")}` : "  (todo correcto)"));
ws.close();
process.exit(fallos.length ? 1 : 0);
