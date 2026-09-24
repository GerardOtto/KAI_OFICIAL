/** Reporte ejecutivo de análisis institucional: el PDF que se genera desde el chat.
 *
 *  Una sección por intercambio: la consulta del usuario como subtítulo y la
 *  respuesta del asistente debajo, con su Markdown ya compuesto —encabezados,
 *  tablas, listas y gráficos de barras—.
 *
 *  Por qué se dibuja el PDF en vez de capturar la pantalla. `html2canvas`
 *  produciría una imagen del chat: pesada, borrosa al imprimir, imposible de
 *  buscar o de copiar y con cortes de página a mitad de una fila. Aquí el texto
 *  se escribe como texto, y los saltos de página se deciden bloque a bloque.
 *
 *  Por qué el papel es claro si el sitio es oscuro. Un reporte se imprime y se
 *  adjunta a un correo. Lo que se conserva del sitio es el sistema tipográfico
 *  —serif para los títulos, monoespaciada para las etiquetas— y el azul de
 *  acento; lo que cambia es el soporte.
 */
import jsPDF from "jspdf";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import logoUrl from "../assets/logo.png";
import { esDestacada, formatearValor, leerGrafico } from "./grafico";

const TITULO_REPORTE = "Reporte ejecutivo de análisis institucional";

// A4 vertical, en milímetros.
const ANCHO = 210;
const ALTO = 297;
const MARGEN = 20;
const ANCHO_UTIL = ANCHO - MARGEN * 2;
const PIE = 18; // franja inferior reservada al pie de página

// Paleta. El acento es el mismo `oklch(0.72 0.13 250)` del sitio, oscurecido
// para que mantenga contraste sobre papel blanco.
const TINTA = [19, 19, 19];
const GRIS = [107, 107, 107];
const GRIS_CLARO = [150, 150, 150];
const ACENTO = [42, 117, 186];
const ACENTO_SUAVE = [96, 170, 243];
const LINEA = [216, 220, 226];
const FONDO_SUAVE = [244, 246, 249];

const MM_POR_PUNTO = 0.3528;
const alturaLinea = (puntos, factor = 1.45) => puntos * MM_POR_PUNTO * factor;

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

/** Aplana los nodos en línea de Markdown en fragmentos con estilo. */
function fragmentos(nodos, estilo = {}) {
  const salida = [];
  for (const n of nodos || []) {
    switch (n.type) {
      case "text":
        salida.push({ texto: n.value, ...estilo });
        break;
      case "strong":
        salida.push(...fragmentos(n.children, { ...estilo, negrita: true }));
        break;
      case "emphasis":
        salida.push(...fragmentos(n.children, { ...estilo, cursiva: true }));
        break;
      case "inlineCode":
        salida.push({ texto: n.value, ...estilo, mono: true });
        break;
      case "link":
        salida.push(...fragmentos(n.children, { ...estilo, enlace: n.url }));
        break;
      case "break":
        salida.push({ salto: true });
        break;
      case "image":
        // Las respuestas no traen imágenes; si llegara una, su texto alternativo
        // dice más que un hueco.
        if (n.alt) salida.push({ texto: n.alt, ...estilo, cursiva: true });
        break;
      default:
        if (n.children) salida.push(...fragmentos(n.children, estilo));
    }
  }
  return salida;
}

/** Texto plano de un nodo, para medir columnas y para las celdas de una tabla. */
function plano(nodo) {
  if (!nodo) return "";
  if (nodo.type === "text" || nodo.type === "inlineCode") return nodo.value;
  if (nodo.children) return nodo.children.map(plano).join("");
  return "";
}

