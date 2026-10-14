import { cabeceraAuth } from "../auth/AuthContext";

/** Caché en memoria de las respuestas de datos, compartida por los hooks.
 *
 * Los datos académicos no cambian mientras se navega, así que pedirlos dos veces
 * solo agrega espera. Sobre todo al alternar Puntajes y Valores: cada módulo
 * pide en segundo plano el modo que no se está viendo (`precargar`), y el switch
 * pasa a ser solo mostrar u ocultar lo que ya llegó, sin parpadeos ni llamadas.
 *
 * - La clave lleva el token: cada sesión tiene su caché, y cerrar sesión o
 *   entrar con otra cuenta no reutiliza respuestas ajenas.
 * - Solo se guardan las respuestas correctas. Un 403 —un ranking que el plan no
 *   incluye— se devuelve pero no se recuerda, para que al cambiar de plan no
 *   quede tapado por un rechazo viejo.
 * - Dos pedidos iguales en vuelo comparten la misma petición.
 * - `nombre` distingue transformaciones distintas de una misma ruta: lo que se
 *   guarda es el resultado ya transformado (por ejemplo, con los nombres de las
 *   universidades corregidos), y así cada lectura devuelve el mismo objeto.
 */
const MAX_ENTRADAS = 400;
const resueltos = new Map();
const enVuelo = new Map();

const claveDe = (ruta, nombre) => `${cabeceraAuth().Authorization || ""}|${nombre}|${ruta}`;

function guardar(clave, datos) {
  resueltos.delete(clave);
  resueltos.set(clave, datos);
  // Se descarta lo más antiguo: Map conserva el orden de inserción.
  while (resueltos.size > MAX_ENTRADAS) resueltos.delete(resueltos.keys().next().value);
}

/** Lo que ya está en caché para esa ruta, o `undefined`. Sin efectos. */
export function leer(ruta, nombre = "") {
  return ruta ? resueltos.get(claveDe(ruta, nombre)) : undefined;
}

/** Pide la ruta (relativa a la API) una sola vez y devuelve su resultado transformado. */
export function pedir(ruta, transformar = (d) => d, nombre = "") {
  const clave = claveDe(ruta, nombre);
  if (resueltos.has(clave)) return Promise.resolve(resueltos.get(clave));
  if (enVuelo.has(clave)) return enVuelo.get(clave);
  const promesa = fetch(`${import.meta.env.VITE_API_URL}${ruta}`, { headers: cabeceraAuth() })
    .then(async (r) => {
      const cuerpo = await r.json().catch(() => null);
      // La transformación recibe también la respuesta, por si necesita su estado.
      const datos = transformar(cuerpo, r);
      if (r.ok) guardar(clave, datos);
      return datos;
    })
    .finally(() => enVuelo.delete(clave));
  enVuelo.set(clave, promesa);
  return promesa;
}

/** Pide en segundo plano lo que probablemente se va a necesitar enseguida. */
export function precargar(ruta, transformar, nombre) {
  if (!ruta || resueltos.has(claveDe(ruta, nombre))) return;
  pedir(ruta, transformar, nombre).catch(() => {});
}

/** El otro modo del switch global. */
export const otroModo = (modo) => (modo === "numerico" ? "puntajes" : "numerico");
