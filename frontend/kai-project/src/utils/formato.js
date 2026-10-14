/** Cifras como se escriben en Chile: coma decimal y punto de miles.
 *
 *  `toFixed` escribe «73.2», que en el resto del sitio —tablas, PDF, glosario—
 *  se lee «73,2». Simulación lo usaba en pantalla y era la única que mezclaba los
 *  dos formatos.
 */
export const decimal = (v, d = 1) =>
  Number(v ?? 0).toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Con signo explícito cuando es positivo: «+1,5», «-0,3». */
export const conSigno = (v, d = 1) => `${Number(v) > 0 ? "+" : ""}${decimal(v, d)}`;

/** Un peso o una proporción: «7,5 %», «30 %». Decimales solo si los tiene. */
export const porcentaje = (v) =>
  `${Number(v ?? 0).toLocaleString("es-CL", { maximumFractionDigits: 2 })} %`;
