// Ejecuta las sondas de navegador y emite un veredicto único.
//
//   node pruebas/ejecutar.mjs
//   node pruebas/ejecutar.mjs encabezado tendencias
//
// Requiere dos cosas en marcha, que no se levantan aquí a propósito —para que la
// sonda no mate un servidor del que dependa otra cosa—:
//
//   1. La aplicación compilada y servida:
//        npx vite build --outDir dist-prueba
//        npx vite preview --outDir dist-prueba --port 5199 --strictPort
//   2. Un navegador con el protocolo de depuración abierto:
//        msedge --headless=new --remote-debugging-port=9222 --user-data-dir=<temporal>
//
// Direcciones configurables con KAI_APP_URL y KAI_CDP_URL.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const APP = process.env.KAI_APP_URL || "http://localhost:5199";
const CDP = process.env.KAI_CDP_URL || "http://localhost:9222";

const SONDAS = {
  encabezado: "Sin desborde horizontal y con navegación en todo ancho",
  tendencias: "Orden de las vistas y vista predeterminada",
  glosario: "Exclusión de ranking, agregación multidisciplinaria y globo",
  portada: "Estructura, planes y orden de los turnos",
  respuestas_markdown: "Énfasis, tablas, listas y desbordamiento",
  motores: "Selector de motores y derivación",
};

// Estas dos ejercitan la interfaz del asistente, así que además de la aplicación
// necesitan un backend con el proveedor de lenguaje sustituido por un doble
// —levantado aparte— y la aplicación compilada apuntando a él. Sin esa
// preparación no se ejecutan, en vez de fallar por falta de servicio.
const REQUIEREN_ASISTENTE = new Set(["motores", "respuestas_markdown"]);
const hayBackendDePrueba = Boolean(process.env.KAI_API_URL);

const disponibles = readdirSync(AQUI)
  .filter(f => f.endsWith(".mjs") && f !== "ejecutar.mjs")
  .map(f => f.replace(/\.mjs$/, ""));

const pedidas = process.argv.slice(2);
const seleccion = pedidas.length
  ? pedidas.filter(n => disponibles.includes(n))
  : disponibles.filter(n => !REQUIEREN_ASISTENTE.has(n) || hayBackendDePrueba);

const omitidas = disponibles.filter(n => !seleccion.includes(n));

if (pedidas.length && seleccion.length !== pedidas.length) {
  const faltan = pedidas.filter(n => !disponibles.includes(n));
  console.error(`Sondas desconocidas: ${faltan.join(", ")}`);
  console.error(`Disponibles: ${disponibles.join(", ")}`);
  process.exit(2);
}

// Comprobación previa: sin estos dos servicios las sondas fallarían con errores
// de conexión que parecerían defectos de la aplicación.
async function responde(url, que) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return true;
  } catch (e) {
    console.error(`No responde ${que} en ${url}: ${e.message}`);
    return false;
  }
}

const listo = (await responde(APP, "la aplicación")) &
              (await responde(`${CDP}/json/version`, "el navegador"));
if (!listo) {
  console.error("\nVer las instrucciones al principio de este archivo.");
  process.exit(2);
}

// Las anulaciones de métricas de dispositivo persisten en la instancia del
// navegador entre ejecuciones. Sin limpiarlas, una sonda que termina emulando una
// pantalla estrecha deja a la siguiente midiendo con ese ancho, y esta falla por
// un motivo que no tiene nada que ver con lo que verifica. Ya nos costó un
// diagnóstico equivocado una vez.
async function restablecerPantalla() {
  const objetivos = await (await fetch(`${CDP}/json/list`)).json();
  const pagina = objetivos.find(t => t.type === "page");
  if (!pagina) return;
  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise(r => (ws.onopen = r));
  await new Promise(r => {
    ws.onmessage = () => r();
    ws.send(JSON.stringify({ id: 1, method: "Emulation.clearDeviceMetricsOverride" }));
  });
  ws.close();
}

const ejecutar = nombre => new Promise(resolve => {
  const inicio = Date.now();
  const hijo = spawn(process.execPath, [join(AQUI, `${nombre}.mjs`)], {
    env: { ...process.env, KAI_APP_URL: APP, KAI_CDP_URL: CDP },
  });
  let salida = "";
  hijo.stdout.on("data", d => (salida += d));
  hijo.stderr.on("data", d => (salida += d));
  hijo.on("close", codigo => {
    const marcas = salida.match(/\[(OK |FALLA)\]/g) || [];
    resolve({
      codigo,
      comprobaciones: marcas.length,
      fallidas: marcas.filter(m => m.includes("FALLA")).length,
      segundos: (Date.now() - inicio) / 1000,
      salida,
    });
  });
});

console.log(`Ejecutando ${seleccion.length} sondas contra ${APP}\n`);
const resultados = [];
for (const nombre of seleccion) {
  process.stdout.write(`  ${nombre.padEnd(22)} ${(SONDAS[nombre] || "").slice(0, 52).padEnd(54)}`);
  await restablecerPantalla();
  const r = await ejecutar(nombre);
  resultados.push([nombre, r]);
  const estado = r.codigo === 0 ? "OK" : `FALLA (${r.fallidas})`;
  console.log(` ${String(r.comprobaciones).padStart(3)} compr. ${r.segundos.toFixed(1).padStart(6)}s  ${estado}`);
  if (r.codigo !== 0) for (const l of r.salida.split("\n")) console.log("        " + l);
}

const total = resultados.reduce((s, [, r]) => s + r.comprobaciones, 0);
const fallidas = resultados.reduce((s, [, r]) => s + r.fallidas, 0);
const rojas = resultados.filter(([, r]) => r.codigo !== 0).map(([n]) => n);

console.log("\n" + "=".repeat(74));
console.log(`${resultados.length} sondas · ${total} comprobaciones · ${fallidas} fallidas`);
console.log(rojas.length ? `SONDAS EN ROJO: ${rojas.join(", ")}` : "TODO EN VERDE");
if (omitidas.length) {
  console.log(`\nOmitidas por falta de backend de prueba: ${omitidas.join(", ")}`);
  console.log("Para incluirlas, levanta un backend con el proveedor sustituido y define");
  console.log("KAI_API_URL con su dirección, compilando antes la aplicación contra ella.");
}
process.exit(rojas.length ? 1 : 0);
