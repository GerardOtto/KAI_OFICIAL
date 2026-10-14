/** Nombres de las universidades tal como se escriben.
 *
 * La base los guarda sin tildes («Pontificia Universidad Catolica de
 * Valparaiso»), y así llegan en cada respuesta del backend. Cambiarlos allá
 * obligaría a migrar las cuentas, los dominios institucionales y lo que el
 * asistente ya aprendió a consultar, así que la corrección vive en la interfaz:
 * los hooks de datos pasan cada nombre por `nombreUniversidad` antes de
 * entregarlo, y toda comparación de nombres se hace con `normalizar`, que ignora
 * tildes y mayúsculas. Lo que se envía al backend —la institución elegida al
 * registrarse— sigue siendo el nombre de la base.
 */

/** Minúsculas, sin tildes ni espacios sobrantes: para comparar y para buscar. */
export const normalizar = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const CON_TILDE = [
  "Pontificia Universidad Católica de Chile",
  "Pontificia Universidad Católica de Valparaíso",
  "Universidad Adolfo Ibáñez",
  "Universidad Andrés Bello",
  "Universidad Autónoma de Chile",
  "Universidad Católica Cardenal Raúl Silva Henríquez",
  "Universidad Católica de la Santísima Concepción",
  "Universidad Católica de Temuco",
  "Universidad Católica del Maule",
  "Universidad Católica del Norte",
  "Universidad de Artes, Ciencias y Comunicación",
  "Universidad de Concepción",
  "Universidad de La Frontera",
  "Universidad de Las Américas",
  "Universidad de Tarapacá",
  "Universidad de Valparaíso",
  "Universidad de Viña del Mar",
  "Universidad del Bío-Bío",
  "Universidad del Pacífico",
  "Universidad Iberoamericana de Ciencias y Tecnología",
  "Universidad La República",
  "Universidad Metropolitana de Ciencias de la Educación",
  "Universidad San Sebastián",
  "Universidad Santo Tomás",
  "Universidad Técnica Federico Santa María",
  "Universidad Tecnológica de Chile",
  "Universidad Tecnológica Metropolitana",
  "Universidad UCINF",
];

const POR_CLAVE = new Map(CON_TILDE.map((n) => [normalizar(n), n]));

/** El nombre con sus tildes. Uno que no está en la lista se devuelve tal cual. */
export const nombreUniversidad = (nombre) => POR_CLAVE.get(normalizar(nombre)) ?? nombre;

/** Nombre abreviado para chips y leyendas angostas: «PUC de Valparaíso», «U. de
 *  Chile». Truncar dejaba «Pontificia Universidad Catól…» dos veces seguidas, y
 *  «Universidad d…» para tres instituciones distintas. Se abrevia de forma
 *  mecánica, sin siglas, para no arriesgar una que no corresponda; el nombre
 *  completo va en el título emergente. */
export const nombreCorto = (nombre) => String(nombre ?? "")
  .replace(/^Pontificia Universidad Católica\b/, "PUC")
  .replace(/^Universidad\b/, "U.");

/** Las mismas filas, con el nombre corregido en los campos que lo traen. */
export const conNombres = (filas) =>
  (Array.isArray(filas) ? filas : []).map((f) => {
    const copia = { ...f };
    if (typeof f?.nombre_universidad === "string") copia.nombre_universidad = nombreUniversidad(f.nombre_universidad);
    if (typeof f?.universidad === "string") copia.universidad = nombreUniversidad(f.universidad);
    return copia;
  });

/** El id de la institución de la cuenta dentro de una lista, sin importar tildes. */
export function idDeInstitucion(institucion, universidades) {
  const clave = normalizar(institucion);
  if (!clave || !universidades?.length) return null;
  return universidades.find((u) => normalizar(u.nombre_universidad ?? u.nombre) === clave)
    ?.id_universidad ?? null;
}
