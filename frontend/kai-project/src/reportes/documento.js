/** Piezas comunes de los informes PDF de KAI.
 *
 *  El reporte del asistente fijó el estilo —papel claro, títulos en serif,
 *  etiquetas en monoespaciada, el azul de acento, secciones numeradas, marca de
 *  agua y pie paginado—, y los informes de los módulos lo comparten desde aquí
 *  para que todos se lean como documentos de la misma casa.
 *
 *  Criterio de los informes de módulo: un informe no es un volcado de la
 *  pantalla. Abre con lo que importa —cifras clave y una lectura en frases—,
 *  sigue con un gráfico y una tabla acotada, y deja el detalle completo a la
 *  exportación XLSX o CSV, que es donde se trabaja con los datos.
 *
 *  Todo se dibuja como texto y vectores: nada de capturas de pantalla, que
 *  pesan, se imprimen borrosas y no se pueden buscar ni copiar.
 */
import jsPDF from "jspdf";

import logoUrl from "../assets/logo.png";
import logoQs from "../assets/rankings/qs.png";
import logoScimago from "../assets/rankings/scimago.png";
import logoShanghai from "../assets/rankings/shanghairanking.png";
import logoThe from "../assets/rankings/the.png";

// A4 vertical, en milímetros.
export const ANCHO = 210;
export const ALTO = 297;
export const MARGEN = 20;
export const ANCHO_UTIL = ANCHO - MARGEN * 2;
export const PIE = 18; // franja inferior reservada al pie de página

// Paleta. El acento es el mismo `oklch(0.72 0.13 250)` del sitio, oscurecido
// para que mantenga contraste sobre papel blanco.
export const TINTA = [19, 19, 19];
export const GRIS = [107, 107, 107];
export const GRIS_CLARO = [150, 150, 150];
export const ACENTO = [42, 117, 186];
export const ACENTO_SUAVE = [96, 170, 243];
export const LINEA = [216, 220, 226];
export const FONDO_SUAVE = [244, 246, 249];
export const FONDO_ACENTO = [232, 241, 251];
export const POSITIVO = [30, 130, 76];
export const NEGATIVO = [192, 57, 43];

const MM_POR_PUNTO = 0.3528;
export const alturaLinea = (puntos, factor = 1.45) => puntos * MM_POR_PUNTO * factor;

// ---------------------------------------------------------------------------
// Formato de cifras
// ---------------------------------------------------------------------------

