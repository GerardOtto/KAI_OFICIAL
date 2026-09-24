// Lógica del revelado progresivo de una respuesta del asistente.
//
// El servidor entrega la respuesta completa en una sola pieza —no hay flujo de
// datos token a token—, así que la aparición gradual se compone en el navegador
// sobre un texto que ya está entero. Eso la hace gratuita: ni una petición más,
// ni un token más, ni un cambio en el backend.
//
// Aquí vive solo la parte pura y comprobable; el temporizador está en
// `useRevelado.js` y la presentación, en `Markdown.jsx`.

/** Milisegundos por palabra. Ritmo de lectura, no de escritura: el objetivo es
 *  que la respuesta se asiente a la vista, no simular a alguien tecleando. */
export const MS_POR_PALABRA = 12;

/** La respuesta más corta dura lo suficiente para verse aparecer… */
export const DURACION_MINIMA = 300;
/** …y la más larga no hace esperar por algo que ya está descargado. */
export const DURACION_MAXIMA = 2000;

/** Cada cuánto se vuelve a dibujar, como mucho.
 *
 * El texto revelado se reinterpreta como Markdown en cada avance, así que el
 * ritmo se limita a unos 25 dibujos por segundo en vez de seguir al monitor:
 * por encima de eso el ojo ya no distingue la diferencia y el analizador sí. */
export const MS_ENTRE_DIBUJOS = 40;

/** Cuánto debe durar el revelado de un texto de `palabras` palabras. */
export function duracion(palabras) {
  return Math.min(DURACION_MAXIMA, Math.max(DURACION_MINIMA, palabras * MS_POR_PALABRA));
}

/** Posiciones donde el texto puede cortarse sin partir una palabra.
 *
 * Se revela palabra a palabra y no letra a letra porque una palabra a medias se
 * lee como una errata: el ojo intenta completarla y tropieza.
 */
export function cortes(texto) {
  const puntos = [];
  for (const coincidencia of String(texto).matchAll(/\S+/g)) {
    puntos.push(coincidencia.index + coincidencia[0].length);
  }
  if (puntos[puntos.length - 1] !== texto.length) puntos.push(texto.length);
  return puntos;
}

/** Índice de la línea que abre un bloque cercado todavía sin cerrar, o -1. */
function cercaAbierta(lineas) {
  let ultima = -1;
  let abiertas = 0;
  lineas.forEach((linea, i) => {
    if (/^\s*```/.test(linea)) {
      abiertas += 1;
      ultima = i;
    }
  });
  return abiertas % 2 === 1 ? ultima : -1;
}

/** Índice donde empieza la tabla en curso al final del texto, o -1.
 *
 * Una tabla de Markdown no existe hasta que están su encabezado y la fila de
 * guiones: revelada fila a fila se vería primero como párrafo, luego como tabla
 * de una fila y así, dando un salto en cada avance. Se deja oculta mientras
 * crece y aparece de una vez cuando termina.
 */
function tablaEnCurso(lineas) {
  let fin = lineas.length - 1;
  while (fin >= 0 && lineas[fin].trim() === "") fin -= 1;
  if (fin < 0 || !lineas[fin].trim().startsWith("|")) return -1;
  let inicio = fin;
  while (inicio > 0 && lineas[inicio - 1].trim().startsWith("|")) inicio -= 1;
  return inicio;
}

/** Recorta un texto revelado a medias hasta donde el marcado está completo.
 *
 * Sin esto, el revelado enseña marcado en construcción: un bloque de gráfico sin
 * su cierre se dibuja como código, una tabla a medias salta de párrafo a tabla y
 * los asteriscos de una negrita sin terminar se ven literales. El recorte solo
 * se aplica mientras la respuesta aparece; una vez completa se muestra tal cual.
 */
export function recorteSeguro(texto) {
  const lineas = String(texto).split("\n");

  const abierta = cercaAbierta(lineas);
  if (abierta >= 0) lineas.length = abierta;

  const tabla = tablaEnCurso(lineas);
  if (tabla >= 0) lineas.length = tabla;

  const recortado = lineas.join("\n");
  // Los delimitadores sueltos del final pertenecen a un énfasis que aún no se
  // ha cerrado. Se omite el caso del cierre de un bloque cercado: quitarle las
  // comillas lo reabriría.
  const ultima = lineas[lineas.length - 1] || "";
  return /^\s*```/.test(ultima) ? recortado : recortado.replace(/\s*[*_~`]+$/, "");
}

/** Si el sistema pide evitar animaciones, el revelado no se ejecuta.
 *
 * Es una preferencia de accesibilidad del sistema operativo: hay quien sufre
 * mareo o desorientación con el movimiento en pantalla.
 */
export function reducirMovimiento() {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}
