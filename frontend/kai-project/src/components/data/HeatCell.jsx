import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// alpha = 0.08 + (peso / 25) * 0.42, tope en 25% de peso para no saturar con Shanghai (30%)
function alphaForPeso(peso) {
  const clamped = Math.min(peso, 25);
  return 0.08 + (clamped / 25) * 0.42;
}

const ANCHO_GLOBO = 320;
const MARGEN = 10;
// Más líneas que estas no caben sin convertir el globo en una tabla; el resto se
// resume en una línea final.
const MAX_LINEAS = 7;

function numero(v, decimales = 2) {
  if (v == null) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("es-CL", { maximumFractionDigits: n % 1 === 0 ? 0 : decimales });
}

function porcentaje(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  // Un decimal solo cuando aporta: 30 % se lee mejor que 30,0 %.
  return `${n.toLocaleString("es-CL", { maximumFractionDigits: n % 1 === 0 ? 0 : 1 })} %`;
}

/** Globo flotante con el desglose de la celda.
 *
 *  Va en un portal con posición fija porque la matriz vive dentro de un
 *  contenedor con desplazamiento horizontal: un globo posicionado dentro de la
 *  celda quedaría recortado por ese contenedor en las columnas de los extremos.
 */
function Globo({ rect, dimension, ranking, datos }) {
  // Encima de la celda si hay sitio; si no, debajo. El alto estimado basta para
  // decidir, y evita tener que medir y repintar.
  const altoEstimado = 90 + Math.min(datos.metricas.length, MAX_LINEAS) * 17;
  const arriba = rect.top > altoEstimado + MARGEN;

  const izquierda = Math.min(
    Math.max(MARGEN, rect.left + rect.width / 2 - ANCHO_GLOBO / 2),
    window.innerWidth - ANCHO_GLOBO - MARGEN
  );

  const visibles = datos.metricas.slice(0, MAX_LINEAS);
  const ocultas = datos.metricas.length - visibles.length;

  return createPortal(
    <div
      role="tooltip"
      className="fixed z-[60] pointer-events-none bg-[#0f0f0f] border border-outline/60 shadow-2xl"
      style={{
        width: ANCHO_GLOBO,
        left: izquierda,
        top: arriba ? rect.top - altoEstimado - MARGEN : rect.bottom + MARGEN,
      }}
    >
      <div className="px-3 py-2 border-b border-outline/30">
        <p className="font-body text-[12px] font-semibold text-white leading-tight">{dimension}</p>
        <p className="font-mono text-[9px] uppercase tracking-widest text-outlineSoft mt-0.5">{ranking}</p>
      </div>

      <div className="px-3 py-2 border-b border-outline/30">
        <p className="text-[11px] text-[#c4c4c4] leading-relaxed">
          <span className="font-semibold text-white">{porcentaje(datos.peso)}</span>{" "}
          {datos.multi
            ? `del peso de una disciplina, en promedio sobre ${datos.nDisciplinas} disciplinas`
            : "del peso del ranking"}
        </p>
        {datos.valor != null && (
          <p className="text-[11px] text-[#c4c4c4] leading-relaxed mt-1">
            {datos.multi ? "Promedio de " : ""}
            <span className="font-mono text-white">{datos.principal}</span>
            {": "}
            <span className="font-semibold text-white">{numero(datos.valor)}</span>
            {datos.multi && datos.disciplinasConDato > 0 && (
              <span className="text-outlineSoft"> · {datos.disciplinasConDato} disciplinas con dato</span>
            )}
          </p>
        )}
      </div>

      <div className="px-3 py-2 flex flex-col gap-1">
        {visibles.map(m => (
          <div key={m.nombre} className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] text-[#c4c4c4] truncate">{m.nombre}</span>
            <span className="font-mono text-[10px] text-outlineSoft shrink-0 tabular-nums">
              {porcentaje(m.peso)}
              {m.valor != null && <span className="text-white"> · {numero(m.valor)}</span>}
            </span>
          </div>
        ))}
        {ocultas > 0 && (
          <p className="font-mono text-[9px] uppercase tracking-widest text-outlineSoft pt-0.5">
            y {ocultas} métrica{ocultas === 1 ? "" : "s"} más
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function HeatCell({ datos, dimension, ranking, valorFormateado }) {
  const [rect, setRect] = useState(null);
  const refCelda = useRef(null);

  const entrar = useCallback(() => {
    if (refCelda.current) setRect(refCelda.current.getBoundingClientRect());
  }, []);
  const salir = useCallback(() => setRect(null), []);

  const tieneMetrica = datos != null;
  const style = tieneMetrica
    ? { backgroundColor: `oklch(0.72 0.13 250 / ${alphaForPeso(datos.peso)})`, borderColor: "rgba(255,255,255,.08)" }
    : { backgroundColor: "rgba(255,255,255,.02)", borderColor: "rgba(255,255,255,.05)" };

  const valor = datos?.valor ?? null;

  return (
    <>
      <div
        ref={refCelda}
        onMouseEnter={tieneMetrica ? entrar : undefined}
        onMouseLeave={tieneMetrica ? salir : undefined}
        onFocus={tieneMetrica ? entrar : undefined}
        onBlur={tieneMetrica ? salir : undefined}
        tabIndex={tieneMetrica ? 0 : undefined}
        className={`h-14 border p-2 px-2.5 flex flex-col justify-between transition-colors ${
          tieneMetrica ? "cursor-help outline-none focus:border-white/40" : ""
        }`}
        style={style}
      >
        <span className="font-mono text-[9.5px] flex items-center gap-1"
              style={{ color: tieneMetrica ? "rgba(255,255,255,.6)" : "#5a5a5a" }}>
          {tieneMetrica ? porcentaje(datos.peso) : "no mide"}
          {/* Marca que la cifra es un promedio entre disciplinas y no una suma:
              sin ella, un 53 % de GRAS y uno de QS se leerían como lo mismo. Se
              escribe la palabra en vez de un símbolo como ⌀, que según la fuente
              cae en un glifo parecido a «ø» y no se entiende. */}
          {datos?.multi && (
            <span className="px-1 border border-white/20 text-[8px] uppercase tracking-wider"
                  title="Promedio entre disciplinas">
              prom
            </span>
          )}
        </span>
        <span className="font-mono font-semibold text-[15px]" style={{ color: valor != null ? "#fff" : "#6f6f6f" }}>
          {valor != null ? (valorFormateado ?? numero(valor)) : "—"}
        </span>
      </div>

      {rect && tieneMetrica && (
        <Globo rect={rect} dimension={dimension} ranking={ranking} datos={datos} />
      )}
    </>
  );
}