/** Cifra en español: millones abreviados, miles con punto, decimales justos. */
export function cifra(valor, decimales = null) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "—";
  const n = Number(valor);
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 1 })} M`;
  const d = decimales ?? (Number.isInteger(n) ? 0 : Math.abs(n) >= 10 ? 1 : 2);
  return n.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: d });
}

/** Diferencia con signo: «+3,2» · «−1,5» · «0». */
export function conSigno(valor, decimales = 1) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "—";
  const n = Number(valor);
  if (Math.abs(n) < 10 ** -decimales / 2) return "0";
  const texto = Math.abs(n).toLocaleString("es-CL", { maximumFractionDigits: decimales });
  return `${n > 0 ? "+" : "–"}${texto}`;
}

/** Variación de puestos: «+3» · «–2» · «=». */
export const puestos = (delta) =>
  delta === null || delta === undefined ? "—" : delta > 0 ? `+${delta}` : delta < 0 ? `–${Math.abs(delta)}` : "=";

// ---------------------------------------------------------------------------
// Caracteres fuera de la fuente
// ---------------------------------------------------------------------------

// Las fuentes estándar del PDF (Helvetica, Times, Courier) solo traen la
// codificación WinAnsi: latín-1 más una veintena de signos. Cualquier otro
// carácter —el menos matemático, las flechas, la delta griega, un emoji en una
// respuesta del asistente— sale como basura, y además descuadra el espaciado de
// toda la línea. Se sustituye por su equivalente más cercano antes de escribir.
const WINANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const SUSTITUTOS = {
  "−": "–", "→": "»", "←": "«", "⟶": "»", "⇒": "»", "↑": "+", "↓": "–", "▲": "+", "▼": "–",
  "Δ": "Var.", "≈": "~", "≤": "<=", "≥": ">=", "≠": "!=", "×": "x", "✓": "Sí", "✔": "Sí",
  "✗": "No", "✘": "No", "…": "…", "‐": "-", "‑": "-", "‒": "–", "―": "—", " ": " ", " ": " ",
};

export function sanearTexto(texto) {
  let salida = "";
  for (const c of String(texto ?? "")) {
    if (c.codePointAt(0) <= 0xff || WINANSI_EXTRA.has(c)) salida += c;
    else if (SUSTITUTOS[c] !== undefined) salida += SUSTITUTOS[c];
    // El resto —emojis, símbolos exóticos— se omite: mejor nada que basura.
  }
  return salida;
}

/** Pasa por `sanearTexto` todo lo que el documento escribe o mide, para que
 *  el ancho medido sea el del texto que de verdad se dibuja. */
function sanear(doc) {
  const texto = doc.text.bind(doc);
  doc.text = (t, ...resto) => texto(Array.isArray(t) ? t.map(sanearTexto) : sanearTexto(t), ...resto);
  const ancho = doc.getTextWidth.bind(doc);
  doc.getTextWidth = (t) => ancho(sanearTexto(t));
  const partir = doc.splitTextToSize.bind(doc);
  doc.splitTextToSize = (t, w, o) => partir(sanearTexto(t), w, o);
  return doc;
}

/** Tono de una variación, para colorearla. `menorEsMejor` invierte el sentido. */
export const tono = (delta, menorEsMejor = false) => {
  if (delta === null || delta === undefined || Math.abs(delta) < 1e-9) return null;
  return (delta > 0) !== menorEsMejor ? "positivo" : "negativo";
};

const COLOR_TONO = { positivo: POSITIVO, negativo: NEGATIVO };

// ---------------------------------------------------------------------------
// Texto con estilo
// ---------------------------------------------------------------------------

/** «Texto con **negrita**» -> fragmentos. Es todo el marcado que necesitan las
 *  frases de lectura que componen los informes. */
export function marcado(texto) {
  return String(texto ?? "")
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((t) => (t.startsWith("**") && t.endsWith("**") ? { texto: t.slice(2, -2), negrita: true } : { texto: t }));
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

export class Lienzo {
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

  regla(color = LINEA, grosor = 0.2, ancho = ANCHO_UTIL, x = MARGEN) {
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(grosor);
    this.doc.line(x, this.y, x + ancho, this.y);
  }

  /** Escribe palabras ajustando al ancho disponible. */
  escribir(trozos, { x = MARGEN, ancho = ANCHO_UTIL, puntos = 10, color = TINTA, familia = "helvetica", estilo = "normal", interlineado = 1.45 } = {}) {
    const alto = alturaLinea(puntos, interlineado);
    const aplicar = (e = {}) => {
      if (e.mono) this.doc.setFont("courier", e.negrita ? "bold" : "normal");
      else if (e.negrita && e.cursiva) this.doc.setFont(familia, "bolditalic");
      else if (e.negrita) this.doc.setFont(familia, "bold");
      else if (e.cursiva) this.doc.setFont(familia, "italic");
      else this.doc.setFont(familia, estilo);
      this.doc.setFontSize(puntos);
      this.doc.setTextColor(...(e.enlace ? ACENTO : e.color || color));
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

  /** Líneas de una celda ya ajustadas a un ancho, para medir antes de dibujar. */
  ajustar(texto, ancho, puntos, familia, estilo) {
    this.doc.setFont(familia, estilo);
    this.doc.setFontSize(puntos);
    return this.doc.splitTextToSize(String(texto ?? ""), ancho);
  }
}

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

// Ancho al que se reduce el logotipo antes de incrustarlo. La marca de agua es
// la mayor de sus dos apariciones, con 120 mm ≈ 4,7 pulgadas: 640 px la dejan
// por encima de 130 ppp, de sobra para imprimir. Sin esta reducción el PNG
// original entraba a resolución completa y un reporte de una página pesaba más
// de un megabyte.
const ANCHO_LOGO_PX = 640;

/** Una imagen reducida y en PNG, lista para `addImage`. `null` si no cargó.
 *
 *  Se compone sobre blanco: los logotipos son tinta sobre transparente, y un PNG
 *  con canal alfa incrustado tal cual lo pintan en negro algunos lectores. Los
 *  informes son de papel blanco, así que el resultado es el mismo. */
async function cargarImagen(url, anchoMaximo) {
  try {
    const imagen = new Image();
    imagen.src = url;
    await imagen.decode();
    const proporcion = imagen.naturalWidth / imagen.naturalHeight || 1;

    const lienzo = document.createElement("canvas");
    lienzo.width = Math.min(anchoMaximo, imagen.naturalWidth || anchoMaximo);
    lienzo.height = Math.round(lienzo.width / proporcion);
    const ctx = lienzo.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    return { datos: lienzo.toDataURL("image/png"), proporcion };
  } catch {
    return null;
  }
}

/** El logotipo de KAI reducido y en PNG, listo para `addImage`. */
export const cargarLogo = () => cargarImagen(logoUrl, ANCHO_LOGO_PX);

/** Logotipo de cada familia de rankings, por el comienzo del nombre. Todos los
 *  de QS llevan el mismo, y los dos de Shanghai, el de ShanghaiRanking, la
 *  consultora que publica GRAS y ARWU. */
const LOGOS_RANKING = [
  [/^THE\b/i, logoThe],
  [/^QS\b/i, logoQs],
  [/^Scimago\b/i, logoScimago],
  [/^Shanghai\b/i, logoShanghai],
  [/^Ranking KAI\b/i, logoUrl],
];

export const logoDeRanking = (nombre) =>
  LOGOS_RANKING.find(([patron]) => patron.test(String(nombre || "").trim()))?.[1] ?? null;

export const fechaDeEmision = () =>
  new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });

/** Documento nuevo con su lienzo, la marca de agua de la primera página y la
 *  fecha de emisión. */
export async function crearDocumento({ titulo, asunto = "", ranking = "" }) {
  const doc = sanear(new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }));
  doc.setProperties({
    title: titulo,
    subject: asunto || titulo,
    author: "KAI · Key Academic Indicator",
    creator: "KAI",
  });
  const l = new Lienzo(doc, await cargarLogo());
  // El del ranking va en la esquina opuesta de la portada; 360 px bastan para
  // los 10 mm de alto a los que se dibuja.
  const url = logoDeRanking(ranking);
  l.logoRanking = url ? await cargarImagen(url, 360) : null;
  l.nombreRanking = ranking;
  l.marcaDeAgua();
  return { doc, l, fecha: fechaDeEmision() };
}

/** Logotipo del ranking en la esquina opuesta a la de KAI, bajo el rótulo
 *  «Ranking usado:». Sin logotipo conocido, el rótulo lleva el nombre. */
function rankingUsado(l) {
  if (!l.nombreRanking) return;
  const derecha = ANCHO - MARGEN;
  l.fuente("courier", "bold", 6.8, GRIS);
  l.doc.text("RANKING USADO:", derecha, MARGEN + 1, { align: "right" });
  if (l.logoRanking) {
    const ALTO_MAX = 10;
    const ANCHO_MAX = 48;
    let alto = ALTO_MAX;
    let ancho = alto * l.logoRanking.proporcion;
    if (ancho > ANCHO_MAX) { ancho = ANCHO_MAX; alto = ancho / l.logoRanking.proporcion; }
    l.doc.addImage(l.logoRanking.datos, "PNG", derecha - ancho, MARGEN + 3, ancho, alto, `ranking-${l.nombreRanking}`, "FAST");
  } else {
    l.fuente("times", "bold", 11, TINTA);
    l.doc.text(l.nombreRanking, derecha, MARGEN + 7, { align: "right" });
  }
}

/** Cabecera de la primera página: logotipo, filete de acento, título y ficha. */
export function portada(l, { titulo, antetitulo = "", ficha = [] }) {
  rankingUsado(l);
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
  l.y += 5;

  if (antetitulo) {
    l.fuente("courier", "bold", 8, ACENTO);
    l.doc.text(antetitulo.toUpperCase(), MARGEN, l.y + 3);
    l.y += 5;
  }

  l.fuente("times", "bold", 21, TINTA);
  for (const linea of l.doc.splitTextToSize(titulo, ANCHO_UTIL)) {
    l.doc.text(linea, MARGEN, l.y + 7);
    l.y += 8.5;
  }
  l.y += 2;

  l.fuente("courier", "normal", 7.5, GRIS);
  for (const linea of ficha.filter(Boolean)) {
    for (const trozo of l.doc.splitTextToSize(linea.toUpperCase(), ANCHO_UTIL)) {
      l.doc.text(trozo, MARGEN, l.y + 2.5);
      l.y += 4;
    }
  }

  l.y += 3;
  l.regla();
  l.y += 6;
}

/** Pie con numeración, en una pasada final: hasta terminar no se sabe el total. */
export function pies(doc, fecha, etiqueta = "KAI · REPORTE EJECUTIVO") {
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
    doc.text(etiqueta, MARGEN, ALTO - PIE + 10.5);
    doc.text(`${fecha.toUpperCase()}   ·   ${p} / ${total}`, ANCHO - MARGEN, ALTO - PIE + 10.5, { align: "right" });
  }
}

/** Nombre de archivo: sin tildes ni espacios, con la fecha al final. */
export function nombreArchivo(prefijo, ...partes) {
  const limpiar = (t) => String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const cuerpo = partes.map(limpiar).filter(Boolean).join("-").slice(0, 60);
  return `${prefijo}${cuerpo ? `-${cuerpo}` : ""}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

