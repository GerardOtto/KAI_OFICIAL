// Sonda de la aparición progresiva de la respuesta y del indicador de espera.
//
// Como la del reporte, necesita el servidor de desarrollo: importa los módulos
// de origen por su ruta para ejercitarlos sin atravesar la interfaz ni el
// backend, y monta los componentes del chat en una caja suelta.
//
//   npx vite --port 5198 --strictPort
//   KAI_DEV_URL=http://localhost:5198 node pruebas/revelado.mjs
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

await ev(`
  window.__kai = { revelado: await import('/src/components/asistente/revelado.js') };
  return 1;
`);

console.log("=== 1. Cortes y duración ===");
const ritmo = await ev(`
  const { cortes, duracion, DURACION_MINIMA, DURACION_MAXIMA } = window.__kai.revelado;
  const frase = 'una dos tres';
  const largo = 'palabra '.repeat(400);
  return {
    frase: cortes(frase),
    finalFrase: cortes(frase).at(-1) === frase.length,
    vacio: cortes(''),
    // Ningún corte debe caer dentro de una palabra: el trozo visible termina
    // siempre en un carácter que no es espacio.
    sinPartir: cortes(frase).every(n => n === 0 || /\\S/.test(frase[n - 1])),
    corta: duracion(cortes('hola mundo').length),
    larga: duracion(cortes(largo).length),
    media: duracion(60),
    minima: DURACION_MINIMA,
    maxima: DURACION_MAXIMA,
  };
`);
console.log("    " + JSON.stringify(ritmo));
comprobar("corta por palabras, no por letras", JSON.stringify(ritmo.frase) === "[3,7,12]", JSON.stringify(ritmo.frase));
comprobar("el último corte es el texto entero", ritmo.finalFrase === true);
comprobar("un texto vacío tiene un único corte", JSON.stringify(ritmo.vacio) === "[0]", JSON.stringify(ritmo.vacio));
comprobar("ningún corte parte una palabra", ritmo.sinPartir === true);
comprobar("una respuesta breve dura lo mínimo", ritmo.corta === ritmo.minima, ritmo.corta);
comprobar("una respuesta larga no supera el máximo", ritmo.larga === ritmo.maxima, ritmo.larga);
comprobar("entre medias el ritmo es proporcional",
  ritmo.media > ritmo.minima && ritmo.media < ritmo.maxima, ritmo.media);

console.log("\n=== 2. Recorte del marcado a medias ===");
const recorte = await ev(`
  const { recorteSeguro } = window.__kai.revelado;
  return {
    plano: recorteSeguro('La PUCV sube dos puestos.'),
    cercaAbierta: recorteSeguro('Comparativa:\\n\\n\\u0060\\u0060\\u0060kai-grafico\\nPUCV: 62'),
    cercaCerrada: recorteSeguro('Comparativa:\\n\\n\\u0060\\u0060\\u0060kai-grafico\\nPUCV: 62\\n\\u0060\\u0060\\u0060'),
    tablaEnCurso: recorteSeguro('Resultados:\\n\\n| Ranking | Puesto |\\n| --- | --- |\\n| THE | 12'),
    tablaCompleta: recorteSeguro('Resultados:\\n\\n| Ranking | Puesto |\\n| --- | --- |\\n| THE | 12 |\\n\\nEn resumen'),
    negritaAbierta: recorteSeguro('El dato clave es **'),
    subrayadoAbierto: recorteSeguro('valor _'),
    cierreIntacto: recorteSeguro('texto\\n\\u0060\\u0060\\u0060sql\\nSELECT 1\\n\\u0060\\u0060\\u0060'),
  };
`);
console.log("    " + JSON.stringify(recorte));
comprobar("un texto sin marcado no se toca", recorte.plano === "La PUCV sube dos puestos.", recorte.plano);
comprobar("un bloque cercado sin cerrar se oculta entero",
  recorte.cercaAbierta === "Comparativa:\n" && !recorte.cercaAbierta.includes("PUCV"), JSON.stringify(recorte.cercaAbierta));
comprobar("un bloque cercado ya cerrado se conserva",
  recorte.cercaCerrada.includes("PUCV: 62"), JSON.stringify(recorte.cercaCerrada));
comprobar("una tabla a medias no deja filas sueltas",
  !recorte.tablaEnCurso.includes("|"), JSON.stringify(recorte.tablaEnCurso));
comprobar("la tabla terminada sí se muestra",
  recorte.tablaCompleta.includes("| THE | 12 |"), JSON.stringify(recorte.tablaCompleta));
comprobar("los asteriscos de una negrita sin cerrar se omiten",
  recorte.negritaAbierta === "El dato clave es", JSON.stringify(recorte.negritaAbierta));
comprobar("el guion bajo suelto también se omite",
  recorte.subrayadoAbierto === "valor", JSON.stringify(recorte.subrayadoAbierto));
comprobar("el cierre de un bloque cercado no se recorta",
  recorte.cierreIntacto.endsWith("```"), JSON.stringify(recorte.cierreIntacto));

console.log("\n=== 3. Aparición en pantalla ===");
// Una respuesta con la forma de las de verdad: párrafos, una tabla y un bloque
// de gráfico, que son las tres piezas que podrían verse a medio construir.
const TEXTO = [
  "La **PUCV** mejora en dos de los tres rankings cargados, con el mayor avance",
  "en el índice de citas, que pasa de 41,2 a 58,9 puntos entre 2019 y 2024.",
  "",
  "| Ranking | 2019 | 2024 |",
  "| --- | --- | --- |",
  "| THE Latam | 31 | 24 |",
  "| QS | 58 | 51 |",
  "",
  "El detalle por métrica se resume a continuación.",
  "",
  "```kai-grafico",
  "titulo: Índice de citas",
  "PUCV: 58,9",
  "UC: 71,4",
  "```",
  "",
  "En conjunto, la posición relativa mejora de forma sostenida y sin retrocesos",
  "en ninguno de los períodos observados.",
].join("\n");

