// Sonda de las consultas guiadas: los informes de brechas que el chat pide con
// un botón (`src/components/asistente/consultasGuiadas.js`).
//
// Como `reporte`, importa los módulos de origen, así que necesita el servidor de
// desarrollo y no la aplicación compilada:
//
//   npx vite --port 5198 --strictPort
//   KAI_DEV_URL=http://localhost:5198 node pruebas/consultas_guiadas.mjs
//
// Las consultas SQL se verifican contra la base en el backend (batería
// `consultas-guiadas`); aquí, lo que ve el usuario: la pregunta sin las
// instrucciones, las negritas del informe en el chat y el reporte PDF.
const DEV = process.env.KAI_DEV_URL || "http://localhost:5198";
const CDP = process.env.KAI_CDP_URL || "http://localhost:9222";

const fallos = [];
const comprobar = (nombre, cond, detalle = "") => {
  console.log(`  [${cond ? "OK " : "FALLA"}] ${nombre}` + (!cond && detalle ? ` -> ${detalle}` : ""));
  if (!cond) fallos.push(nombre);
};

const objetivos = await (await fetch(`${CDP}/json/list`)).json();
// Un perfil nuevo de Edge abre páginas internas (edge://…): la sonda va a la pestaña.
const ws = new WebSocket(objetivos.find(t => t.type === "page" && !t.url.startsWith("edge://")).webSocketDebuggerUrl);
await new Promise(r => (ws.onopen = r));
let id = 0; const pendientes = new Map();
const errores = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
  if (m.method === "Console.messageAdded" && m.params.message.level === "error") errores.push(m.params.message.text);
};
const cdp = (method, params = {}) => {
  const n = ++id;
  ws.send(JSON.stringify({ id: n, method, params }));
  return new Promise(r => pendientes.set(n, r));
};
const ev = async expr => {
  const r = await cdp("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  const fallo = r.result?.exceptionDetails;
  if (fallo) throw new Error(String(fallo.exception?.description || fallo.text).slice(0, 400));
  return r.result?.result?.value;
};
const esperar = ms => new Promise(r => setTimeout(r, ms));

await cdp("Runtime.enable"); await cdp("Page.enable"); await cdp("Console.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await cdp("Page.navigate", { url: DEV });
await esperar(3000);
await ev(`
  window.__kai = {
    guiadas: await import('/src/components/asistente/consultasGuiadas.js'),
    reporte: await import('/src/reportes/reporteEjecutivo.js'),
  };
  return 1;
`);

console.log("=== 1. Lo que ve el usuario de cada botón ===");
const m = await ev(`
  const g = window.__kai.guiadas;
  return {
    consultas: g.CONSULTAS_GUIADAS.map(c => {
      const mensaje = g.construirMensaje(c);
      return { id: c.id, pregunta: c.pregunta, visible: g.parteVisible(mensaje),
               detectada: g.consultaDeMensaje(mensaje)?.id, conSql: mensaje.includes('WITH inst AS'),
               titulo: g.tituloDeInforme(c) };
    }),
    normal: g.parteVisible('¿Qué rankings hay cargados?'),
    normalDetectada: g.consultaDeMensaje('¿Qué rankings hay cargados?'),
    vacio: g.parteVisible(null),
  };
`);
comprobar("hay cuatro botones: QS, THE, Scimago y KAI",
  m.consultas.map(c => c.id).join() === "brechas-qs,brechas-the,brechas-scimago,brechas-kai",
  JSON.stringify(m.consultas.map(c => c.id)));
for (const c of m.consultas) {
  comprobar(`${c.id}: se ve solo la pregunta`, c.visible === c.pregunta, JSON.stringify(c.visible));
  comprobar(`${c.id}: el mensaje lleva la consulta y se reconoce`, c.conSql && c.detectada === c.id);
  comprobar(`${c.id}: la pregunta empieza por el ranking y cabe en el título`,
    c.pregunta.length <= 60 && /^(QS|THE|Scimago|Ranking KAI)\b/.test(c.pregunta), c.pregunta);
}
comprobar("un mensaje escrito a mano se muestra entero y no se toma por guiado",
  m.normal === "¿Qué rankings hay cargados?" && m.normalDetectada === null && m.vacio === "");

console.log("\n=== 2. Negritas del informe en el chat ===");
// Dos negritas en una línea eran el caso que la corrección de «** texto **»
// rompía: borraba los espacios entre ellas.
await ev(`
  const { montar } = await import('/pruebas/montar_markdown.jsx');
  montar([
    '1. **Impacto normalizado** (influencia alta, 13 %): pasar de 0,91 a **1,15** (un 27 % más que hoy).',
    '',
    'Esto es ** mal escrita ** y esto **bien**.',
    '',
    '> **Cómo leer este informe**',
    '> **Hoy:** la cifra real.',
    '> **Lugar:** su posición.',
    '',
    '| Métrica | Hoy |',
    '|---|---:|',
    '| Impacto normalizado · **prioridad 1** | 0,91 |',
  ].join('\\n'));
  return 1;
`);
await esperar(600);
const md = await ev(`
  const caja = document.getElementById('prueba-markdown');
  return { texto: caja.innerText, negritas: [...caja.querySelectorAll('strong')].map(e => e.innerText),
           citas: caja.querySelectorAll('blockquote').length,
           saltosEnCita: caja.querySelectorAll('blockquote br').length };
`);
comprobar("los espacios entre dos negritas se conservan",
  md.texto.includes("Impacto normalizado (influencia alta, 13 %): pasar de 0,91 a 1,15 (un 27 %"), md.texto.slice(0, 200));
comprobar("«** texto **» se sigue corrigiendo", md.negritas.includes("mal escrita"), JSON.stringify(md.negritas));
comprobar("no quedan asteriscos a la vista", !/\*\*/.test(md.texto), md.texto.slice(0, 300));
comprobar("el recuadro «Cómo leer» es una sola cita, renglón a renglón",
  md.citas === 1 && md.saltosEnCita >= 2, JSON.stringify(md));

console.log("\n=== 3. El reporte PDF de un informe de brechas ===");
const INFORME = [
  "> **Cómo leer este informe**",
  "> **Hoy:** la cifra real de la universidad: un porcentaje, una cantidad o una razón, según la métrica.",
  "> **Lugar:** su posición entre las 57 universidades chilenas de Scimago 2023 en cada métrica (el 1.º es el mejor).",
  "> **Influencia:** cuánto pesa la métrica en el puntaje total del ranking: alta (10 % o más), media (5 % a 10 %) o baja.",
  "> **Metas:** la cifra que hoy tiene la universidad ubicada en ese lugar. Alcanzarla permitiría llegar ahí.",
  "> **Prioridad:** las dos métricas que más pueden subir su puntaje total.",
  "",
  ...["Pontificia Universidad Católica de Valparaíso (PUCV): 9.º de 57 en Chile",
      "Universidad de Valparaíso (UV): 13.º de 57 en Chile"].flatMap(titulo => [
    `## ${titulo}`,
    "",
    "Sus métricas más bajas, de la más rezagada a la menos.",
    "",
    "| Métrica | Hoy | Lugar | Influencia | Meta: mitad | Meta: top 10 |",
    "|---|---:|---:|---|---:|---:|",
    "| Acceso abierto | 67,8 % | 34.º de 57 | Baja (2 %) | 73,0 % (17.º) | 77,8 % |",
    "| Impacto normalizado · **prioridad 1** | 0,91 | 28.º de 57 | Alta (13 %) | 1,09 (14.º) | 1,15 |",
    "| Impacto tecnológico · **prioridad 2** | 0,90 % | 16.º de 57 | Alta (10 %) | — | 1,15 % |",
    "| Patentes | 13 | 15.º de 57 | Alta (10 %) | — | 17 |",
    "| Conocimiento innovador | 18 | 15.º de 57 | Alta (10 %) | — | 35 |",
    "",
    "**Dónde enfocarse**",
    "",
    "1. **Impacto normalizado** (influencia alta, 13 %): pasar de 0,91 a **1,15** (un 27 % más que hoy) la dejaría en el top 10 de esa métrica.",
    "2. **Impacto tecnológico** (influencia alta, 10 %): pasar de 0,90 % a **1,15 %** (un 28 % más que hoy) la dejaría en el top 10 de esa métrica.",
    "",
  ]),
  "**Qué mide cada métrica**",
  "",
  ...Array.from({ length: 7 }, (_, i) => `- **Métrica ${i + 1}:** lo que mide, explicado en una frase.`),
  "",
  "*Fuente: SCImago Institutions Rankings 2023 (datos de Scopus), la edición más reciente cargada en KAI.*",
].join("\n");

const pdf = await ev(`
  const { construirMensaje, CONSULTAS_GUIADAS } = window.__kai.guiadas;
  const { construirReporte } = window.__kai.reporte;
  const scimago = CONSULTAS_GUIADAS.find(c => c.id === 'brechas-scimago');
  const doc = await construirReporte({
    mensajes: [
      { id: 1, role: 'user', content: construirMensaje(scimago), time: '10:00' },
      { id: 2, role: 'assistant', content: ${JSON.stringify(INFORME)}, time: '10:00' },
    ],
    conversacion: scimago.pregunta, usuario: { nombre: 'Sonda', institucion: 'PUCV' }, motor: 'Gemini' });
  const salida = doc.output();
  // jsPDF escribe los párrafos y títulos palabra por palabra, «(palabra) Tj»,
  // y las celdas y la portada, línea por línea.
  const paginas = [];
  for (let p = 1; p <= doc.getNumberOfPages(); p += 1) paginas.push(doc.internal.pages[p].join('\\n'));
  const palabra = t => '(' + t + ') Tj';
  const enQuePagina = t => paginas.findIndex(c => c.includes(t));
  // «13.º» solo está en el título de la UV: las filas de la tabla dicen «15.º de 57».
  const tituloUV = enQuePagina(palabra('13.º'));
  return {
    paginas: doc.getNumberOfPages(), cabecera: salida.slice(0, 8),
    titulo: salida.includes(palabra('Informe de brechas: PUCV y UV en Scimago')),
    rankingUsado: salida.includes('RANKING USADO:'),
    subtitulo: salida.includes(palabra('Scimago:')) && salida.includes(palabra('¿dónde')),
    dobleApertura: salida.includes(palabra('¿Scimago:')),
    fuga: ['SELECT', 'WITH', 'Paso', 'Instrucciones'].some(t => salida.includes(palabra(t)))
          || salida.includes('kai:instrucciones'),
    tituloUV,
    primeraFilaUV: paginas.findIndex((c, i) => i >= tituloUV && c.includes(palabra('Acceso abierto'))),
    ultimaFilaUV: paginas.findLastIndex(c => c.includes(palabra('Conocimiento innovador'))),
  };
`);
console.log("    " + JSON.stringify(pdf));
comprobar("el documento es un PDF válido", pdf.cabecera.startsWith("%PDF-"), pdf.cabecera);
comprobar("se titula como el informe de su ranking", pdf.titulo);
comprobar("y lleva el logotipo del ranking usado", pdf.rankingUsado);
comprobar("el subtítulo es la pregunta visible, con un solo signo de apertura",
  pdf.subtitulo && !pdf.dobleApertura, JSON.stringify(pdf));
comprobar("ni el SQL ni las instrucciones llegan al PDF", !pdf.fuga);
comprobar("cabe en dos páginas", pdf.paginas <= 2, pdf.paginas);
comprobar("la tabla de la UV no se parte: empieza en la página de su título y termina en ella",
  pdf.tituloUV >= 0 && pdf.primeraFilaUV === pdf.tituloUV && pdf.ultimaFilaUV === pdf.tituloUV,
  JSON.stringify(pdf));

console.log("\n=== 4. Consola ===");
const relevantes = errores.filter(t => !/favicon|DevTools|Failed to load resource|ERR_CONNECTION_REFUSED/i.test(t));
comprobar("sin errores de JavaScript", relevantes.length === 0, JSON.stringify(relevantes).slice(0, 400));

await cdp("Emulation.clearDeviceMetricsOverride");
console.log("\n" + "=".repeat(64));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${JSON.stringify(fallos)}` : "  (todo correcto)"));
ws.close();
process.exit(fallos.length ? 1 : 0);
