import { leerGrafico, formatearValor, esDestacada } from "../../reportes/grafico";

/** Barras horizontales para el bloque ```kai-grafico de una respuesta.
 *
 *  Sin biblioteca de gráficos ni SVG: son divs con un ancho porcentual. Un
 *  gráfico de barras no necesita más, y así la fila se adapta al ancho del
 *  mensaje sin medir nada.
 *
 *  La etiqueta va encima de su barra, no en una columna a la izquierda: los
 *  nombres de institución son largos y desiguales, y una columna fija los
 *  recortaría o dejaría media fila en blanco.
 */
export default function GraficoBarras({ fuente }) {
  const g = leerGrafico(fuente);

  // Bloque mal formado: se muestra tal cual. Perder el dato sería peor que
  // enseñarlo sin dibujar.
  if (!g) {
    return (
      <pre className="my-3 overflow-x-auto bg-surfaceHigh border border-outline/40 p-3 font-mono text-[12px] leading-relaxed">
        {fuente}
      </pre>
    );
  }

  return (
    <figure className="my-4 border border-outline/40 bg-surface/40 px-4 py-3.5">
      {g.titulo && (
        <figcaption className="font-body text-[12.5px] font-semibold text-white leading-snug mb-0.5">
          {g.titulo}
        </figcaption>
      )}
      {g.unidad && (
        <p className="font-mono text-[9.5px] uppercase tracking-widest text-outlineSoft mb-3">{g.unidad}</p>
      )}

      <div className={`flex flex-col gap-2.5 ${g.unidad ? "" : "mt-3"}`}>
        {g.datos.map((d, i) => {
          const destacada = esDestacada(d.etiqueta, g.destacar);
          const ancho = Math.max((d.valor / g.maximo) * 100, d.valor > 0 ? 1.5 : 0);
          return (
            <div key={`${d.etiqueta}-${i}`}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className={`text-[11.5px] leading-tight ${destacada ? "text-white font-semibold" : "text-white/75"}`}>
                  {d.etiqueta}
                </span>
                <span className={`font-mono text-[11px] tabular-nums shrink-0 ${destacada ? "text-white" : "text-white/60"}`}>
                  {formatearValor(d.valor)}
                </span>
              </div>
              <div className="h-[7px] bg-white/[.06]">
                <div
                  className="h-full"
                  style={{
                    width: `${ancho}%`,
                    backgroundColor: destacada ? "#fff" : "oklch(0.72 0.13 250)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {g.fuente && (
        <p className="font-mono text-[9px] uppercase tracking-widest text-[#6f6f6f] mt-3">Fuente: {g.fuente}</p>
      )}
    </figure>
  );
}