/** Cierra el documento —pies de página— y lo descarga. */
export function guardar(doc, fecha, etiqueta, nombre) {
  pies(doc, fecha, etiqueta);
  doc.save(nombre);
  return nombre;
}

// ---------------------------------------------------------------------------
// Bloques
// ---------------------------------------------------------------------------

/** Título de sección numerado, como las consultas del reporte del asistente.
 *  `junto`: milímetros del bloque que sigue que deben caber con el título, para
 *  que un título no quede solo al pie de una página y su gráfico en la otra. */
export function seccion(l, indice, titulo, bajada = "", { junto = 0 } = {}) {
  l.separacion(indice === 1 ? 0 : 6);
  l.reservar(Math.min(30 + junto, l.limite - MARGEN - 10));

  l.fuente("courier", "bold", 8, ACENTO);
  l.doc.text(String(indice).padStart(2, "0"), MARGEN, l.y + 3);

  const x = MARGEN + 9;
  l.escribir([{ texto: titulo, negrita: true }], {
    x, ancho: ANCHO_UTIL - 9, puntos: 13, familia: "times", interlineado: 1.3,
  });
  if (bajada) {
    l.separacion(0.5);
    l.escribir(marcado(bajada), { x, ancho: ANCHO_UTIL - 9, puntos: 8.5, color: GRIS, interlineado: 1.35 });
  }

  l.separacion(1.8);
  l.regla(LINEA, 0.2, ANCHO_UTIL - 9, x);
  l.separacion(4);
}

