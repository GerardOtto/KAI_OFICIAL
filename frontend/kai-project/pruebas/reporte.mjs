// Sonda del reporte ejecutivo: composición del PDF y dibujo del bloque de
// gráfico en el chat.
//
// A diferencia del resto, esta necesita el servidor de desarrollo, no la
// aplicación compilada: importa los módulos de origen por su ruta
// (`/src/reportes/…`) para ejercitarlos directamente, sin tener que atravesar la
// interfaz ni un backend.
//
//   npx vite --port 5198 --strictPort
//   KAI_DEV_URL=http://localhost:5198 node pruebas/reporte.mjs
const DEV = process.env.KAI_DEV_URL || "http://localhost:5198";
const CDP = process.env.KAI_CDP_URL || "http://localhost:9222";

const fallos = [];
const comprobar = (nombre, cond, detalle = "") => {
  console.log(`  [${cond ? "OK " : "FALLA"}] ${nombre}` + (!cond && detalle ? ` -> ${detalle}` : ""));
  if (!cond) fallos.push(nombre);
};

const objetivos = await (await fetch(`${CDP}/json/list`)).json();
const ws = new WebSocket(objetivos.find(t => t.type === "page").webSocketDebuggerUrl);
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
/** Evalúa una expresión asíncrona en la página y devuelve su valor. */
const ev = async expr => {
  const r = await cdp("Runtime.evaluate", {
    expression: `(async () => { ${expr} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  const fallo = r.result?.exceptionDetails;
  if (fallo) throw new Error(String(fallo.exception?.description || fallo.text).slice(0, 400));
  return r.result?.result?.value;
};
const esperar = ms => new Promise(r => setTimeout(r, ms));

await cdp("Runtime.enable"); await cdp("Page.enable"); await cdp("Console.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await cdp("Page.navigate", { url: DEV });
await esperar(3000);

// Los módulos se cargan una vez y quedan en `window` para las secciones siguientes.
await ev(`
  window.__kai = {
    grafico: await import('/src/reportes/grafico.js'),
    reporte: await import('/src/reportes/reporteEjecutivo.js'),
  };
  return 1;
`);

console.log("=== 1. Lectura del bloque de gráfico ===");
const g = await ev(`
  const { leerGrafico } = window.__kai.grafico;
  return {
    completo: leerGrafico('titulo: Puntaje\\nunidad: puntos\\ndestacar: PUCV\\nPUCV: 62,3\\nUC: 88.1\\nUCH: 85'),
    conMiles: leerGrafico('A: 1.234\\nB: 2.500'),
    unSoloDato: leerGrafico('titulo: X\\nA: 1'),
    vacio: leerGrafico(''),
    basura: leerGrafico('esto no es un grafico\\nni esto tampoco'),
    dosPuntos: leerGrafico('THE 2024: Teaching: 30\\nTHE 2024: Research: 45'),
    porcentaje: leerGrafico('A: 45 %\\nB: 55 %'),
  };
`);
comprobar("lee tres datos y sus claves",
  g.completo?.datos.length === 3 && g.completo.titulo === "Puntaje" && g.completo.destacar === "PUCV",
  JSON.stringify(g.completo));
comprobar("la coma decimal se interpreta como decimal",
  g.completo?.datos[0].valor === 62.3, JSON.stringify(g.completo?.datos[0]));
comprobar("el punto de millar no se toma por decimal",
  g.conMiles?.datos[0].valor === 1234, JSON.stringify(g.conMiles?.datos));
comprobar("el máximo es el mayor de los valores", g.completo?.maximo === 88.1, g.completo?.maximo);
comprobar("con un solo dato no hay gráfico", g.unSoloDato === null, JSON.stringify(g.unSoloDato));
comprobar("un bloque vacío no produce gráfico", g.vacio === null);
comprobar("un bloque sin cifras no produce gráfico", g.basura === null, JSON.stringify(g.basura));
comprobar("la etiqueta puede llevar dos puntos",
  g.dosPuntos?.datos[0].etiqueta === "THE 2024: Teaching" && g.dosPuntos.datos[0].valor === 30,
  JSON.stringify(g.dosPuntos?.datos));
comprobar("el signo de porcentaje no estorba", g.porcentaje?.datos[0].valor === 45, JSON.stringify(g.porcentaje?.datos));

const d = await ev(`
  const { esDestacada } = window.__kai.grafico;
  return { exacta: esDestacada('PUCV', 'PUCV'),
           contenida: esDestacada('PUCV (Valparaíso)', 'PUCV'),
           conTilde: esDestacada('Pontificia Universidad Católica de Valparaíso', 'valparaiso'),
           ajena: esDestacada('Universidad de Chile', 'PUCV'),
           // «uc» es una subcadena de «pucv»: si la contención no exigiera
           // palabra entera, se resaltaría la institución equivocada.
           trozo: esDestacada('UC', 'PUCV'),
           trozoInverso: esDestacada('PUCV', 'UC'),
           sinPedir: esDestacada('PUCV', '') };
`);
comprobar("destaca por nombre exacto y por contención", d.exacta && d.contenida, JSON.stringify(d));
comprobar("la contención ignora las tildes", d.conTilde, JSON.stringify(d));
comprobar("no destaca a las demás", !d.ajena && !d.sinPedir, JSON.stringify(d));
comprobar("una sigla contenida en otra no cuenta", !d.trozo && !d.trozoInverso, JSON.stringify(d));

console.log("\n=== 2. La consulta como subtítulo ===");
const p = await ev(`
  const { comoPregunta } = window.__kai.reporte;
  return {
    yaPregunta: comoPregunta('¿Qué rankings hay cargados?'),
    sinAbrir: comoPregunta('Qué rankings hay cargados?'),
    sinCerrar: comoPregunta('qué rankings hay cargados'),
    orden: comoPregunta('Compara el índice de citas de la PUCV entre 2019 y 2024.'),
    vacia: comoPregunta('   '),
    larga: comoPregunta('a'.repeat(400)),
    espacios: comoPregunta('  Cómo   se   calcula \\n el puntaje  '),
  };
`);
comprobar("una pregunta completa no se toca", p.yaPregunta === "¿Qué rankings hay cargados?", p.yaPregunta);
comprobar("se completa el signo de apertura", p.sinAbrir === "¿Qué rankings hay cargados?", p.sinAbrir);
comprobar("se cierra la interrogación y se capitaliza", p.sinCerrar === "¿Qué rankings hay cargados?", p.sinCerrar);
// Una instrucción no se deforma en pregunta: el reporte debe dejar constancia de
// lo que el usuario pidió, no de una reinterpretación.
comprobar("una orden se conserva como tal",
  p.orden === "Compara el índice de citas de la PUCV entre 2019 y 2024", p.orden);
comprobar("una consulta vacía no rompe el subtítulo", p.vacia === "Consulta", p.vacia);
comprobar("una consulta larguísima se recorta", p.larga.length <= 220 && p.larga.endsWith("…"), p.larga.length);
comprobar("los espacios sobrantes se colapsan", p.espacios === "¿Cómo se calcula el puntaje?", p.espacios);

console.log("\n=== 2b. Ficha del encabezado y armado de secciones ===");
const cab = await ev(`
  const { datosDeCabecera } = window.__kai.reporte;
  return datosDeCabecera({ fecha: '24 de septiembre de 2026', motor: 'Gemini', nSecciones: 3,
                           usuario: { nombre: 'Gerard Otto', institucion: 'PUCV' } });
`);
console.log("    " + JSON.stringify(cab));
// El título de la conversación lo genera el servidor con la primera consulta, así
// que en la ficha repetía el subtítulo de la sección 01 unas líneas más abajo.
comprobar("la ficha no repite el título de la conversación",
  !cab.some(l => /conversaci/i.test(l)), JSON.stringify(cab));
comprobar("conserva institución, solicitante, asistente y fecha",
  cab.some(l => /Institución: PUCV/.test(l)) && cab.some(l => /Solicitado por: Gerard Otto/.test(l)) &&
  cab.some(l => /Asistente: Gemini/.test(l)) && cab.some(l => /Emitido:/.test(l)), JSON.stringify(cab));
comprobar("concuerda el número de consultas", cab.some(l => l === "3 consultas"), JSON.stringify(cab));

const sec = await ev(`
  const { secciones } = window.__kai.reporte;
  const u = (id, c) => ({ id, role: 'user', content: c, time: '10:00' });
  const a = (id, c) => ({ id, role: 'assistant', content: c, time: '10:00' });
  return {
    normal: secciones([u(1,'P1'), a(2,'R1'), u(3,'P2'), a(4,'R2')])
      .map(s => ({ p: s.pregunta, r: s.respuestas.map(x => x.content) })),
    // Una respuesta sin su pregunta delante: era el síntoma del defecto del chat,
    // donde un turno fallido borraba las preguntas ya respondidas de la sesión.
    huerfana: secciones([a(1,'R1'), a(2,'R2'), u(3,'P3'), a(4,'R3')])
      .map(s => ({ p: s.pregunta, r: s.respuestas.map(x => x.content) })),
    // Una pregunta sin responder todavía no abre sección en el reporte.
    pendiente: secciones([u(1,'P1'), a(2,'R1'), u(3,'P2')]).length,
  };
`);
comprobar("cada respuesta queda bajo su propia pregunta",
  JSON.stringify(sec.normal) === JSON.stringify([{ p: "P1", r: ["R1"] }, { p: "P2", r: ["R2"] }]),
  JSON.stringify(sec.normal));
comprobar("dos respuestas seguidas sin pregunta se agrupan y se marcan como tales",
  sec.huerfana.length === 2 && sec.huerfana[0].p === "" && sec.huerfana[0].r.length === 2,
  JSON.stringify(sec.huerfana));
comprobar("una consulta sin respuesta no abre sección", sec.pendiente === 1, String(sec.pendiente));

console.log("\n=== 3. Composición del PDF ===");
const RESPUESTA = [
  "La **PUCV** ocupa el tercer lugar entre las instituciones chilenas en QS Latam 2024.",
  "",
  "## Posición comparada",
  "",
  "| Institución | Puntaje | Posición |",
  "| --- | ---: | ---: |",
  "| UC | 88,1 | 1 |",
  "| UCH | 85,0 | 2 |",
  "| PUCV | 62,3 | 3 |",
  "",
  "```kai-grafico",
  "titulo: Puntaje total en QS Latam, 2024",
  "unidad: puntos",
  "destacar: PUCV",
  "UC: 88.1",
  "UCH: 85",
  "PUCV: 62.3",
  "```",
  "",
  "### Lo que mueve la diferencia",
  "",
  "- La **reputación académica** pesa un 30 % y explica la mayor parte de la brecha.",
  "- El indicador `Citations per paper` es el más favorable a la PUCV.",
  "",
  "> La comparación usa la edición 2024, la última cargada.",
].join("\n");

const pdf = await ev(`
  const { construirReporte } = window.__kai.reporte;
  const mensajes = [
    { id: 1, role: 'user', content: '¿Cómo le fue a la PUCV en QS Latam 2024?', time: '10:00' },
    { id: 2, role: 'assistant', content: ${JSON.stringify(RESPUESTA)}, time: '10:00' },
  ];
  const doc = await construirReporte({ mensajes, conversacion: 'QS Latam 2024',
    usuario: { nombre: 'Gerard Otto', institucion: 'PUCV' }, motor: 'Claude' });
  const salida = doc.output();
  return { paginas: doc.getNumberOfPages(), cabecera: salida.slice(0, 8), bytes: salida.length };
`);
comprobar("el documento se compone sin errores", pdf.paginas >= 1, JSON.stringify(pdf));
comprobar("la salida es un PDF válido", pdf.cabecera.startsWith("%PDF-"), pdf.cabecera);
comprobar("una respuesta con tabla y gráfico cabe en una página", pdf.paginas === 1, pdf.paginas);
comprobar("el archivo es liviano (menos de 400 kB)", pdf.bytes < 400_000, pdf.bytes);

const largo = await ev(`
  const { construirReporte } = window.__kai.reporte;
  const parrafo = 'La evolución del indicador muestra un avance sostenido en el período analizado. '.repeat(12);
  const mensajes = [];
  for (let i = 0; i < 8; i++) {
    mensajes.push({ id: i * 2, role: 'user', content: 'Consulta número ' + (i + 1) + ' sobre el ranking', time: '10:00' });
    mensajes.push({ id: i * 2 + 1, role: 'assistant', content: parrafo, time: '10:00' });
  }
  const doc = await construirReporte({ mensajes, conversacion: 'Larga' });
  return doc.getNumberOfPages();
`);
comprobar("una conversación larga se reparte en varias páginas", largo >= 3, largo);

// Entradas degeneradas: lo que llega de un modelo no siempre está bien formado, y
// un reporte que falla al componerse deja al usuario sin salida.
const raros = await ev(`
  const { construirReporte } = window.__kai.reporte;
  const casos = [
    '',
    '| sin | cerrar\\n| --- |',
    '\`\`\`kai-grafico\\nbasura sin cifras\\n\`\`\`',
    '# '.repeat(50),
    'Palabra ' + 'x'.repeat(400),
    '- a\\n  - b\\n    - c\\n      - d',
  ];
  const resultados = [];
  for (const caso of casos) {
    try {
      const doc = await construirReporte({ mensajes: [
        { id: 1, role: 'user', content: 'Caso', time: '10:00' },
        { id: 2, role: 'assistant', content: caso, time: '10:00' }] });
      resultados.push(doc.getNumberOfPages());
    } catch (e) { resultados.push('ERROR: ' + e.message); }
  }
  return resultados;
`);
comprobar("ninguna entrada degenerada rompe la composición",
  raros.every(r => typeof r === "number" && r >= 1), JSON.stringify(raros));

const sinRespuestas = await ev(`
  const { construirReporte } = window.__kai.reporte;
  try {
    await construirReporte({ mensajes: [{ id: 1, role: 'user', content: 'Hola', time: '10:00' }] });
    return 'no avisó';
  } catch (e) { return e.message; }
`);
comprobar("sin respuestas del asistente se avisa en vez de emitir un PDF vacío",
  /no hay respuestas/i.test(sinRespuestas), sinRespuestas);

console.log("\n=== 4. El gráfico en el chat ===");
await ev(`
  const { montar } = await import('/pruebas/montar_markdown.jsx');
  const texto = [
    'Comparación de puntajes:',
    '',
    '\`\`\`kai-grafico',
    'titulo: Puntaje total',
    'unidad: puntos',
    'destacar: PUCV',
    'UC: 88.1',
    'PUCV: 62.3',
    '\`\`\`',
    '',
    '\`\`\`kai-grafico',
    'esto no tiene cifras',
    '\`\`\`',
    '',
    '\`\`\`sql',
    'SELECT 1;',
    '\`\`\`',
  ].join('\\n');
  montar(texto);
  return 1;
`);
await esperar(600);

const dibujo = await ev(`
  const caja = document.getElementById('prueba-markdown');
  const figuras = [...caja.querySelectorAll('figure')];
  const barras = figuras[0] ? [...figuras[0].querySelectorAll('div[style*="width"]')] : [];
  return {
    figuras: figuras.length,
    titulo: figuras[0]?.querySelector('figcaption')?.innerText || null,
    texto: figuras[0]?.innerText.replace(/\\n/g, ' | ') || null,
    anchos: barras.map(b => b.style.width),
    colores: barras.map(b => b.style.backgroundColor),
    preformateados: caja.querySelectorAll('pre').length,
  };
`);
console.log("    " + JSON.stringify(dibujo));
comprobar("el bloque válido se dibuja como figura, no como código", dibujo.figuras === 1, JSON.stringify(dibujo));
comprobar("la figura lleva su título", dibujo.titulo === "Puntaje total", dibujo.titulo);
comprobar("aparecen las etiquetas y sus cifras",
  /UC/.test(dibujo.texto) && /88,1/.test(dibujo.texto) && /62,3/.test(dibujo.texto), dibujo.texto);
comprobar("la barra mayor ocupa todo el ancho", dibujo.anchos[0] === "100%", JSON.stringify(dibujo.anchos));
comprobar("las barras son proporcionales al valor",
  Math.abs(parseFloat(dibujo.anchos[1]) - (62.3 / 88.1) * 100) < 0.5, JSON.stringify(dibujo.anchos));
comprobar("la institución destacada se distingue por color",
  dibujo.colores[0] !== dibujo.colores[1], JSON.stringify(dibujo.colores));
// El bloque mal formado y el SQL siguen siendo bloques de código.
comprobar("un bloque de gráfico ilegible se muestra como código", dibujo.preformateados === 2, dibujo.preformateados);

console.log("\n=== 5. Consola ===");
const relevantes = errores.filter(t => !/favicon|DevTools|Failed to load resource/i.test(t));
comprobar("sin errores de JavaScript", relevantes.length === 0, JSON.stringify(relevantes).slice(0, 400));

await cdp("Emulation.clearDeviceMetricsOverride");
console.log("\n" + "=".repeat(64));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${JSON.stringify(fallos)}` : "  (todo correcto)"));
ws.close();
process.exit(fallos.length ? 1 : 0);
