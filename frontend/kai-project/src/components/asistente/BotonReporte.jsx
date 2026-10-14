const IconoPdf = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M12 11v6M9 14l3 3 3-3" />
  </svg>
);

const Girando = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-6.2-8.56" strokeLinecap="round" />
  </svg>
);

/** Botón del reporte ejecutivo bajo cada respuesta del asistente.
 *
 *  Es la salida de la herramienta —un PDF que se adjunta a un correo o se lleva
 *  a una reunión—, así que no se esconde como un enlace más: el de la última
 *  respuesta va relleno con el acento, con un destello periódico y una frase
 *  que dice qué se obtiene; los de las anteriores, delineados. Con el plan
 *  gratuito, que incluye un reporte, lo dice: es un incentivo, no una letra
 *  chica.
 */
export default function BotonReporte({
  onClick, destacado = false, componiendo = false, ocupado = false,
  agotado = false, motivoAgotado = "", incluidos = null,
}) {
  if (agotado) {
    return (
      <span className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          disabled
          title={motivoAgotado}
          className="flex items-center gap-2 px-3.5 py-2 border border-outline/40 font-mono text-[10px] uppercase tracking-widest text-outlineSoft opacity-60 cursor-not-allowed"
        >
          <IconoPdf /> Reporte ejecutivo
        </button>
        {destacado && (
          <span className="text-[11px] text-outlineSoft">
            Ya usaste el reporte PDF de tu plan.{" "}
            <a href="/#planes" className="text-white/80 underline underline-offset-2 hover:text-white">Ver planes</a>
          </span>
        )}
      </span>
    );
  }

  const etiqueta = componiendo ? "Componiendo PDF…" : "Descargar reporte ejecutivo";
  return (
    <span className="flex items-center gap-3 flex-wrap">
      <button
        type="button"
        onClick={onClick}
        disabled={ocupado}
        title="Descargar un PDF con esta conversación hasta aquí"
        className={`relative overflow-hidden flex items-center gap-2 px-4 py-2 font-mono text-[10.5px] uppercase tracking-widest transition-colors disabled:cursor-wait ${
          destacado
            ? "bg-accent text-[#06131f] font-semibold hover:bg-white disabled:opacity-80"
            : "border border-accent/50 text-accent hover:bg-accent hover:text-[#06131f] disabled:opacity-50"
        }`}
      >
        {/* El destello cruza el botón cada pocos segundos: llama la atención
            sin parpadear, y se apaga si el sistema pide menos movimiento. */}
        {destacado && !componiendo && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 motion-safe:animate-destello bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.65)_50%,transparent_70%)] bg-[length:250%_100%] bg-no-repeat"
            style={{ backgroundPosition: "160% 0" }}
          />
        )}
        <span className="relative flex items-center gap-2">
          {componiendo ? <Girando /> : <IconoPdf />}
          {etiqueta}
          <span className={`px-1.5 py-px text-[9px] tracking-wider border ${
            destacado ? "border-[#06131f]/35" : "border-accent/40"
          }`}>
            PDF
          </span>
        </span>
      </button>
      {destacado && !componiendo && (
        <span className="text-[11.5px] text-outlineSoft leading-snug">
          Convierte esta respuesta en un informe listo para compartir.
          {incluidos != null && <span className="text-white/75"> Tu plan incluye {incluidos === 1 ? "uno" : incluidos}.</span>}
        </span>
      )}
    </span>
  );
}