const aparicion = await ev(`
  const { montarRevelado } = await import('/pruebas/montar_markdown.jsx');
  montarRevelado(${JSON.stringify(TEXTO)});
  const caja = document.getElementById('prueba-revelado');
  const muestras = [];
  const codigos = [];
  await new Promise(listo => {
    const reloj = setInterval(() => {
      muestras.push(caja.innerText.replace(/\\s+/g, ' ').trim().length);
      codigos.push(caja.querySelectorAll('pre').length);
      if (muestras.length >= 45) { clearInterval(reloj); listo(); }
    }, 60);
  });
  return {
    muestras,
    codigoVisto: Math.max(...codigos),
    figuras: caja.querySelectorAll('figure').length,
    tablas: caja.querySelectorAll('table').length,
    texto: caja.innerText,
  };
`);
const m = aparicion.muestras;
const distintas = new Set(m).size;
const retrocesos = m.filter((n, i) => i > 0 && n < m[i - 1] - 2).length;
console.log(`    muestras: ${m[0]} … ${m.at(-1)} · ${distintas} estados distintos · ${retrocesos} retrocesos`);
comprobar("empieza con mucho menos texto del que termina", m[0] < m.at(-1) / 2, `${m[0]} de ${m.at(-1)}`);
comprobar("aparece en varios pasos, no de golpe", distintas >= 4, `${distintas} estados`);
comprobar("el texto solo crece, nunca se borra", retrocesos === 0, JSON.stringify(m));
comprobar("termina con la respuesta completa",
  aparicion.texto.includes("sin retrocesos") && aparicion.texto.includes("58,9"), aparicion.texto.slice(-80));
comprobar("la tabla queda dibujada al final", aparicion.tablas === 1, aparicion.tablas);
comprobar("el gráfico queda dibujado al final", aparicion.figuras === 1, aparicion.figuras);
comprobar("el gráfico nunca se ve como bloque de código", aparicion.codigoVisto === 0, aparicion.codigoVisto);

const inmediato = await ev(`
  const { montar } = await import('/pruebas/montar_markdown.jsx');
  montar(${JSON.stringify(TEXTO)});
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const caja = document.getElementById('prueba-markdown');
  return { texto: caja.innerText, tablas: caja.querySelectorAll('table').length };
`);
comprobar("sin revelado, el mensaje se muestra entero desde el principio",
  inmediato.texto.includes("sin retrocesos") && inmediato.tablas === 1, inmediato.texto.slice(0, 60));

console.log("\n=== 4. Indicador de espera ===");
const espera = await ev(`
  const { montarCargando } = await import('/pruebas/montar_markdown.jsx');
  montarCargando();
  await new Promise(r => setTimeout(r, 300));
  const caja = document.getElementById('prueba-cargando');
  const animacion = sel => {
    const el = caja.querySelector(sel);
    return el ? getComputedStyle(el).animationName : null;
  };
  const puntos = [...caja.querySelectorAll('span')]
    .filter(e => getComputedStyle(e).animationName === 'onda').length;
  return {
    estado: caja.querySelector('[role=status]') !== null,
    vivo: caja.querySelector('[role=status]')?.getAttribute('aria-live'),
    texto: caja.innerText,
    puntos,
    barrido: animacion('.animate-barrido'),
    marca: animacion('.animate-latido'),
    barra: animacion('.animate-deslizar'),
  };
`);
console.log("    " + JSON.stringify(espera));
comprobar("se anuncia como estado a los lectores de pantalla",
  espera.estado === true && espera.vivo === "polite", JSON.stringify([espera.estado, espera.vivo]));
comprobar("dice qué está haciendo", /Consultando la base de datos/.test(espera.texto), espera.texto);
comprobar("no promete etapas que no puede conocer",
  !/(Analizando|Redactando|Pensando)/i.test(espera.texto), espera.texto);
comprobar("los tres puntos ondulan", espera.puntos === 3, espera.puntos);
comprobar("la etiqueta lleva el barrido de luz", espera.barrido === "barrido", espera.barrido);
comprobar("la marca del asistente late", espera.marca === "latido", espera.marca);
comprobar("la barra indeterminada se desplaza", espera.barra === "deslizar", espera.barra);

// El cronómetro solo aparece cuando la espera ya se nota.
const cronometro = await ev(`
  const caja = document.getElementById('prueba-cargando');
  const antes = caja.innerText;
  await new Promise(r => setTimeout(r, 3200));
  return { antes, despues: caja.innerText };
`);
// El cronómetro se dibuja en versalitas, así que en el DOM sale como «3S».
comprobar("al principio no hay cronómetro", !/\d\s*s/i.test(cronometro.antes), cronometro.antes);
comprobar("pasados unos segundos se muestra cuánto lleva",
  /\d\s*s/i.test(cronometro.despues), cronometro.despues);

console.log("\n=== 5. Consola ===");
const relevantes = errores.filter(t => !/favicon|DevTools|Failed to load resource/i.test(t));
comprobar("sin errores de JavaScript", relevantes.length === 0, JSON.stringify(relevantes).slice(0, 400));

await cdp("Emulation.clearDeviceMetricsOverride");
console.log("\n" + "=".repeat(64));
console.log(`FALLOS: ${fallos.length}` + (fallos.length ? ` -> ${JSON.stringify(fallos)}` : "  (todo correcto)"));
ws.close();
process.exit(fallos.length ? 1 : 0);