/** Párrafo corrido. Admite `**negrita**`. */
export function parrafo(l, texto, opciones = {}) {
  l.escribir(typeof texto === "string" ? marcado(texto) : texto, { puntos: 10, ...opciones });
  l.separacion(2.2);
}

/** Lectura en frases: lo que un analista diría al mirar el gráfico. */
export function hallazgos(l, frases) {
  const lista = frases.filter(Boolean);
  if (!lista.length) return;
  for (const frase of lista) {
    const y0 = l.y;
    const pagina = l.doc.getNumberOfPages();
    l.escribir(marcado(frase), { x: MARGEN + 5, ancho: ANCHO_UTIL - 5, puntos: 10 });
    if (l.doc.getNumberOfPages() === pagina) {
      l.doc.setFillColor(...ACENTO_SUAVE);
      l.doc.rect(MARGEN + 0.8, y0 + alturaLinea(10) * 0.42, 1.6, 1.6, "F");
    }
    l.separacion(1.6);
  }
  l.separacion(1.2);
}

/** Fila de tarjetas con las cifras que resumen el informe. Hasta cuatro. */
export function cifrasClave(l, tarjetas) {
  const lista = tarjetas.filter(Boolean).slice(0, 4);
  if (!lista.length) return;
  const HUECO = 3;
  const ancho = (ANCHO_UTIL - HUECO * (lista.length - 1)) / lista.length;

  // Alto común: el de la tarjeta con más líneas de detalle.
  const detalles = lista.map((t) => (t.detalle ? l.ajustar(t.detalle, ancho - 8, 7.5, "helvetica", "normal") : []));
  const alto = 21 + Math.max(0, ...detalles.map((d) => Math.min(d.length, 3))) * alturaLinea(7.5, 1.3);

  l.reservar(alto + 4);
  lista.forEach((t, i) => {
    const x = MARGEN + i * (ancho + HUECO);
    l.doc.setFillColor(...(t.destacada ? FONDO_ACENTO : FONDO_SUAVE));
    l.doc.rect(x, l.y, ancho, alto, "F");
    l.doc.setFillColor(...(t.destacada ? ACENTO : ACENTO_SUAVE));
    l.doc.rect(x, l.y, 0.9, alto, "F");

    l.fuente("courier", "bold", 6.8, GRIS);
    l.doc.text(l.ajustar(String(t.etiqueta).toUpperCase(), ancho - 8, 6.8, "courier", "bold")[0], x + 4, l.y + 5.5);

    l.fuente("times", "bold", 17, t.tono ? COLOR_TONO[t.tono] : TINTA);
    l.doc.text(l.ajustar(String(t.valor), ancho - 8, 17, "times", "bold")[0], x + 4, l.y + 13.5);

    l.fuente("helvetica", "normal", 7.5, GRIS);
    detalles[i].slice(0, 3).forEach((linea, j) => {
      l.doc.text(linea, x + 4, l.y + 18.5 + j * alturaLinea(7.5, 1.3));
    });
  });
  l.y += alto;
  l.separacion(5);
}

