/** Convierte la respuesta de un endpoint de listado en una lista, siempre.
 *
 * Los endpoints de datos devuelven un arreglo cuando todo va bien y un objeto
 * `{detail: "..."}` cuando rechazan la petición —sin sesión, o con un ranking
 * que el plan no incluye—. Los hooks guardaban ese objeto tal cual y el primer
 * `.map()` posterior tumbaba la vista entera con «no es una función».
 *
 * Que el módulo no se caiga ante un 403 importa: es una respuesta prevista del
 * servidor, no un fallo. La vista queda vacía, que es lo que corresponde.
 */
export function comoLista(datos) {
  return Array.isArray(datos) ? datos : [];
}
