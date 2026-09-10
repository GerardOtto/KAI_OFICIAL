// Sonda CDP: comprueba en un navegador real el selector de motor, el bloqueo
// dentro de una conversación y la derivación a otra. Contra el backend de
// prueba (8010), con el proveedor sustituido: no gasta tokens.
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

// --- Usuario desechable -----------------------------------------------------
const correo = `sonda_motores_${Date.now()}@ejemplo.test`;
const alta = await (await fetch(`${API}/auth/registro`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ nombre: "Sonda Motores", correo, clave: "clave-de-sonda-123" }),
})).json();
if (!alta.token) { console.error("No se pudo registrar:", alta); process.exit(1); }
console.log(`Usuario desechable: ${correo} (id ${alta.usuario.id})\n`);

// --- Conexión CDP -----------------------------------------------------------
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
    expression: `(async () => { ${expr} })()`,
    awaitPromise: true, returnByValue: true,
  });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
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

// Sesión iniciada sin pasar por el formulario.
await cdp("Page.navigate", { url: APP });
await esperar(1500);
await evaluar(`localStorage.setItem("kai_token", ${JSON.stringify(alta.token)});`);
await cdp("Page.navigate", { url: `${APP}/asistente` });
await esperar(2500);

// Utilidades de DOM
const textoDe = (sel) => evaluar(`return document.querySelector(${JSON.stringify(sel)})?.innerText ?? null;`);
const todos = (sel) => evaluar(`return [...document.querySelectorAll(${JSON.stringify(sel)})].map(e => e.innerText.replace(/\\n/g," | "));`);
async function clicPorTexto(texto, sel = "button") {
  return evaluar(`
    const b = [...document.querySelectorAll(${JSON.stringify(sel)})]
      .find(e => e.innerText.trim().toLowerCase().includes(${JSON.stringify(texto.toLowerCase())}));
    if (!b) return false;
    b.click(); return true;
  `);
}

console.log("=== 1. El selector de motor se dibuja ===");
const aside = await textoDe("aside");
comprobar("la barra lateral cargó", !!aside, aside);
comprobar("muestra el rótulo del selector", /MOTOR DE AN[ÁA]LISIS/i.test(aside || ""), aside?.slice(0, 200));
comprobar("ofrece Claude", /CLAUDE/i.test(aside || ""));
comprobar("ofrece Gemini", /GEMINI/i.test(aside || ""));
comprobar("etiqueta el costo de cada uno",
  /Mayor costo por token/i.test(aside || "") && /Menor costo por token/i.test(aside || ""),
  aside?.slice(0, 300));

console.log("\n=== 2. Se puede cambiar de motor antes de empezar ===");
let compositor = await textoDe("main");
comprobar("el compositor arranca en Claude", /KAI_CLAUDE_/.test(compositor || ""),
  (compositor || "").slice(-200));
await clicPorTexto("Gemini");
await esperar(400);
compositor = await textoDe("main");
comprobar("al elegir Gemini el compositor lo refleja", /KAI_GEMINI_/.test(compositor || ""),
  (compositor || "").slice(-200));
// El CSS pone este pie en mayúsculas, así que la comparación es insensible.
comprobar("y anuncia el modelo barato", /gemini-2\.5-flash-lite/i.test(compositor || ""),
  (compositor || "").slice(-250));

console.log("\n=== 3. Al abrir conversación el selector se bloquea ===");
await evaluar(`
  const i = document.querySelector('main input[type=text]');
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(i, 'Cuantos rankings hay cargados');
  i.dispatchEvent(new Event('input', { bubbles: true }));
`);
await esperar(300);
await clicPorTexto("", "main button[title=Enviar]");
await evaluar(`document.querySelector('main button[title=Enviar]').click();`);
await esperar(2000);

const asideTrasEnviar = await textoDe("aside");
comprobar("el selector queda fijado", /FIJADO/i.test(asideTrasEnviar || ""), asideTrasEnviar?.slice(0, 300));
comprobar("explica que no se puede cambiar",
  /no cambia de motor/i.test(asideTrasEnviar || ""), asideTrasEnviar?.slice(0, 400));
const botonesAside = await todos("aside button");
comprobar("ya no hay botones para elegir motor",
  !botonesAside.some((t) => /MENOR COSTO|MAYOR COSTO/i.test(t)), JSON.stringify(botonesAside).slice(0, 300));