/** Tabla de datos.
 *
 *  `columnas`: [{ titulo, alinear: "left" | "right" | "center", peso }] — el
 *  peso reparte el ancho (por omisión, a partes iguales).
 *  `filas`: arreglos de celdas; una celda puede ser texto o { texto, tono,
 *  negrita, fondo } —`fondo` es un color, para los mapas de calor—.
 *  `destacar(fila, i)` marca una fila —la institución propia—.
 *  La cabecera se repite al saltar de página.
 */
export function tabla(l, { columnas, filas, destacar = () => false, puntos = 8.5 }) {
  if (!filas.length) return;
  const PADDING = 2;
  const pesos = columnas.map((c) => c.peso ?? 1);
  const suma = pesos.reduce((s, p) => s + p, 0);
  const anchos = pesos.map((p) => (p / suma) * ANCHO_UTIL);
  const altoLinea = alturaLinea(puntos, 1.3);
  const celda = (c) => (c && typeof c === "object" ? c : { texto: c });

  const dibujarFila = (fila, { cabecera = false, resaltada = false } = {}) => {
    const lineas = anchos.map((ancho, c) => {
      const { texto, negrita } = celda(fila[c]);
      return l.ajustar(texto ?? "", ancho - PADDING * 2, puntos, "helvetica",
                       cabecera || negrita || resaltada ? "bold" : "normal");
    });
    const alto = Math.max(...lineas.map((x) => x.length)) * altoLinea + PADDING * 2;

    if (l.y + alto > l.limite) {
      l.nuevaPagina();
      if (!cabecera) dibujarFila(columnas.map((c) => c.titulo), { cabecera: true });
    }

    if (cabecera || resaltada) {
      l.doc.setFillColor(...(resaltada ? FONDO_ACENTO : FONDO_SUAVE));
      l.doc.rect(MARGEN, l.y, ANCHO_UTIL, alto, "F");
    }
    if (resaltada) {
      l.doc.setFillColor(...ACENTO);
      l.doc.rect(MARGEN, l.y, 0.9, alto, "F");
    }
    l.doc.setDrawColor(...LINEA);
    l.doc.setLineWidth(0.15);
    l.doc.line(MARGEN, l.y + alto, MARGEN + ANCHO_UTIL, l.y + alto);

    let x = MARGEN;
    lineas.forEach((ls, c) => {
      const { tono: t, negrita, fondo } = celda(fila[c]);
      if (fondo && !cabecera) {
        l.doc.setFillColor(...fondo);
        l.doc.rect(x + 0.3, l.y + 0.3, anchos[c] - 0.6, alto - 0.6, "F");
      }
      const color = cabecera ? GRIS : t ? COLOR_TONO[t] : TINTA;
      l.fuente("helvetica", cabecera || negrita || resaltada ? "bold" : "normal", cabecera ? puntos - 0.5 : puntos, color);
      const alinear = columnas[c].alinear || "left";
      ls.forEach((linea, i) => {
        const y = l.y + PADDING + altoLinea * (i + 0.72);
        if (alinear === "right") l.doc.text(linea, x + anchos[c] - PADDING, y, { align: "right" });
        else if (alinear === "center") l.doc.text(linea, x + anchos[c] / 2, y, { align: "center" });
        else l.doc.text(linea, x + PADDING, y);
      });
      x += anchos[c];
    });
    l.y += alto;
  };

  l.separacion(1);
  l.reservar(altoLinea * 4 + PADDING * 4);
  dibujarFila(columnas.map((c) => c.titulo), { cabecera: true });
  filas.forEach((fila, i) => dibujarFila(fila, { resaltada: destacar(fila, i) }));
  l.separacion(3);
}

/** Barras horizontales con la cifra a la derecha. `datos`: [{ etiqueta, valor,
 *  destacada, texto }] — `texto` reemplaza a la cifra formateada. */
