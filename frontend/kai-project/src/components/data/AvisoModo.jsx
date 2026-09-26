/** Aviso del switch global cuando un módulo no puede mostrar lo que se pidió.
 *
 * Con el switch en «Valores», dos situaciones obligan a mostrar puntajes y a
 * decirlo: que el ranking no tenga cifras medidas detrás (Shanghai, QS por
 * Disciplina), o que el módulo no pueda convertir la cifra en puntaje (simular
 * en THE o QS, cuya normalización usa parámetros que no publican). Se dice en el
 * mismo lugar y con las mismas palabras en los cuatro módulos.
 */
const TEXTOS = {
  sinValores: (ranking) =>
    `${ranking} solo publica puntajes normalizados: no hay cifras medidas detrás. Se muestran sus puntajes.`,
  noSimulable: (ranking) =>
    `En ${ranking} el puntaje no se puede recalcular desde la cifra medida: el ranking lo normaliza con parámetros que no publica. La simulación usa puntajes; las cifras de cada componente se ven en Resumen y Tendencias.`,
};

export default function AvisoModo({ tipo, ranking }) {
  const texto = TEXTOS[tipo]?.(ranking ?? "Este ranking");
  if (!texto) return null;
  return (
    <p role="note" className="mb-4 border border-[#b8862b]/40 bg-[#1d1810] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[#cfc3a8]">
      <span className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#e0b25a] mr-2">Valores</span>
      {texto}
    </p>
  );
}
