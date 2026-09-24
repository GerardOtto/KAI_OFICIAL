/** Lectura del bloque ```kai-grafico que el asistente puede emitir.
 *
 *  Es un formato deliberadamente pobre: una línea por dato, `etiqueta: valor`.
 *  Un modelo de lenguaje acierta con esto casi siempre, y cuando se equivoca el
 *  bloque se muestra como código y no rompe nada. Lo leen dos consumidores —el
 *  chat, que dibuja un SVG, y el reporte, que dibuja sobre el PDF—, así que vive
 *  aquí y no dentro de ninguno de los dos.
 *
 *      ```kai-grafico
 *      titulo: Puntaje total en QS Latam 2024
 *      unidad: puntos
 *      destacar: PUCV
 *      fuente: base de datos de KAI
 *      PUCV: 62.3
 *      UC: 88.1
 *      ```
 */

// Claves de configuración. Todo lo demás que tenga la forma `algo: número` es un
// dato. Se aceptan con y sin tilde porque el modelo escribe de las dos maneras.
const CLAVES = {
  titulo: "titulo", título: "titulo",
  unidad: "unidad",
  fuente: "fuente",
  maximo: "maximo", máximo: "maximo",
  destacar: "destacar",
};

/** "1.234,5" · "62,3" · "62.3" · "45 %" -> número. `null` si no lo es. */
function numero(texto) {
  let t = String(texto).replace(/[%\s]/g, "").replace(/[$€]/g, "");
  if (!t) return null;
  const coma = t.lastIndexOf(",");
  const punto = t.lastIndexOf(".");
  // Con ambos separadores manda el último: es el decimal, y el otro agrupa
  // millares. Con uno solo, una coma siempre es decimal; un punto solo es
  // separador de millares si le siguen exactamente tres dígitos ("1.234").
  if (coma >= 0 && punto >= 0) {
    t = coma > punto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (coma >= 0) {
    t = t.replace(",", ".");
  } else if (punto >= 0 && /\.\d{3}$/.test(t) && t.replace(".", "").length > 3) {
    t = t.replace(/\./g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Texto del bloque -> `{titulo, unidad, fuente, maximo, destacar, datos}` o `null`.
 *
 *  Devuelve `null` cuando no hay al menos dos datos legibles: con uno solo una
 *  barra no compara nada, y quien llama debe mostrar el bloque tal cual.
 */
export function leerGrafico(fuente) {
  const meta = {};
  const datos = [];

  for (const linea of String(fuente || "").split("\n")) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;

    const separador = limpia.indexOf(":");
    if (separador < 0) continue;

    const clave = limpia.slice(0, separador).trim();
    const valor = limpia.slice(separador + 1).trim();
    const reservada = CLAVES[clave.toLowerCase()];
    if (reservada) {
      meta[reservada] = valor;
      continue;
    }

    // Dato. La etiqueta puede contener dos puntos ("THE 2024: Teaching"), así que
    // el corte se hace por el último, no por el primero.
    const corte = limpia.lastIndexOf(":");
    const etiqueta = limpia.slice(0, corte).trim();
    const n = numero(limpia.slice(corte + 1));
    if (etiqueta && n != null) datos.push({ etiqueta, valor: n });
  }

  if (datos.length < 2) return null;

  const tope = meta.maximo != null ? numero(meta.maximo) : null;
  const mayor = Math.max(...datos.map((d) => d.valor), 0);
  return {
    titulo: meta.titulo || "",
    unidad: meta.unidad || "",
    fuente: meta.fuente || "",
    destacar: meta.destacar || "",
    // El eje arranca en cero: una barra proporcional al valor es lo único que se
    // lee sin ejes ni marcas, y recortar la base exageraría las diferencias.
    maximo: tope && tope > 0 ? tope : mayor || 1,
    datos,
  };
}

/** Cifra con separadores en español y a lo sumo dos decimales. */
export function formatearValor(valor) {
  return Number(valor).toLocaleString("es-CL", {
    maximumFractionDigits: Number.isInteger(valor) ? 0 : 2,
  });
}

const sinTildes = (texto) =>
  String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** ¿`aguja` aparece en `texto` como palabra entera? */
const comoPalabra = (texto, aguja) =>
  new RegExp(`(^|[^a-z0-9])${escapar(aguja)}([^a-z0-9]|$)`).test(texto);

/** ¿La etiqueta es la que el bloque pidió destacar?
 *
 *  La comparación tiene que ser laxa —el modelo escribe «PUCV» en `destacar` y
 *  «PUCV (Valparaíso)» en la fila— pero no tanto como para aceptar cualquier
 *  subcadena: «UC» está contenida en «PUCV» y resaltaría a la institución
 *  equivocada. De ahí que la contención se exija por palabra entera.
 */
export function esDestacada(etiqueta, destacar) {
  const a = sinTildes(etiqueta);
  const b = sinTildes(destacar);
  if (!a || !b) return false;
  return a === b || comoPalabra(a, b) || comoPalabra(b, a);
}
