// Recorre la aplicación con una cuenta gratuita y captura lo que ve, para
// revisar a ojo lo que las sondas comprueban por geometría.
import fs from "node:fs";
import { crearSesion } from "./sesion.mjs";

const APP = "http://localhost:5199";
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
const cdp = (method, params = {}) => {
  const n = ++id;
  ws.send(JSON.stringify({ id: n, method, params }));
  return new Promise((r) => pendientes.set(n, r));
};
const ev = async (expr) =>
  (await cdp("Runtime.evaluate", { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true }))
    .result?.result?.value;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

await cdp("Runtime.enable");
await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false });

const { token, correo } = await crearSesion();
await cdp("Page.navigate", { url: APP });
await esperar(1500);
await ev(`localStorage.setItem("kai_token", ${JSON.stringify(token)});`);
console.log("cuenta:", correo);

const VISTAS = [
  ["/ranking", "resumen"],
  ["/tendencias", "tendencias"],
  ["/metricas", "glosario"],
  ["/simulacion/comparada", "simulacion"],
  ["/asistente", "asistente"],
];

for (const [ruta, nombre] of VISTAS) {
  await cdp("Page.navigate", { url: `${APP}${ruta}` });
  await esperar(4000);
  const shot = await cdp("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${SALIDA}/plan-${nombre}.png`, Buffer.from(shot.result.data, "base64"));
  const resumen = await ev(`
    const texto = document.body.innerText;
    return {
      reservados: (texto.match(/plan de pago/gi) || []).length,
      vacio: texto.trim().length < 40,
      primeras: texto.split("\\n").filter(Boolean).slice(0, 4),
    };
  `);
  console.log(`${nombre.padEnd(11)} «plan de pago» ×${resumen.reservados}  ${resumen.vacio ? "PÁGINA VACÍA" : ""}`);
}

ws.close();
process.exit(0);
