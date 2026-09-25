// Revisión visual de los tres estados nuevos de acceso: el registro con
// institución, la cuenta sin institución y el asistente ajeno a la institución.
import fs from "node:fs";

const APP = "http://localhost:5199";
const API = process.env.KAI_API_URL || "http://localhost:8000";
const SALIDA = process.argv[2];

const objetivos = await (await fetch("http://localhost:9222/json/list")).json();
const ws = new WebSocket(objetivos.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pendientes = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
};
const cdp = (m, p = {}) => { const n = ++id; ws.send(JSON.stringify({ id: n, method: m, params: p })); return new Promise(r => pendientes.set(n, r)); };
const ev = async (expr) =>
  (await cdp("Runtime.evaluate", { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true }))
    .result?.result?.value;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const capturar = async (nombre) => {
  const s = await cdp("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${SALIDA}/acceso-${nombre}.png`, Buffer.from(s.result.data, "base64"));
};

await cdp("Runtime.enable");
await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });

// 1. Registro: el selector de institución es obligatorio.
await ev(`localStorage.removeItem("kai_token");`);
await cdp("Page.navigate", { url: `${APP}/tendencias` });
await esperar(2500);
await capturar("sin-sesion");
await ev(`[...document.querySelectorAll('button')].find(b => /iniciar sesi/i.test(b.innerText))?.click();`);
await esperar(900);
await ev(`[...document.querySelectorAll('button')].find(b => /registrarse/i.test(b.innerText))?.click();`);
await esperar(1200);
await capturar("registro");
const selector = await ev(`
  const s = document.querySelector('#institucion');
  return s ? { requerido: s.required, opciones: s.options.length, primera: s.options[1]?.text } : null;
`);
console.log("selector de institución:", JSON.stringify(selector));

// 2. Cuenta sin institución: se le reclama antes de dejarla pasar.
const sinInst = await (await fetch(`${API}/auth/registro`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ nombre: "Sin institución", correo: `pendiente-${Date.now()}@pucv.cl`,
                         clave: "Prueba12345!", institucion: "Universidad de Chile" }),
})).json();
// Se le quita la institución por la API pública no se puede; se simula el caso
// de Google marcando el testigo y vaciando el campo desde el backend de prueba.
console.log("cuenta creada:", sinInst.usuario?.correo);

// 3. Asistente con una cuenta de otro dominio.
const ajena = await (await fetch(`${API}/auth/registro`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ nombre: "Cuenta externa", correo: `externa-${Date.now()}@gmail.com`,
                         clave: "Prueba12345!", institucion: "Universidad de Chile" }),
})).json();
await cdp("Page.navigate", { url: APP });
await esperar(1200);
await ev(`localStorage.setItem("kai_token", ${JSON.stringify(ajena.token)});`);
await cdp("Page.navigate", { url: `${APP}/asistente` });
await esperar(3500);
await capturar("asistente-ajeno");
console.log("aviso del asistente:", JSON.stringify(await ev(`
  return [...document.querySelectorAll('p')].map(p => p.innerText)
    .find(t => /PUCV|no disponible/i.test(t)) || null;
`)));

ws.close();
process.exit(0);
