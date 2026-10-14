import { Link } from "react-router-dom";

/** Cierre de Simulación: llevar el escenario al asistente.
 *
 *  Aquí había una «Asesoría estratégica» de muestra —recomendaciones fijas que no
 *  dependían de los datos, un campo deshabilitado y la etiqueta «Placeholder — no
 *  funcional»—. El asistente ya hace ese trabajo con los datos reales, así que el
 *  bloque lo ofrece: abre el asistente con la pregunta escrita, sin enviarla.
 */
export default function AgenteIA({ rankingNombre, anio, institucion, disciplina }) {
  const donde = [rankingNombre, disciplina, anio].filter(Boolean).join(" ");
  const quien = institucion || "mi institución";
  const pregunta = `¿Qué métricas debería priorizar ${quien} para subir en ${donde || "este ranking"}? `
    + "Considera el peso de cada una y la distancia con las instituciones que la superan.";

  return (
    <div className="border-t border-outline/30 bg-[#0e0e0e]">
      <div className="max-w-[1600px] mx-auto px-8 py-5 flex items-center justify-between gap-6 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-7 h-7 bg-white/10 flex items-center justify-center text-white font-mono text-[10px] flex-none">
            AI
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-outlineSoft">Asesoría estratégica</p>
            <p className="text-xs text-[#c4c4c4] leading-relaxed mt-1 max-w-3xl">
              ¿Por dónde empezar? El asistente KAI revisa {institucion || "tu institución"}
              {donde ? ` en ${donde}` : ""} con los datos reales y propone qué métricas mover primero.
            </p>
          </div>
        </div>
        <Link
          to="/asistente"
          state={{ pregunta }}
          className="flex-none font-body font-semibold text-[11px] py-2.5 px-4 bg-white text-[#111] hover:bg-white/85 transition-colors"
        >
          Preguntar al asistente →
        </Link>
      </div>
    </div>
  );
}
