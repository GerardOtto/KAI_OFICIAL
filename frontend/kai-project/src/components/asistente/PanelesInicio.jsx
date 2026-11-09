import { CONSULTAS_GUIADAS } from "./consultasGuiadas";
import { ESTILO_RANKING } from "./estiloRankings";
import { COLOR_MOTOR, DEMOS } from "./demos";

const Candado = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="1" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const Flecha = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const Descarga = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
  </svg>
);

/** Destello de cuatro puntas, en el color del motor. */
const Destello = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 1c.6 5.4 5.6 10.4 11 11-5.4.6-10.4 5.6-11 11-.6-5.4-5.6-10.4-11-11 5.4-.6 10.4-5.6 11-11z" fill={color} />
  </svg>
);

/** Recuadro de un motor: franja con su degradado, encabezado y lista de botones. */
function Recuadro({ motor, etiqueta, titulo, bajada, pie, children }) {
  const c = COLOR_MOTOR[motor];
  return (
    <section
      aria-label={titulo}
      data-panel={motor}
      className="flex flex-col border text-left"
      style={{ borderColor: `${c.acento}66`, backgroundColor: c.fondo }}
    >
      <div className="h-1" style={{ background: c.degradado }} />
      <header className="px-4 pt-3.5 pb-3 border-b" style={{ borderColor: `${c.acento}33` }}>
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest" style={{ color: c.acento }}>
          <Destello color={c.acento} /> {etiqueta}
        </p>
        <p className="mt-1.5 text-[15px] font-bold text-white leading-tight">{titulo}</p>
        <p className="mt-0.5 text-[11.5px] text-[#a8a8a8] leading-snug">{bajada}</p>
      </header>
      <div className="flex flex-col gap-2 p-3 flex-1">{children}</div>
      <p className="px-4 pb-3 text-[10.5px] text-[#8a8a8a] leading-relaxed">{pie}</p>
    </section>
  );
}

/** Contenido de una fila: franja del color del ranking, ícono, textos y acción. */
function Fila({ estilo, rotulo, nombre, bajada, accion }) {
  const e = ESTILO_RANKING[estilo];
  return (
    <>
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: e.fondo }} aria-hidden="true" />
      <img src={e.icono} alt="" width="36" height="36" className="w-9 h-9 shrink-0 rounded-[6px] ring-1 ring-black/20" />
      <span className="flex-1 min-w-0">
        <span className="block font-mono text-[9px] uppercase tracking-widest text-outlineSoft">{rotulo}</span>
        <span className="block text-[14.5px] font-bold text-white leading-tight mt-0.5">{nombre}</span>
        <span className="block text-[11.5px] text-[#a8a8a8] leading-snug mt-0.5">{bajada}</span>
      </span>
      <span className="shrink-0 text-outlineSoft transition-colors group-hover:text-white">{accion}</span>
    </>
  );
}

const CLASE_FILA =
  "group relative flex items-center gap-3 pl-4 pr-3 py-2.5 bg-[#1c1c1c] border border-white/10 text-left " +
  "transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:bg-[#232323] " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** Chat vacío: dos recuadros lado a lado para que se vea qué es qué.
 *
 *  - **Gemini** (izquierda): los informes de brechas en vivo. Se envían siempre
 *    con Gemini, aunque el selector esté en Claude, porque es lo que el recuadro
 *    promete; usan una consulta del plan.
 *  - **Claude** (derecha): diagnósticos de muestra ya elaborados con Claude, que
 *    se descargan como PDF estáticos. No pasan por el servidor ni gastan cuota,
 *    así que nunca se deshabilitan.
 *
 *  En el teléfono los recuadros se apilan, Gemini primero.
 */
export default function PanelesInicio({ onBrecha, brechasDeshabilitadas = false, motivoDeshabilitado = "", restringidos = [] }) {
  const vedados = new Set(restringidos.map((r) => r.nombre_ranking));
  const hayVedados = CONSULTAS_GUIADAS.some((c) => vedados.has(c.ranking));

  return (
    <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Recuadro
        motor="gemini"
        etiqueta="Gratis con Gemini"
        titulo="Informes de brechas en vivo"
        bajada="Dónde quedan más atrás la PUCV y la UV, y qué cifra necesitan. Se generan al momento."
        pie={
          <>
            {brechasDeshabilitadas && motivoDeshabilitado
              ? motivoDeshabilitado
              : "Cada informe usa una consulta de tu plan y se puede descargar en PDF."}
            {hayVedados && (
              <>
                {" "}QS y THE están en los planes de pago.{" "}
                <a href="/#planes" className="text-white/80 underline underline-offset-2 hover:text-white">Ver planes</a>
              </>
            )}
          </>
        }
      >
        {CONSULTAS_GUIADAS.map((c) => {
          const vedado = vedados.has(c.ranking);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onBrecha(c)}
              disabled={brechasDeshabilitadas || vedado}
              aria-label={vedado ? `${c.nombre}: disponible en los planes de pago` : `${c.pregunta} (con Gemini)`}
              title={vedado ? `${c.nombre} está reservado a los planes de pago.` : `${c.pregunta} · se responde con Gemini`}
              data-consulta={c.id}
              className={`${CLASE_FILA} disabled:cursor-not-allowed disabled:opacity-45 disabled:grayscale disabled:hover:translate-y-0`}
            >
              <Fila
                estilo={c.id}
                rotulo={vedado ? "Plan de pago" : "Informe de brechas"}
                nombre={c.nombre}
                bajada={c.bajada}
                accion={vedado ? <Candado /> : <Flecha />}
              />
            </button>
          );
        })}
      </Recuadro>

      <Recuadro
        motor="claude"
        etiqueta="Demo · exclusivo de Claude"
        titulo="Diagnósticos completos de muestra"
        bajada="Lo que entrega el motor de análisis Claude: cifras, metas para el top 10 y acciones concretas."
        pie="Son diagnósticos ya elaborados: se descargan en PDF y no gastan consultas."
      >
        {DEMOS.map((d) => (
          <a
            key={d.id}
            href={`${import.meta.env.BASE_URL}demos/${d.archivo}`}
            download={d.archivo}
            aria-label={`Demo de Claude: descargar el diagnóstico ${d.nombre} en PDF`}
            title={`Descargar el diagnóstico de muestra ${d.nombre} (PDF)`}
            data-demo={d.id}
            className={CLASE_FILA}
          >
            <Fila estilo={d.estilo} rotulo="Demo · PDF" nombre={d.nombre} bajada={d.bajada} accion={<Descarga />} />
          </a>
        ))}
      </Recuadro>
    </div>
  );
}
