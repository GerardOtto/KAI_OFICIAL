// Sonda de los informes PDF de los módulos: Tendencias, Simulación, Glosario y
// Resumen.
//
// Como la del reporte del asistente, importa los módulos de origen desde el
// servidor de desarrollo y compone cada informe con datos sintéticos, sin
// atravesar la interfaz ni un backend:
//
//   npx vite --port 5198 --strictPort
//   KAI_DEV_URL=http://localhost:5198 node pruebas/informes.mjs
//
// Lo que verifica es lo que se rompió o se quiso evitar al rehacerlos: que se
// compongan con cualquier entrada razonable, que abran con cifras clave y una
// lectura, que no vuelquen todos los datos (el detalle va a la exportación) y
// que ningún carácter fuera de la fuente del PDF salga como basura.
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
const ev = async expr => {
  const r = await cdp("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  const fallo = r.result?.exceptionDetails;
  if (fallo) throw new Error(String(fallo.exception?.description || fallo.text).slice(0, 400));
  return r.result?.result?.value;
};
const esperar = ms => new Promise(r => setTimeout(r, ms));

await cdp("Runtime.enable"); await cdp("Page.enable"); await cdp("Console.enable");
await cdp("Page.navigate", { url: DEV });
await esperar(3000);

// Módulos y un conjunto de datos de ejemplo, cargados una vez en la página.
// `resumen(doc)` devuelve lo que se comprueba de cada documento: páginas,
// cabecera, tamaño y el texto de sus flujos (las fuentes estándar lo dejan
// legible en la salida, entre paréntesis).
await ev(`
  const doc = await import('/src/reportes/documento.js');
  window.__kai = {
    doc,
    tendencias: await import('/src/reportes/informeTendencias.js'),
    simulacion: await import('/src/reportes/informeSimulacion.js'),
    glosario: await import('/src/reportes/informeGlosario.js'),
    resumen: await import('/src/reportes/informeResumen.js'),
  };
  window.__kai.leer = (d) => {
    const salida = d.output();
    const texto = [...salida.matchAll(/\\((.*?)\\) Tj/g)].map(m => m[1]).join(' ');
    // Imágenes incrustadas: el logotipo de KAI y, si lo hay, el del ranking.
    const imagenes = (salida.match(/\\/Subtype \\/Image/g) || []).length;
    return { paginas: d.getNumberOfPages(), cabecera: salida.slice(0, 5), bytes: salida.length, texto, imagenes };
  };
  const usuario = { nombre: 'Sonda', institucion: 'Universidad Propia' };
  const nombres = ['Universidad Propia', 'Universidad Norte', 'Universidad Sur', 'Universidad Este', 'Universidad Oeste'];
  window.__kai.datos = {
    usuario,
    evolucion: {
      vista: 'evolucion', ranking: 'THE Latam', disciplina: null, numerico: false, unidad: null,
      metrica: { nombre: 'Docencia', peso: 30 }, anosProyeccion: 3, foco: 1, usuario,
      series: nombres.map((nombre, i) => ({
        id: i + 1, nombre, color: '#60aaf3',
        // La segunda crece tan rápido que su recta pasaría de 100.
        puntos: [2019, 2020, 2021, 2022, 2023, 2024].map((x, k) => ({ x, y: i === 1 ? 50 + k * 8 : 30 + i * 8 + k * (i - 2) })),
      })),
    },
    anual: {
      vista: 'anual', ranking: 'Ranking de prueba', anio: 2024, numerico: false, foco: 1, usuario,
      metricas: ['Docencia', 'Investigación', 'Citas', 'Industria', 'Internacional', 'Reputación', 'Séptima']
        .map((nombre, i) => ({ id: i + 1, nombre, peso: 10 })),
      instituciones: nombres.map((nombre, i) => ({ id: i + 1, nombre })),
      valores: Object.fromEntries(nombres.map((_, i) => [i + 1, Object.fromEntries(
        [1, 2, 3, 4, 5, 6, 7].map(m => [m, { valor: 20 + ((i * 7 + m * 11) % 70), techo: 90 }]))])),
    },
  };
  return 1;
`);

console.log("=== 1. Caracteres fuera de la fuente ===");
const saneado = await ev(`
  const { sanearTexto, crearDocumento } = window.__kai.doc;
  const { doc } = await crearDocumento({ titulo: 'x' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  return {
    texto: sanearTexto('−3 → 5 ▲2 ▼1 Δ2024 ≈ 4 ✓ 🎓 ñandú «ok» — “sí” …'),
    anchoFlecha: doc.getTextWidth('→') === doc.getTextWidth('»'),
  };
`);
comprobar("el menos, las flechas y la delta se sustituyen por equivalentes de la fuente",
  saneado.texto === "–3 » 5 +2 –1 Var.2024 ~ 4 Sí  ñandú «ok» — “sí” …", saneado.texto);
comprobar("y el documento mide el texto ya sustituido", saneado.anchoFlecha);

console.log("\n=== 1b. Logotipo del ranking ===");
const logos = await ev(`
  const { logoDeRanking } = window.__kai.doc;
  const n = ['THE Latam', 'QS Latam', 'QS Global', 'QS por Disciplina', 'Scimago Latam', 'Shanghai GRAS',
             'Shanghai ARWU', 'Ranking KAI', 'Ranking inventado'];
  return Object.fromEntries(n.map(x => [x, logoDeRanking(x)]));
`);
comprobar("cada familia tiene su logotipo",
  ["THE Latam", "QS Latam", "Scimago Latam", "Shanghai GRAS", "Ranking KAI"].every(n => logos[n]), JSON.stringify(logos));
comprobar("los tres de QS usan el mismo",
  logos["QS Latam"] === logos["QS Global"] && logos["QS Global"] === logos["QS por Disciplina"]);
comprobar("GRAS y ARWU usan el de ShanghaiRanking", logos["Shanghai GRAS"] === logos["Shanghai ARWU"]);
comprobar("un ranking desconocido no toma el de otro", logos["Ranking inventado"] === null);

console.log("\n=== 2. Tendencias ===");
const evol = await ev(`
  const { construirInformeTendencias } = window.__kai.tendencias;
  const { doc } = await construirInformeTendencias(window.__kai.datos.evolucion);
  return window.__kai.leer(doc);
`);
comprobar("la evolución se compone y es un PDF", evol.cabecera === "%PDF-", evol.cabecera);
comprobar("abre con cifras clave y una lectura", /Cifras clave/.test(evol.texto) && /Lectura/.test(evol.texto));
comprobar("lleva el gráfico y una fila por institución", /Evoluci/.test(evol.texto) && /Resumen por instituci/.test(evol.texto));
comprobar("cabe en dos páginas", evol.paginas <= 2, evol.paginas);
// Sin acotar, la recta de la segunda serie (90 en 2024) llegaría a 114 en 2027.
comprobar("la proyección de un puntaje no pasa de 100",
  !/\b(10[1-9]|1[1-9]\d)(,\d+)?\b/.test(evol.texto) && /Proy\./.test(evol.texto));
comprobar("liviano (menos de 250 kB)", evol.bytes < 250_000, evol.bytes);
comprobar("en la portada, «Ranking usado:» con su logotipo en vez de la fila «Ranking:»",
  /RANKING USADO:/.test(evol.texto) && !/RANKING: /.test(evol.texto) && evol.imagenes >= 2, `imágenes: ${evol.imagenes}`);

const anual = await ev(`
  const { construirInformeTendencias } = window.__kai.tendencias;
  const { doc } = await construirInformeTendencias(window.__kai.datos.anual);
  return window.__kai.leer(doc);
`);
comprobar("la comparación anual se compone", anual.cabecera === "%PDF-" && anual.paginas <= 3, anual.paginas);
comprobar("muestra a lo sumo seis métricas y lo dice", /primeras 6 de 7/.test(anual.texto) && !/Séptima/.test(anual.texto));

const sinDatos = await ev(`
  const { construirInformeTendencias } = window.__kai.tendencias;
  try { await construirInformeTendencias({ ...window.__kai.datos.evolucion, series: [] }); return 'no avisó'; }
  catch (e) { return e.message; }
`);
comprobar("sin datos avisa en vez de emitir un PDF vacío", /No hay datos/.test(sinDatos), sinDatos);

console.log("\n=== 3. Simulación ===");
const unitaria = await ev(`
  const { construirInformeSimulacion } = window.__kai.simulacion;
  const metricas = Array.from({ length: 12 }, (_, i) => ({
    nombre: 'Métrica ' + (i + 1), peso: 12 - i, base: 40 + i, simulado: i < 2 ? 70 + i : 40 + i,
    efecto: i < 2 ? ((30) * (12 - i)) / 100 : 0, modificada: i < 2,
  }));
  const { doc } = await construirInformeSimulacion({
    tipo: 'unitaria', cifras: false, usuario: window.__kai.datos.usuario,
    ranking: 'Ranking de prueba', anio: 2024, institucion: 'Universidad Propia',
    base: { posicion: 9, score: 41.2 }, simulado: { posicion: 6, score: 47.8 }, total: 30,
    metricas, superadas: ['Universidad Norte', 'Universidad Sur'], perdidas: [],
    siguiente: { nombre: 'Universidad Este', brecha: 1.4 },
  });
  return window.__kai.leer(doc);
`);
comprobar("la unitaria se compone", unitaria.cabecera === "%PDF-" && unitaria.paginas <= 2, unitaria.paginas);
// Filas de la tabla de ajustes: «Métrica N  peso %  base  simulado».
const filasAjuste = unitaria.texto.match(/Métrica \d+ \d+ %/g) || [];
comprobar("la tabla de ajustes lleva solo las métricas movidas",
  filasAjuste.length === 2 && !/Métrica 12\b/.test(unitaria.texto), JSON.stringify(filasAjuste));
comprobar("dice dónde rinde más mejorar", /rinde m/.test(unitaria.texto));
comprobar("sin flechas ni signos fuera de la fuente", !/!'|%¼|%²/.test(unitaria.texto));

const comparada = await ev(`
  const { construirInformeSimulacion } = window.__kai.simulacion;
  const inst = ['Universidad Propia', 'Universidad Norte', 'Universidad Sur'].map((nombre, i) => ({
    id: i + 1, nombre, scoreBase: 50 - i * 5, scoreSim: 50 - i * 5, posBase: i + 1, posSim: i + 1, modificada: false,
  }));
  const { doc } = await construirInformeSimulacion({
    tipo: 'comparada', cifras: false, usuario: window.__kai.datos.usuario, foco: 1,
    ranking: 'Ranking de prueba', anio: 2024, instituciones: inst, cambios: [],
  });
  return window.__kai.leer(doc);
`);
comprobar("una comparada sin cambios se compone y lo dice",
  comparada.cabecera === "%PDF-" && /No se modific/.test(comparada.texto), comparada.texto.slice(0, 160));

console.log("\n=== 4. Glosario ===");
const glosario = await ev(`
  const { construirInformeGlosario } = window.__kai.glosario;
  const rankings = [{ id: 1, nombre: 'Ranking A' }, { id: 2, nombre: 'Ranking B' }, { id: 3, nombre: 'Ranking C', restringido: true }];
  const dimensiones = ['Docencia', 'Investigación', 'Reputación', 'Internacional', 'Innovación'].map((nombre, i) => ({
    nombre,
    celdas: Object.fromEntries(rankings.filter((_, j) => (i + j) % 2 === 0 || i === 0)
      .map(r => [r.id, { peso: 10 + i * 5, multi: r.id === 2, soloReferencia: i === 4 && r.id === 1, valor: null }])),
  }));
  const conValores = dimensiones.map(d => ({ ...d, celdas: Object.fromEntries(Object.entries(d.celdas)
    .map(([k, c]) => [k, { ...c, valor: 55.5 }])) }));
  const base = { rankings, totalMetricas: 1249, usuario: window.__kai.datos.usuario, numerico: false };
  const sin = window.__kai.leer((await construirInformeGlosario({ ...base, dimensiones })).doc);
  const con = window.__kai.leer((await construirInformeGlosario({ ...base, dimensiones: conValores,
    institucion: 'Universidad Propia', anio: 2024 })).doc);
  return { sin, con };
`);
comprobar("se compone con la matriz de pesos", glosario.sin.cabecera === "%PDF-" && /Matriz de pesos/.test(glosario.sin.texto));
comprobar("abarca varios rankings: no dice «Ranking usado»", !/RANKING USADO/.test(glosario.sin.texto));
comprobar("no vuelca las métricas una por una: cabe en dos páginas", glosario.sin.paginas <= 2, glosario.sin.paginas);
comprobar("sin valores de la institución, no agrega una matriz en blanco", !/Valores de/.test(glosario.sin.texto));
comprobar("con institución y año, agrega sus valores", /Valores de Universidad Propia en 2024/.test(glosario.con.texto));
comprobar("explica la marca de los multidisciplinarios y la de referencia",
  /multidisciplinario/.test(glosario.sin.texto) && /ref/.test(glosario.sin.texto));

console.log("\n=== 5. Resumen ===");
const resumen = await ev(`
  const { construirInformeResumen } = window.__kai.resumen;
  const filas = Array.from({ length: 58 }, (_, i) => ({
    id: i + 1, nombre: 'Universidad ' + (i + 1), pais: 'Chile', score: 90 - i, delta: (i % 5) - 2,
  }));
  const { doc } = await construirInformeResumen({
    ranking: 'Ranking de prueba', anio: 2024, anioAnterior: 2023, descripcion: 'Metodología de prueba.',
    filas, foco: 40, usuario: window.__kai.datos.usuario, numerico: false,
    pesos: [{ nombre: 'Docencia', peso: 50, parte: 50 }, { nombre: 'Citas', peso: 50, parte: 50 }], pesosPropios: true,
  });
  return window.__kai.leer(doc);
`);
comprobar("se compone", resumen.cabecera === "%PDF-", resumen.cabecera);
comprobar("la tabla se acota a 25 filas y suma la institución propia",
  /primeras 25 de 58, más la institución propia/.test(resumen.texto) && !/Universidad 30 /.test(resumen.texto)
  && /Universidad 40 /.test(resumen.texto));
comprobar("con pesos propios, los informa", /Pesos usados/.test(resumen.texto));
comprobar("cabe en tres páginas", resumen.paginas <= 3, resumen.paginas);

console.log("\n=== 6. Consola ===");
comprobar("la consola no registró errores", errores.length === 0, JSON.stringify(errores).slice(0, 300));

console.log("\n" + "=".repeat(64));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${JSON.stringify(fallos)}` : "  (todo correcto)"));
ws.close();
process.exit(fallos.length ? 1 : 0);