export function barras(l, { titulo = "", unidad = "", datos, maximo = null, fuente = "" }) {
  if (!datos.length) return;
  const ALTO_BARRA = 3;
  const ALTO_FILA = 8.5;
  const tope = maximo ?? Math.max(...datos.map((d) => Number(d.valor) || 0), 0) ?? 1;
  const alto = 8 + (titulo ? 6 : 0) + (unidad ? 4 : 0) + datos.length * ALTO_FILA + (fuente ? 5 : 0);

  l.separacion(1.5);
  l.reservar(Math.min(alto, 120));
  const yMarco = l.y;
  let paginaMarco = l.doc.getNumberOfPages();
  l.y += 4.5;

  if (titulo) {
    l.escribir([{ texto: titulo, negrita: true }], { x: MARGEN + 4, ancho: ANCHO_UTIL - 8, puntos: 9.5, interlineado: 1.25 });
    l.separacion(0.8);
  }
  if (unidad) {
    l.fuente("courier", "normal", 7, GRIS);
    l.doc.text(unidad.toUpperCase(), MARGEN + 4, l.y + 2);
    l.separacion(4);
  }

  for (const d of datos) {
    if (l.y + ALTO_FILA > l.limite) {
      l.nuevaPagina();
      paginaMarco = -1; // el marco ya no abarca el bloque entero: se omite
    }
    const destacada = Boolean(d.destacada);
    l.fuente("helvetica", destacada ? "bold" : "normal", 8.5, TINTA);
    const etiqueta = l.ajustar(d.etiqueta, ANCHO_UTIL - 40, 8.5, "helvetica", destacada ? "bold" : "normal")[0];
    l.doc.text(etiqueta, MARGEN + 4, l.y + 2.6);
    l.fuente("courier", destacada ? "bold" : "normal", 8.5, destacada ? TINTA : GRIS);
    l.doc.text(d.texto ?? cifra(d.valor), MARGEN + ANCHO_UTIL - 4, l.y + 2.6, { align: "right" });

    const pista = ANCHO_UTIL - 8;
    const valor = Math.max(0, Number(d.valor) || 0);
    const largo = tope > 0 ? Math.max((valor / tope) * pista, valor > 0 ? 0.6 : 0) : 0;
    l.doc.setFillColor(...LINEA);
    l.doc.rect(MARGEN + 4, l.y + 4.3, pista, ALTO_BARRA, "F");
    l.doc.setFillColor(...(destacada ? ACENTO : ACENTO_SUAVE));
    l.doc.rect(MARGEN + 4, l.y + 4.3, Math.min(largo, pista), ALTO_BARRA, "F");
    l.y += ALTO_FILA;
  }

  if (fuente) {
    l.fuente("courier", "normal", 7, GRIS_CLARO);
    l.doc.text(fuente.toUpperCase(), MARGEN + 4, l.y + 1.5);
    l.separacion(4);
  }

  l.y += 2.5;
  if (paginaMarco === l.doc.getNumberOfPages()) {
    l.doc.setDrawColor(...LINEA);
    l.doc.setLineWidth(0.2);
    l.doc.rect(MARGEN, yMarco, ANCHO_UTIL, l.y - yMarco);
  }
  l.separacion(4);
}

/** Paleta de series para papel: los mismos tonos de la pantalla, oscurecidos
 *  para que se lean sobre blanco. */
function colorDeSerie(hex, i) {
  const base = hex || ["#60aaf3", "#e8aa4e", "#5ec386", "#ab8be3", "#e66e68", "#46c6cd"][i % 6];
  const n = parseInt(base.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c * 0.78));
}

/** Marcas del eje: entre cuatro y seis valores redondos que cubren el rango. */
function marcasDeEje(min, max) {
  if (min === max) { min -= 1; max += 1; }
  const bruto = (max - min) / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * potencia).find((p) => p >= bruto) || bruto;
  const desde = Math.floor(min / paso) * paso;
  const hasta = Math.ceil(max / paso) * paso;
  const marcas = [];
  for (let v = desde; v <= hasta + paso / 2; v += paso) marcas.push(Number(v.toFixed(10)));
  return marcas;
}

/** Gráfico de líneas vectorial: una serie por institución, la destacada en el
 *  acento y más gruesa, y la proyección —si la hay— punteada.
 *
 *  `series`: [{ nombre, color, destacada, puntos: [{x, y}], proyeccion: [{x, y}] }]
 */
