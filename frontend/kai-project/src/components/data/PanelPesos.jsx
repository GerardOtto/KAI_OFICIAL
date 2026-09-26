import { participacion, pesosModificados, sumaPesos } from "../../utils/rankingPonderado";

const PESO_MAXIMO = 30;

/** Deslizadores para repartir el peso entre las métricas de un ranking editable.
 *
 * Cada deslizador fija la importancia relativa de una métrica, no un porcentaje
 * que deba cuadrar a 100: obligar a que sumen 100 haría que subir una bajara las
 * demás por sorpresa. Al lado se muestra la parte del total que efectivamente
 * representa, que es lo que el usuario necesita leer.
 */
export default function PanelPesos({ metricas, pesos, onCambio, onRestablecer }) {
  const partes = participacion(pesos);
  const modificados = pesosModificados(pesos, metricas);
  const sinPeso = sumaPesos(pesos) === 0;

  return (
    <section
      aria-labelledby="titulo-pesos"
      className="mb-5 border border-white/[.12] bg-[#161616] px-4 py-4"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
        <div className="max-w-[760px]">
          <h2 id="titulo-pesos" className="font-mono text-[10px] uppercase tracking-[.14em] text-[#9a9a9a]">
            Pesos de las métricas
          </h2>
          <p className="text-xs text-[#8a8a8a] leading-relaxed mt-1.5">
            Por defecto todas pesan lo mismo. Mueve un deslizador para darle más o menos
            importancia a una métrica y el orden se recalcula al instante: son tus criterios
            sobre datos públicos, no una opinión de KAI sobre qué universidad es mejor.
          </p>
        </div>
        <button
          type="button"
          onClick={onRestablecer}
          disabled={!modificados}
          className="bg-[#1c1c1c] border border-white/[.14] text-[#cfcfcf] text-[11px] py-2 px-3 hover:border-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          Pesos parejos
        </button>
      </div>

      <div className="grid gap-x-6 gap-y-2.5 grid-cols-1 md:grid-cols-2">
        {metricas.map((m) => {
          const w = pesos[m.id_metrica] ?? m.peso_metrica;
          const id = `peso-${m.id_metrica}`;
          return (
            <div key={m.id_metrica} className="grid items-center gap-3" style={{ gridTemplateColumns: "minmax(0,1fr) 120px 54px" }}>
              <label htmlFor={id} className="text-[12px] text-[#dcdcdc] truncate" title={m.nombre_metrica}>
                {m.nombre_metrica}
              </label>
              <input
                id={id}
                type="range"
                min={0}
                max={PESO_MAXIMO}
                step={1}
                value={w}
                onChange={(e) => onCambio(m.id_metrica, Number(e.target.value))}
                aria-valuetext={`peso ${w}, ${partes[m.id_metrica]?.toFixed(0) ?? 0} % del total`}
                className="w-full cursor-pointer accent-white"
              />
              <span className={`font-mono text-[11px] tabular-nums text-right ${w === 0 ? "text-[#5f5f5f]" : "text-[#cfcfcf]"}`}>
                {partes[m.id_metrica]?.toFixed(0) ?? 0} %
              </span>
            </div>
          );
        })}
      </div>

      {sinPeso && (
        <p role="alert" className="mt-3 text-[11px] text-negative">
          Todas las métricas quedaron en cero: dale peso al menos a una para ordenar el ranking.
        </p>
      )}
    </section>
  );
}