const cuerpo = await textoDe("main");
comprobar("llegó la respuesta del motor elegido", /Respuesta simulada del motor gemini/i.test(cuerpo || ""),
  (cuerpo || "").slice(0, 300));
comprobar("el contexto que recibió tenía 1 turno", /contexto: 1/.test(cuerpo || ""), (cuerpo || "").slice(0, 400));

console.log("\n=== 4. La fila del historial indica su motor ===");
const filas = await todos("aside .group");
comprobar("la conversación aparece en el historial", filas.length >= 1, JSON.stringify(filas));
comprobar("con la etiqueta del motor", filas.some((t) => /GEMINI/i.test(t)), JSON.stringify(filas).slice(0, 300));

console.log("\n=== 5. Derivar el mensaje al otro motor ===");
const hayDerivar = await evaluar(`
  return [...document.querySelectorAll('main button')].some(b => /Derivar a Claude/i.test(b.innerText));
`);
comprobar("ofrece derivar al otro motor", hayDerivar);
await clicPorTexto("Derivar a Claude");
await esperar(600);

const trasDerivar = await textoDe("main");
const asideTrasDerivar = await textoDe("aside");
comprobar("el compositor pasa a Claude", /KAI_CLAUDE_/.test(trasDerivar || ""), (trasDerivar || "").slice(-200));
comprobar("el selector se desbloquea", !/FIJADO/i.test(asideTrasDerivar || ""), asideTrasDerivar?.slice(0, 200));
const valorInput = await evaluar(`return document.querySelector('main input[type=text]').value;`);
comprobar("el mensaje queda listo para reenviar",
  valorInput === "Cuantos rankings hay cargados", valorInput);
comprobar("la conversación anterior sigue en el historial",
  (await todos("aside .group")).length >= 1);
comprobar("el hilo actual arranca vacío",
  !/Respuesta simulada/.test(trasDerivar || ""), (trasDerivar || "").slice(0, 200));

console.log("\n=== 6. La derivación crea una conversación aparte ===");
await evaluar(`document.querySelector('main button[title=Enviar]').click();`);
await esperar(2000);
const filas2 = await todos("aside .group");
comprobar("ahora hay dos conversaciones", filas2.length === 2, JSON.stringify(filas2));
comprobar("una por motor",
  filas2.some((t) => /GEMINI/i.test(t)) && filas2.some((t) => /CLAUDE/i.test(t)),
  JSON.stringify(filas2).slice(0, 400));
const cuerpo2 = await textoDe("main");
comprobar("responde el motor derivado", /motor claude/i.test(cuerpo2 || ""), (cuerpo2 || "").slice(0, 300));
comprobar("y empieza con contexto limpio (1 turno)", /contexto: 1/.test(cuerpo2 || ""),
  (cuerpo2 || "").slice(0, 400));

console.log("\n=== 7. Volver a una conversación restaura su motor ===");
await evaluar(`
  const filas = [...document.querySelectorAll('aside .group button')];
  const g = filas.find(b => /GEMINI/i.test(b.innerText));
  if (g) g.click();
`);
await esperar(1500);
const trasVolver = await textoDe("main");
const asideVolver = await textoDe("aside");
comprobar("el compositor vuelve a Gemini", /KAI_GEMINI_/.test(trasVolver || ""), (trasVolver || "").slice(-200));
comprobar("el selector vuelve a estar fijado", /FIJADO/i.test(asideVolver || ""), asideVolver?.slice(0, 200));
comprobar("se ven los mensajes de esa conversación",
  /Respuesta simulada del motor gemini/i.test(trasVolver || ""), (trasVolver || "").slice(0, 300));

console.log("\n=== 8. Sin errores de JavaScript ===");
const relevantes = erroresConsola.filter((t) => !/favicon|DevTools/i.test(t));
comprobar("la consola no registró errores", relevantes.length === 0, JSON.stringify(relevantes).slice(0, 500));

console.log("\n" + "=".repeat(60));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${JSON.stringify(fallos)}` : "  (todo correcto)"));
console.log(`\nUsuario a borrar: id ${alta.usuario.id}`);
ws.close();
process.exit(fallos.length ? 1 : 0);