export function lineas(l, { titulo = "", unidad = "", series, alto = 78, fuente = "" }) {
  const conDatos = series.filter((s) => s.puntos.length);
  if (!conDatos.length) return;

  const todos = conDatos.flatMap((s) => [...s.puntos, ...(s.proyeccion || [])]);
  const xs = [...new Set(todos.map((p) => p.x))].sort((a, b) => a - b);
  const ys = todos.map((p) => p.y);
  const marcas = marcasDeEje(Math.min(...ys), Math.max(...ys));
  const yMin = marcas[0];
  const yMax = marcas[marcas.length - 1];

  // Leyenda: en columnas de a dos o tres, debajo del gráfico.
  const columnasLeyenda = conDatos.length > 8 ? 3 : 2;
  const filasLeyenda = Math.ceil(conDatos.length / columnasLeyenda);
  const altoLeyenda = filasLeyenda * 4.2 + 2;
  const total = 6 + (titulo ? 6 : 0) + (unidad ? 4 : 0) + alto + 9 + altoLeyenda + (fuente ? 5 : 0);

  l.separacion(1.5);
  l.reservar(total);
  const yMarco = l.y;
  l.y += 4.5;

  if (titulo) {
    l.escribir([{ texto: titulo, negrita: true }], { x: MARGEN + 4, ancho: ANCHO_UTIL - 8, puntos: 9.5, interlineado: 1.25 });
    l.separacion(0.8);
  }
  if (unidad) {
    l.fuente("courier", "normal", 7, GRIS);
    l.doc.text(unidad.toUpperCase(), MARGEN + 4, l.y + 2);
    l.separacion(4);
  }

  // Área de trazado, con sitio a la izquierda para las cifras del eje.
  l.fuente("courier", "normal", 6.8, GRIS);
  const anchoEtiquetas = Math.max(...marcas.map((m) => l.doc.getTextWidth(cifra(m)))) + 3;
  const x0 = MARGEN + 4 + anchoEtiquetas;
  const x1 = MARGEN + ANCHO_UTIL - 5;
  const y0 = l.y + 2;
  const y1 = y0 + alto;
  const px = (x) => (xs.length === 1 ? (x0 + x1) / 2 : x0 + ((x - xs[0]) / (xs[xs.length - 1] - xs[0])) * (x1 - x0));
  const py = (y) => y1 - ((y - yMin) / (yMax - yMin || 1)) * (y1 - y0);

  // Rejilla y eje Y.
  marcas.forEach((m) => {
    l.doc.setDrawColor(...LINEA);
    l.doc.setLineWidth(m === yMin ? 0.25 : 0.12);
    l.doc.line(x0, py(m), x1, py(m));
    l.fuente("courier", "normal", 6.8, GRIS);
    l.doc.text(cifra(m), x0 - 2, py(m) + 1, { align: "right" });
  });

  // Eje X: años. Si son muchos, uno de cada dos.
  const cadaCuanto = xs.length > 12 ? 2 : 1;
  const ultimoReal = Math.max(...conDatos.flatMap((s) => s.puntos.map((p) => p.x)));
  xs.forEach((x, i) => {
    if (i % cadaCuanto && i !== xs.length - 1) return;
    l.fuente("courier", "normal", 6.8, x > ultimoReal ? ACENTO_SUAVE : GRIS);
    l.doc.text(String(x), px(x), y1 + 4, { align: "center" });
  });
  // Separador entre lo observado y lo proyectado.
  if (xs[xs.length - 1] > ultimoReal) {
    l.doc.setDrawColor(...GRIS_CLARO);
    l.doc.setLineWidth(0.15);
    l.doc.setLineDashPattern([0.8, 0.8], 0);
    l.doc.line(px(ultimoReal), y0, px(ultimoReal), y1);
    l.doc.setLineDashPattern([], 0);
    l.fuente("courier", "normal", 6, GRIS_CLARO);
    l.doc.text("PROYECCIÓN", px(ultimoReal) + 1.5, y1 - 1.5);
  }

  // Series: las comunes primero, la destacada encima.
  const orden = [...conDatos.map((s, i) => ({ ...s, i }))].sort((a, b) => Number(a.destacada) - Number(b.destacada));
  for (const s of orden) {
    const color = s.destacada ? ACENTO : colorDeSerie(s.color, s.i);
    const trazo = (puntos) => {
      for (let k = 1; k < puntos.length; k += 1) {
        l.doc.line(px(puntos[k - 1].x), py(puntos[k - 1].y), px(puntos[k].x), py(puntos[k].y));
      }
    };
    l.doc.setDrawColor(...color);
    l.doc.setLineWidth(s.destacada ? 0.9 : 0.45);
    trazo(s.puntos);
    s.puntos.forEach((p) => {
      l.doc.setFillColor(...color);
      l.doc.circle(px(p.x), py(p.y), s.destacada ? 0.75 : 0.45, "F");
    });
    if (s.proyeccion?.length) {
      l.doc.setLineDashPattern([1.2, 1], 0);
      trazo([s.puntos[s.puntos.length - 1], ...s.proyeccion]);
      l.doc.setLineDashPattern([], 0);
    }
  }
  l.y = y1 + 8;

  // Leyenda.
  const anchoColumna = (ANCHO_UTIL - 8) / columnasLeyenda;
  conDatos.forEach((s, i) => {
    const cx = MARGEN + 4 + (i % columnasLeyenda) * anchoColumna;
    const cy = l.y + Math.floor(i / columnasLeyenda) * 4.2;
    l.doc.setFillColor(...(s.destacada ? ACENTO : colorDeSerie(s.color, i)));
    l.doc.rect(cx, cy + 0.6, 3.2, 1.6, "F");
    l.fuente("helvetica", s.destacada ? "bold" : "normal", 7.5, TINTA);
    l.doc.text(l.ajustar(s.nombre, anchoColumna - 7, 7.5, "helvetica", s.destacada ? "bold" : "normal")[0], cx + 4.8, cy + 2.2);
  });
  l.y += altoLeyenda;

  if (fuente) {
    l.fuente("courier", "normal", 7, GRIS_CLARO);
    l.doc.text(fuente.toUpperCase(), MARGEN + 4, l.y + 1.5);
    l.separacion(4);
  }

  l.y += 1.5;
  l.doc.setDrawColor(...LINEA);
  l.doc.setLineWidth(0.2);
  l.doc.rect(MARGEN, yMarco, ANCHO_UTIL, l.y - yMarco);
  l.separacion(4);
}