/** Fragmentos -> palabras sueltas, cada una sabiendo si lleva espacio delante. */
function palabras(trozos) {
  const salida = [];
  let espacio = false;
  for (const t of trozos) {
    if (t.salto) {
      salida.push({ salto: true });
      espacio = false;
      continue;
    }
    const partes = String(t.texto ?? "").split(/(\s+)/);
    for (const parte of partes) {
      if (!parte) continue;
      if (/^\s+$/.test(parte)) {
        espacio = true;
        continue;
      }
      salida.push({ texto: parte, estilo: t, espacio });
      espacio = false;
    }
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Lienzo: cursor, saltos de página y primitivas de dibujo
// ---------------------------------------------------------------------------

class Lienzo {
  constructor(doc, logo) {
    this.doc = doc;
    this.logo = logo;
    this.y = MARGEN;
  }

  get limite() {
    return ALTO - PIE;
  }

  fuente(familia, estilo, puntos, color = TINTA) {
    this.doc.setFont(familia, estilo);
    this.doc.setFontSize(puntos);
    this.doc.setTextColor(...color);
  }

  /** Marca de agua: el logotipo centrado, muy tenue. Se dibuja al abrir la
   *  página para que el contenido quede encima y nada se lea a través. */
  marcaDeAgua() {
    if (!this.logo) return;
    const ancho = 120;
    const alto = ancho / this.logo.proporcion;
    try {
      this.doc.saveGraphicsState();
      this.doc.setGState(new this.doc.GState({ opacity: 0.05 }));
      // El alias hace que jsPDF incruste el mapa de bits una sola vez y lo
      // reutilice en cada página, en vez de repetirlo tantas veces como páginas
      // tenga el reporte.
      this.doc.addImage(this.logo.datos, "PNG", (ANCHO - ancho) / 2, (ALTO - alto) / 2, ancho, alto, "kai-logo", "FAST");
      this.doc.restoreGraphicsState();
    } catch {
      // Sin soporte de transparencia es preferible no dibujarla: una marca de
      // agua opaca taparía el texto.
    }
  }

  nuevaPagina() {
    this.doc.addPage();
    this.marcaDeAgua();
    this.y = MARGEN;
  }

  /** Abre página si el bloque que viene no cabe entero. */
  reservar(alto) {
    if (this.y + alto > this.limite) this.nuevaPagina();
  }

  separacion(mm) {
    this.y += mm;
  }

  regla(color = LINEA, grosor = 0.2, ancho = ANCHO_UTIL) {
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(grosor);
    this.doc.line(MARGEN, this.y, MARGEN + ancho, this.y);
  }

  /** Escribe palabras ajustando al ancho disponible. Devuelve el alto ocupado. */
  escribir(trozos, { x = MARGEN, ancho = ANCHO_UTIL, puntos = 10, color = TINTA, familia = "helvetica", estilo = "normal", interlineado = 1.45 } = {}) {
    const alto = alturaLinea(puntos, interlineado);
    const aplicar = (e = {}) => {
      if (e.mono) this.doc.setFont("courier", e.negrita ? "bold" : "normal");
      else if (e.negrita && e.cursiva) this.doc.setFont(familia, "bolditalic");
      else if (e.negrita) this.doc.setFont(familia, "bold");
      else if (e.cursiva) this.doc.setFont(familia, "italic");
      else this.doc.setFont(familia, estilo);
      this.doc.setFontSize(puntos);
      this.doc.setTextColor(...(e.enlace ? ACENTO : color));
    };

    const lista = palabras(trozos);
    let linea = [];
    let usado = 0;

    const volcar = () => {
      if (linea.length) {
        this.reservar(alto);
        let x0 = x;
        for (const p of linea) {
          aplicar(p.estilo);
          if (p.hueco) x0 += p.hueco;
          this.doc.text(p.texto, x0, this.y + alto * 0.72);
          if (p.estilo?.enlace) {
            this.doc.link(x0, this.y + alto * 0.2, p.w, alto * 0.7, { url: p.estilo.enlace });
          }
          x0 += p.w;
        }
        this.y += alto;
      }
      linea = [];
      usado = 0;
    };

    for (const p of lista) {
      if (p.salto) {
        volcar();
        continue;
      }
      aplicar(p.estilo);
      let w = this.doc.getTextWidth(p.texto);
      const hueco = p.espacio && linea.length ? this.doc.getTextWidth(" ") : 0;

      // Una palabra más ancha que la columna —una dirección web larga— se parte
      // por caracteres; si no, el bucle no avanzaría nunca.
      if (w > ancho) {
        volcar();
        let resto = p.texto;
        while (resto) {
          let corte = resto.length;
          while (corte > 1 && this.doc.getTextWidth(resto.slice(0, corte)) > ancho) corte -= 1;
          const trozo = resto.slice(0, corte);
          aplicar(p.estilo);
          linea = [{ texto: trozo, estilo: p.estilo, w: this.doc.getTextWidth(trozo), hueco: 0 }];
          volcar();
          resto = resto.slice(corte);
          aplicar(p.estilo);
        }
        continue;
      }

      if (usado + hueco + w > ancho && linea.length) {
        volcar();
        aplicar(p.estilo);
        w = this.doc.getTextWidth(p.texto);
        linea.push({ texto: p.texto, estilo: p.estilo, w, hueco: 0 });
        usado = w;
      } else {
        linea.push({ texto: p.texto, estilo: p.estilo, w, hueco });
        usado += hueco + w;
      }
    }
    volcar();
  }

  /** Líneas de una celda ya ajustadas a un ancho, para medir la fila antes de
   *  dibujarla. */
  ajustar(texto, ancho, puntos, familia, estilo) {
    this.doc.setFont(familia, estilo);
    this.doc.setFontSize(puntos);
    return this.doc.splitTextToSize(String(texto ?? ""), ancho);
  }
}

// ---------------------------------------------------------------------------
// Bloques de Markdown
// ---------------------------------------------------------------------------

const PUNTOS_ENCABEZADO = { 1: 13, 2: 12, 3: 11, 4: 10, 5: 10, 6: 10 };

function encabezado(l, nodo) {
  const puntos = PUNTOS_ENCABEZADO[nodo.depth] || 10;
  l.separacion(nodo.depth <= 2 ? 3.5 : 2.5);
  l.reservar(alturaLinea(puntos) + 2);
  if (nodo.depth <= 2) {
    l.escribir(fragmentos(nodo.children), { puntos, familia: "times", estilo: "bold", interlineado: 1.3 });
  } else {
    l.escribir(
      [{ texto: plano(nodo).toUpperCase(), negrita: true }],
      { puntos: 8.5, familia: "helvetica", color: GRIS, interlineado: 1.4 },
    );
  }
  l.separacion(1.2);
}

function parrafo(l, nodo) {
  l.escribir(fragmentos(nodo.children), { puntos: 10 });
  l.separacion(2.2);
}

function lista(l, nodo, nivel = 0) {
  const sangria = 5 + nivel * 5;
  let indice = nodo.start || 1;
  for (const item of nodo.children) {
    const vinetas = nodo.ordered ? `${indice}.` : "·";
    indice += 1;

    // La viñeta se escribe a la altura de la primera línea del elemento, así que
    // se apunta la posición antes de componer el contenido.
    const yVinieta = l.y;
    const paginaVinieta = l.doc.getNumberOfPages();

    let primero = true;
    for (const hijo of item.children) {
      if (hijo.type === "list") {
        lista(l, hijo, nivel + 1);
      } else if (hijo.type === "paragraph") {
        l.escribir(fragmentos(hijo.children), {
          x: MARGEN + sangria,
          ancho: ANCHO_UTIL - sangria,
          puntos: 10,
        });
        l.separacion(primero ? 0.8 : 1.6);
      } else {
        bloque(l, hijo);
      }
      primero = false;
    }

    // Si el elemento no provocó salto de página, la viñeta va donde se apuntó.
    if (l.doc.getNumberOfPages() === paginaVinieta) {
      l.fuente("helvetica", "normal", 10, nodo.ordered ? GRIS : ACENTO_SUAVE);
      l.doc.text(vinetas, MARGEN + (nodo.ordered ? 0 : 1.5), yVinieta + alturaLinea(10) * 0.72);
    }
  }
  l.separacion(1.4);
}

function cita(l, nodo) {
  l.separacion(1.5);
  const yInicio = l.y;
  for (const hijo of nodo.children) {
    l.escribir(fragmentos(hijo.children), {
      x: MARGEN + 5,
      ancho: ANCHO_UTIL - 5,
      puntos: 9.5,
      color: GRIS,
      estilo: "italic",
    });
  }
  l.doc.setDrawColor(...ACENTO_SUAVE);
  l.doc.setLineWidth(0.6);
  l.doc.line(MARGEN + 1, yInicio + 0.5, MARGEN + 1, l.y - 0.5);
  l.separacion(2.5);
}

function codigo(l, nodo) {
  const lineas = l.ajustar(nodo.value, ANCHO_UTIL - 6, 8.5, "courier", "normal");
  const alto = lineas.length * alturaLinea(8.5, 1.35) + 4;
  l.reservar(alto);
  l.doc.setFillColor(...FONDO_SUAVE);
  l.doc.setDrawColor(...LINEA);
  l.doc.setLineWidth(0.2);
  l.doc.rect(MARGEN, l.y, ANCHO_UTIL, alto, "FD");
  l.fuente("courier", "normal", 8.5, TINTA);
  let y = l.y + 2 + alturaLinea(8.5, 1.35) * 0.72;
  for (const linea of lineas) {
    l.doc.text(linea, MARGEN + 3, y);
    y += alturaLinea(8.5, 1.35);
  }
  l.y += alto;
  l.separacion(2.5);
}

function tabla(l, nodo) {
  const filas = nodo.children.map((fila) => fila.children.map(plano));
  if (!filas.length) return;
  const columnas = Math.max(...filas.map((f) => f.length));
  const alineacion = nodo.align || [];
  const PUNTOS = 8.5;
  const PADDING = 2;

  // Ancho natural de cada columna, recortado a un máximo para que una celda
  // larga no deje a las demás en un hilo, y reescalado al ancho disponible.
  l.doc.setFontSize(PUNTOS);
  const natural = [];
  for (let c = 0; c < columnas; c += 1) {
    let max = 0;
    filas.forEach((fila, i) => {
      l.doc.setFont("helvetica", i === 0 ? "bold" : "normal");
      max = Math.max(max, l.doc.getTextWidth(fila[c] || ""));
    });
    natural.push(Math.min(max + PADDING * 2, ANCHO_UTIL * 0.45));
  }
  const suma = natural.reduce((s, w) => s + w, 0) || 1;
  const anchos = natural.map((w) => (w / suma) * ANCHO_UTIL);

  const altoLinea = alturaLinea(PUNTOS, 1.3);

  const dibujarFila = (fila, esCabecera) => {
    const celdas = anchos.map((ancho, c) =>
      l.ajustar(fila[c] || "", ancho - PADDING * 2, PUNTOS, "helvetica", esCabecera ? "bold" : "normal"),
    );
    const alto = Math.max(...celdas.map((c) => c.length)) * altoLinea + PADDING * 2;

    if (l.y + alto > l.limite) {
      l.nuevaPagina();
      if (!esCabecera) dibujarFila(filas[0], true);
    }

    if (esCabecera) {
      l.doc.setFillColor(...FONDO_SUAVE);
      l.doc.rect(MARGEN, l.y, ANCHO_UTIL, alto, "F");
    }
    l.doc.setDrawColor(...LINEA);
    l.doc.setLineWidth(0.15);
    l.doc.line(MARGEN, l.y + alto, MARGEN + ANCHO_UTIL, l.y + alto);

    let x = MARGEN;
    celdas.forEach((lineas, c) => {
      l.fuente("helvetica", esCabecera ? "bold" : "normal", PUNTOS, esCabecera ? GRIS : TINTA);
      const derecha = alineacion[c] === "right";
      const centro = alineacion[c] === "center";
      lineas.forEach((linea, i) => {
        const y = l.y + PADDING + altoLinea * (i + 0.72);
        if (derecha) l.doc.text(linea, x + anchos[c] - PADDING, y, { align: "right" });
        else if (centro) l.doc.text(linea, x + anchos[c] / 2, y, { align: "center" });
        else l.doc.text(linea, x + PADDING, y);
      });
      x += anchos[c];
    });
    l.y += alto;
  };

  l.separacion(1.5);
  l.reservar(altoLinea * 3);
  filas.forEach((fila, i) => dibujarFila(fila, i === 0));
  l.separacion(3);
}

function grafico(l, datos) {
  const ALTO_BARRA = 3;
  const ALTO_FILA = 9.5;
  const alto = 8 + (datos.titulo ? 6 : 0) + (datos.unidad ? 4 : 0) + datos.datos.length * ALTO_FILA + (datos.fuente ? 5 : 0);

  l.separacion(2);
  l.reservar(alto);
  const yMarco = l.y;
  l.y += 4.5;

  if (datos.titulo) {
    l.escribir([{ texto: datos.titulo, negrita: true }], {
      x: MARGEN + 4,
      ancho: ANCHO_UTIL - 8,
      puntos: 9.5,
      interlineado: 1.25,
    });
    l.separacion(0.8);
  }
  if (datos.unidad) {
    l.fuente("courier", "normal", 7, GRIS);
    l.doc.text(datos.unidad.toUpperCase(), MARGEN + 4, l.y + 2);
    l.separacion(4);
  }

  for (const d of datos.datos) {
    const destacada = esDestacada(d.etiqueta, datos.destacar);
    l.fuente("helvetica", destacada ? "bold" : "normal", 8.5, TINTA);
    const etiqueta = l.ajustar(d.etiqueta, ANCHO_UTIL - 40, 8.5, "helvetica", destacada ? "bold" : "normal")[0];
    l.doc.text(etiqueta, MARGEN + 4, l.y + 2.6);
    l.fuente("courier", destacada ? "bold" : "normal", 8.5, destacada ? TINTA : GRIS);
    l.doc.text(formatearValor(d.valor), MARGEN + ANCHO_UTIL - 4, l.y + 2.6, { align: "right" });

    const pista = ANCHO_UTIL - 8;
    const largo = Math.max((d.valor / datos.maximo) * pista, d.valor > 0 ? 0.6 : 0);
    l.doc.setFillColor(...LINEA);
    l.doc.rect(MARGEN + 4, l.y + 4.6, pista, ALTO_BARRA, "F");
    l.doc.setFillColor(...(destacada ? ACENTO : ACENTO_SUAVE));
    l.doc.rect(MARGEN + 4, l.y + 4.6, largo, ALTO_BARRA, "F");
    l.y += ALTO_FILA;
  }

  if (datos.fuente) {
    l.fuente("courier", "normal", 7, GRIS_CLARO);
    l.doc.text(`FUENTE: ${datos.fuente.toUpperCase()}`, MARGEN + 4, l.y + 1.5);
    l.separacion(4);
  }

  l.y += 3;
  l.doc.setDrawColor(...LINEA);
  l.doc.setLineWidth(0.2);
  l.doc.rect(MARGEN, yMarco, ANCHO_UTIL, l.y - yMarco);
  l.separacion(3);
}

function bloque(l, nodo) {
  switch (nodo.type) {
    case "heading": return encabezado(l, nodo);
    case "paragraph": return parrafo(l, nodo);
    case "list": return lista(l, nodo);
    case "table": return tabla(l, nodo);
    case "blockquote": return cita(l, nodo);
    case "thematicBreak":
      l.separacion(2);
      l.reservar(3);
      l.regla();
      return l.separacion(3);
    case "code": {
      // El bloque de gráfico se dibuja; el resto del código se compone como tal.
      if (nodo.lang === "kai-grafico") {
        const datos = leerGrafico(nodo.value);
        if (datos) return grafico(l, datos);
      }
      return codigo(l, nodo);
    }
    default:
      if (nodo.children) nodo.children.forEach((hijo) => bloque(l, hijo));
  }
}

// ---------------------------------------------------------------------------
// Armado del documento
// ---------------------------------------------------------------------------

const analizador = unified().use(remarkParse).use(remarkGfm);

// Ancho al que se reduce el logotipo antes de incrustarlo. La marca de agua es
// la mayor de sus dos apariciones, con 120 mm ≈ 4,7 pulgadas: 640 px la dejan
// por encima de 130 ppp, de sobra para imprimir. Sin esta reducción el PNG
// original entraba a resolución completa y un reporte de una página pesaba más
// de un megabyte.
const ANCHO_LOGO_PX = 640;

/** El logotipo reducido y en PNG, listo para `addImage`. `null` si no cargó. */
async function cargarLogo() {
  try {
    const imagen = new Image();
    imagen.src = logoUrl;
    await imagen.decode();
    const proporcion = imagen.naturalWidth / imagen.naturalHeight || 3.35;

    const lienzo = document.createElement("canvas");
    lienzo.width = Math.min(ANCHO_LOGO_PX, imagen.naturalWidth || ANCHO_LOGO_PX);
    lienzo.height = Math.round(lienzo.width / proporcion);
    const ctx = lienzo.getContext("2d");
    // Fondo blanco: el logotipo es tinta negra sobre transparente, y sin fondo
    // el PNG resultante se incrusta con canal alfa que algunos lectores pintan
    // en negro.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    return { datos: lienzo.toDataURL("image/png"), proporcion };
  } catch {
    return null;
  }
}

/** La consulta del usuario, presentada como la pregunta que encabeza la sección.
 *
 *  No se inventa una pregunta donde no la hay: a una consulta que ya lo es se le
 *  completa la puntuación, y una instrucción («Compara el índice de citas…») se
 *  respeta tal cual. Deformarla en interrogativa cambiaría lo que el usuario
 *  preguntó, que es justo lo que el reporte debe dejar constar.
 */
export function comoPregunta(texto) {
  let t = String(texto || "").replace(/\s+/g, " ").trim();
  if (!t) return "Consulta";
  if (t.length > 220) t = `${t.slice(0, 217).trimEnd()}…`;
  t = t.charAt(0).toUpperCase() + t.slice(1);

  // El límite de palabra se escribe como «espacio o fin» y no como `\b`: en
  // JavaScript `\b` se apoya en [A-Za-z0-9_], así que una vocal acentuada no
  // cuenta como letra y `qué\b` no reconocería «Qué rankings hay cargados».
  const INTERROGATIVAS =
    /^(¿|(qué|que|cuál|cual|cuáles|cuales|cómo|como|cuánto|cuánta|cuántos|cuántas|cuanto|cuanta|cuantos|cuantas|cuándo|cuando|dónde|donde|por qué|porqué|quién|quien|quiénes|quienes|hay|existe|existen|puede|puedes|podrías|tiene|tienen|sabes)(\s|$))/i;
  const interrogativa = INTERROGATIVAS.test(t);
  const cierra = t.endsWith("?");
  if (cierra && !t.startsWith("¿")) return `¿${t}`;
  if (!cierra && interrogativa) return `¿${t.replace(/[.…]+$/, "")}?`;
  return t.replace(/[.]+$/, "");
}

/** Ficha del encabezado. Separada para poder verificarla sin componer el PDF.
 *
 *  No lleva el título de la conversación: lo genera el servidor a partir de la
 *  primera consulta, así que repetía casi literalmente el subtítulo de la
 *  sección 01 unas líneas más abajo.
 */
export function datosDeCabecera({ fecha, usuario, motor, nSecciones }) {
  return [
    usuario?.institucion && `Institución: ${usuario.institucion}`,
    usuario?.nombre && `Solicitado por: ${usuario.nombre}`,
    motor && `Asistente: ${motor}`,
    `Emitido: ${fecha}`,
    `${nSecciones} ${nSecciones === 1 ? "consulta" : "consultas"}`,
  ].filter(Boolean);
}

/** Agrupa la conversación en secciones: una consulta con sus respuestas. */
export function secciones(mensajes) {
  const salida = [];
  for (const m of mensajes) {
    if (m.role === "user") salida.push({ pregunta: m.content, hora: m.time, respuestas: [] });
    else if (salida.length) salida[salida.length - 1].respuestas.push(m);
    else salida.push({ pregunta: "", hora: m.time, respuestas: [m] });
  }
  return salida.filter((s) => s.respuestas.length);
}

function portada(l, { fecha, usuario, motor, nSecciones }) {
  if (l.logo) {
    const alto = 9;
    l.doc.addImage(l.logo.datos, "PNG", MARGEN, l.y, alto * l.logo.proporcion, alto, "kai-logo", "FAST");
    l.y += alto + 6;
  } else {
    l.fuente("times", "bold", 22, TINTA);
    l.doc.text("KAI", MARGEN, l.y + 7);
    l.y += 13;
  }

  l.doc.setDrawColor(...ACENTO);
  l.doc.setLineWidth(0.8);
  l.doc.line(MARGEN, l.y, MARGEN + 28, l.y);
  l.y += 7;

  l.fuente("times", "bold", 21, TINTA);
  const titulo = l.doc.splitTextToSize(TITULO_REPORTE, ANCHO_UTIL);
  for (const linea of titulo) {
    l.doc.text(linea, MARGEN, l.y + 7);
    l.y += 8.5;
  }
  l.y += 2;

  l.fuente("courier", "normal", 7.5, GRIS);
  for (const linea of datosDeCabecera({ fecha, usuario, motor, nSecciones })) {
    l.doc.text(linea.toUpperCase(), MARGEN, l.y + 2.5);
    l.y += 4;
  }

  l.y += 3;
  l.regla();
  l.y += 6;
}

function subtitulo(l, indice, pregunta) {
  l.separacion(indice === 1 ? 0 : 5);
  l.reservar(26);

  l.fuente("courier", "bold", 8, ACENTO);
  l.doc.text(String(indice).padStart(2, "0"), MARGEN, l.y + 3);

  const x = MARGEN + 9;
  l.escribir([{ texto: pregunta, negrita: true }], {
    x,
    ancho: ANCHO_UTIL - 9,
    puntos: 13,
    familia: "times",
    interlineado: 1.3,
  });

  l.separacion(1.8);
  l.doc.setDrawColor(...LINEA);
  l.doc.setLineWidth(0.2);
  l.doc.line(x, l.y, MARGEN + ANCHO_UTIL, l.y);
  l.separacion(4);
}

/** Pie con numeración, en una pasada final: hasta terminar no se sabe el total. */
function pies(doc, fecha) {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.2);
    doc.line(MARGEN, ALTO - PIE + 6, ANCHO - MARGEN, ALTO - PIE + 6);

    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRIS_CLARO);
    // Dos bloques y no tres: con el título completo a la izquierda y la fecha
    // centrada, ambos se pisaban. La fecha ya consta en la cabecera del reporte.
    doc.text("KAI · REPORTE EJECUTIVO", MARGEN, ALTO - PIE + 10.5);
    doc.text(`${fecha.toUpperCase()}   ·   ${p} / ${total}`, ANCHO - MARGEN, ALTO - PIE + 10.5, { align: "right" });
  }
}

