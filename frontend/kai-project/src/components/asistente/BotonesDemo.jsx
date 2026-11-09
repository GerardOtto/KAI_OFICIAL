import { ESTILO_RANKING } from "./estiloRankings";

const Descarga = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
  </svg>
);

/** Diagnósticos de muestra que se descargan tal cual, desde `public/demos/`.
 *  El estilo es el del ranking de cada uno (`estiloRankings.js`). */
const DEMOS = [
  { id: "demo-pucv-qs", estilo: "brechas-qs", nombre: "PUCV · QS World 2027",
    bajada: "Sus cinco cifras clave y qué necesita para el top 10.",
    archivo: "kai-diagnostico-pucv-qs-world-2027.pdf" },
  { id: "demo-uv-qs", estilo: "brechas-qs", nombre: "UV · QS World 2027",
    bajada: "Sus cinco cifras clave y qué necesita para el top 10.",
    archivo: "kai-diagnostico-uv-qs-world-2027.pdf" },
  { id: "demo-pucv-scimago", estilo: "brechas-scimago", nombre: "PUCV · Scimago 2026",
    bajada: "Patentes, papers y acceso abierto: dónde está y cuánto le falta.",
    archivo: "kai-diagnostico-pucv-scimago-2026.pdf" },
  { id: "demo-uv-scimago", estilo: "brechas-scimago", nombre: "UV · Scimago 2026",
    bajada: "Patentes, papers y acceso abierto: dónde está y cuánto le falta.",
    archivo: "kai-diagnostico-uv-scimago-2026.pdf" },
];

/** Los cuatro botones de demostración del chat vacío con el motor Claude.
 *
 *  Ocupan el lugar de los informes de brechas: en vez de gastar una consulta,
 *  descargan un diagnóstico ya hecho, para que cualquiera vea lo que entrega el
 *  motor de análisis. Son enlaces a archivos estáticos: no pasan por el
 *  servidor, no consumen cuota ni descargas del plan, y por eso no se
 *  deshabilitan aunque el asistente esté bloqueado para la cuenta.
 */
export default function BotonesDemo() {
  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-outlineSoft">
          Demo · Diagnósticos del motor de análisis
        </p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#858585]">PDF</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DEMOS.map((d) => {
          const e = ESTILO_RANKING[d.estilo];
          return (
            <a
              key={d.id}
              href={`${import.meta.env.BASE_URL}demos/${d.archivo}`}
              download={d.archivo}
              aria-label={`Demo: descargar el diagnóstico ${d.nombre} en PDF`}
              title={`Descargar el diagnóstico de muestra ${d.nombre} (PDF)`}
              data-demo={d.id}
              style={{ backgroundColor: e.fondo, color: e.tinta, borderColor: e.borde, "--brillo": e.fondo }}
              className="group relative flex items-start gap-3.5 p-4 text-left border transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-14px_var(--brillo)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
                  Demo · Diagnóstico
                </span>
                <span className="block text-[17px] font-bold leading-tight mt-0.5">{d.nombre}</span>
                <span className="block text-[12px] leading-snug mt-1 opacity-80">{d.bajada}</span>
              </span>
              <span className="shrink-0 mt-0.5 opacity-80 transition-transform duration-200 group-hover:translate-y-0.5">
                <Descarga />
              </span>
            </a>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-[#8a8a8a] leading-relaxed">
        Son diagnósticos de muestra ya elaborados: se descargan en PDF y no gastan consultas.
        También puedes escribir tu propia pregunta abajo.
      </p>
    </div>
  );
}