/** Color de un mapa de calor: de casi blanco al acento según `fraccion` (0–1). */
export function calor(fraccion) {
  const f = Math.max(0, Math.min(1, Number(fraccion) || 0));
  const desde = [246, 249, 253];
  const hasta = [150, 196, 238];
  return desde.map((c, i) => Math.round(c + (hasta[i] - c) * f));
}

/** Nota al pie de una sección: método, fuente o dónde está el detalle. */
export function nota(l, texto) {
  l.separacion(1);
  // Una nota partida entre dos páginas deja una línea suelta arriba de la
  // siguiente: se reserva entera.
  l.reservar(l.ajustar(texto.replace(/\*\*/g, ""), ANCHO_UTIL, 7.8, "helvetica", "normal").length * alturaLinea(7.8, 1.4) + 1);
  l.escribir(marcado(texto), { puntos: 7.8, color: GRIS, interlineado: 1.4 });
  l.separacion(2.5);
}

/** Bloque sin datos: se dice, en vez de dejar una sección vacía. */
export function vacio(l, texto) {
  l.reservar(14);
  l.doc.setFillColor(...FONDO_SUAVE);
  const lineas = l.ajustar(texto, ANCHO_UTIL - 10, 9, "helvetica", "italic");
  const alto = lineas.length * alturaLinea(9, 1.4) + 7;
  l.doc.rect(MARGEN, l.y, ANCHO_UTIL, alto, "F");
  l.fuente("helvetica", "italic", 9, GRIS);
  lineas.forEach((linea, i) => l.doc.text(linea, MARGEN + 5, l.y + 5.2 + i * alturaLinea(9, 1.4)));
  l.y += alto;
  l.separacion(4);
}

/** Id de la institución de quien pide el informe, por su nombre. Los informes la
 *  destacan como la del asistente destaca la que el usuario nombra. */
export function institucionPropia(usuario, universidades) {
  const nombre = String(usuario?.institucion || "").trim().toLowerCase();
  if (!nombre || !universidades?.length) return null;
  return universidades.find((u) => String(u.nombre_universidad || u.nombre || "").trim().toLowerCase() === nombre)
    ?.id_universidad ?? null;
}

/** Ficha común: quién pide el informe y cuándo. */
export const fichaDeEmision = (usuario, fecha) => [
  usuario?.institucion && `Institución: ${usuario.institucion}`,
  usuario?.nombre && `Solicitado por: ${usuario.nombre}`,
  `Emitido: ${fecha}`,
];
