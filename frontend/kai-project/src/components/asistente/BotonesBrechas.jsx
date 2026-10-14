import { CONSULTAS_GUIADAS } from "./consultasGuiadas";
import { ESTILO_RANKING } from "./estiloRankings";

const Candado = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="1" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const Flecha = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** Los cuatro informes de brechas que ocupan el chat vacío.
 *
 *  Reemplazan a las preguntas de ejemplo: en vez de sugerir qué escribir,
 *  entregan de un clic el análisis más completo que sabe hacer el asistente.
 *  Un ranking que el plan no incluye se muestra con candado y no se envía: el
 *  servidor le negaría los datos al asistente y la consulta se gastaría en un
 *  «no hay datos».
 */
export default function BotonesBrechas({ onElegir, deshabilitado = false, restringidos = [] }) {
  const vedados = new Set(restringidos.map((r) => r.nombre_ranking));
  const hayVedados = CONSULTAS_GUIADAS.some((c) => vedados.has(c.ranking));

  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-outlineSoft">
          Informes de brechas · PUCV y UV
        </p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#6f6f6f]">Un clic</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CONSULTAS_GUIADAS.map((c) => {
          const e = ESTILO_RANKING[c.id];
          const vedado = vedados.has(c.ranking);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onElegir(c)}
              disabled={deshabilitado || vedado}
              aria-label={vedado ? `${c.nombre}: disponible en los planes de pago` : c.pregunta}
              title={vedado ? `${c.nombre} está reservado a los planes de pago.` : c.pregunta}
              data-consulta={c.id}
              style={{ backgroundColor: e.fondo, color: e.tinta, borderColor: e.borde, "--brillo": e.fondo }}
              className="group relative flex items-start gap-3.5 p-4 text-left border transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-14px_var(--brillo)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:grayscale disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              <img
                src={e.icono}
                alt=""
                width="44"
                height="44"
                className="w-11 h-11 shrink-0 rounded-[7px] ring-1 ring-black/20"
              />
              <span className="flex-1 min-w-0">
                <span className="block font-mono text-[9.5px] uppercase tracking-widest opacity-70">
                  {vedado ? "Plan de pago" : "Informe de brechas"}
                </span>
                <span className="block text-[17px] font-bold leading-tight mt-0.5">{c.nombre}</span>
                <span className="block text-[12px] leading-snug mt-1 opacity-80">{c.bajada}</span>
              </span>
              <span className="shrink-0 mt-0.5 opacity-80 transition-transform duration-200 group-hover:translate-x-0.5 group-disabled:translate-x-0">
                {vedado ? <Candado /> : <Flecha />}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-[#7a7a7a] leading-relaxed">
        Cada informe usa una consulta y se puede descargar en PDF. También puedes escribir tu propia pregunta abajo.
        {hayVedados && (
          <>
            {" "}QS y THE están en los planes de pago.{" "}
            <a href="/#planes" className="text-white/80 underline underline-offset-2 hover:text-white">Ver planes</a>
          </>
        )}
      </p>
    </div>
  );
}