/** Nombre de archivo: sin tildes ni espacios, con la fecha delante. */
function nombreArchivo(conversacion) {
  const fecha = new Date().toISOString().slice(0, 10);
  const base = (conversacion || "reporte")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48);
  return `reporte-ejecutivo-${base || "analisis"}-${fecha}.pdf`;
}

/** Compone el documento y lo devuelve sin descargarlo.
 *
 *  Separado de la descarga para poder verificarlo: una sonda puede pedir el
 *  documento, contar sus páginas y comprobar que es un PDF válido sin provocar
 *  una descarga en el navegador.
 */
export async function construirReporte({ mensajes, conversacion = "", usuario = null, motor = "" }) {
  const partes = secciones(mensajes);
  if (!partes.length) throw new Error("No hay respuestas que incluir en el reporte.");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setProperties({
    title: TITULO_REPORTE,
    subject: conversacion || "Análisis de rankings institucionales",
    author: "KAI · Key Academic Indicator",
    creator: "KAI",
  });

  const logo = await cargarLogo();
  const l = new Lienzo(doc, logo);
  const fecha = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });

  l.marcaDeAgua();
  portada(l, { fecha, usuario, motor, nSecciones: partes.length });

  partes.forEach((seccion, i) => {
    subtitulo(l, i + 1, comoPregunta(seccion.pregunta));
    for (const respuesta of seccion.respuestas) {
      const arbol = analizador.parse(respuesta.content || "");
      arbol.children.forEach((nodo) => bloque(l, nodo));
    }
  });

  pies(doc, fecha);
  return doc;
}

/** Genera el PDF y lo descarga. Devuelve el nombre del archivo. */
export async function generarReporteEjecutivo(datos) {
  const doc = await construirReporte(datos);
  const nombre = nombreArchivo(datos.conversacion);
  doc.save(nombre);
  return nombre;
}
