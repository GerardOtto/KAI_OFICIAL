import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { alpha, fmt, decimalesPara } from "./paleta";

const PLOT_A = 254;

// Vista A: un año, N instituciones x M métricas.
// El eje X son las métricas elegidas y cada barra una institución. La altura es
// el valor como porcentaje del techo observado de su métrica, que es lo que
// permite poner en un mismo eje escalas distintas (0-100, 0-5, conteos).
export default function VistaAnual({ filas, metricasSel, universidadesSel, universidades, colorDe, anio, estatico = false }) {
  // `estatico` = copia para PDF: disposicion fija (no depende del viewport),
  // sin animaciones de entrada y sin recortes con scroll.
  const entrada = (v) => (estatico ? false : v);
  // Ver nota en VistaEvolucion: truncar rompe la captura del PDF.
  const claseNombre = estatico ? "flex-1 min-w-0 leading-[1.35] break-words" : "flex-1 truncate";
  const [hoverGrupo, setHoverGrupo] = useState(0);

  const grupos = useMemo(() => {
    return metricasSel
      .map(mid => {
        const deMetrica = filas.filter(f => f.id_metrica === mid);
        if (!deMetrica.length) return null;
        const meta = deMetrica[0];
        const techo = Number(meta.techo) || 0;
        return {
          id: mid,
          label: meta.nombre_metrica,
          peso: meta.peso_metrica,
          techo,
          decimales: decimalesPara(techo),
          barras: universidadesSel.map(uid => {
            const f = deMetrica.find(x => x.id_universidad === uid);
            const v = f ? Number(f.valor) : null;
            return {
              id: uid,
              valor: v,
              nombre: universidades?.find(u => u.id_universidad === uid)?.nombre_universidad || String(uid),
            };
          }),
        };
      })
      .filter(Boolean);
  }, [filas, metricasSel, universidadesSel, universidades]);

  const giSeguro = Math.min(hoverGrupo, Math.max(0, grupos.length - 1));
  const grupoRail = grupos[giSeguro];

  const rail = useMemo(() => {
    if (!grupoRail) return [];
    return grupoRail.barras
      .filter(b => b.valor !== null)
      .sort((a, b) => b.valor - a.valor)
      .map((b, i) => ({ ...b, pos: String(i + 1).padStart(2, "0") }));
  }, [grupoRail]);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    label: `${(f * 100).toFixed(0)}%`,
    bottom: `${(PLOT_A * f).toFixed(0)}px`,
    line: f === 0 ? "transparent" : "rgba(255,255,255,.06)",
  }));

  // Cambia cuando cambia el conjunto graficado: fuerza a que las barras vuelvan
  // a crecer desde cero en vez de saltar al valor nuevo.
  const claveAnim = `${anio}|${metricasSel.join(",")}|${universidadesSel.join(",")}`;

  if (!grupos.length) {
    return (
      <p className="font-body text-[11.5px] text-[#6f6f6f] py-16 text-center">
        No hay valores para esta combinación de métricas, instituciones y año.
      </p>
    );
  }

  return (
    <div data-layout="tendencias" className={estatico
      ? "flex flex-row gap-[26px] items-start"
      : "flex flex-col lg:flex-row gap-6 lg:gap-[26px] items-stretch lg:items-start"}>
      {/* El gráfico scrollea dentro de su columna: nunca empuja el ancho de la página. */}
      <div className={estatico ? "flex-1 min-w-0" : "flex-1 min-w-0 overflow-x-auto pb-1"}>
       <div className="pl-[46px]" style={{ minWidth: `${Math.max(360, grupos.length * 90)}px` }}>
        <div
          className="relative flex items-end gap-2 sm:gap-3.5 border-b border-white/20"
          style={{ height: `${PLOT_A}px` }}
        >
          {ticks.map(t => (
            <div key={`l${t.label}`} className="absolute left-0 right-0 h-px" style={{ bottom: t.bottom, background: t.line }} />
          ))}
          {ticks.map(t => (
            <div
              key={`v${t.label}`}
              className="absolute -left-[46px] w-[38px] text-right translate-y-1/2 font-mono text-[9.5px] text-[#6f6f6f]"
              style={{ bottom: t.bottom }}
            >
              {t.label}
            </div>
          ))}

          {grupos.map((g, gi) => {
            const hov = gi === giSeguro;
            return (
              <div
                key={g.id}
                onMouseEnter={() => setHoverGrupo(gi)}
                className="flex-1 min-w-0 h-full flex items-end justify-center gap-0.5 px-1.5 cursor-crosshair transition-colors"
                style={{ background: hov ? "rgba(255,255,255,.05)" : "transparent" }}
              >
                {g.barras.map((b, bi) => {
                  const color = colorDe(b.id);
                  const alto = b.valor === null || !g.techo
                    ? 2
                    : Math.max(2, (b.valor / g.techo) * PLOT_A);
                  return (
                    <motion.div
                      key={`${claveAnim}|${b.id}`}
                      title={`${b.nombre} · ${fmt(b.valor, g.decimales)}`}
                      className="flex-1 min-w-[2px] max-w-[16px] origin-bottom"
                      style={{ background: hov ? color : alpha(color, ".72"), transition: "background .15s ease" }}
                      initial={entrada({ height: 0, opacity: 0 })}
                      animate={{ height: alto, opacity: 1 }}
                      transition={{
                        height: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: gi * 0.07 + bi * 0.018 },
                        opacity: { duration: 0.2, delay: gi * 0.07 + bi * 0.018 },
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 sm:gap-3.5 mt-2.5">
          {grupos.map((g, gi) => (
            <div key={g.id} className="flex-1 min-w-0 text-center px-1.5">
              <div
                className="font-body font-semibold text-[11px] leading-[1.3] transition-colors"
                style={{ color: gi === giSeguro ? "#fff" : "#8a8a8a" }}
              >
                {g.label}
              </div>
              <div className="font-mono text-[9px] text-[#5f5f5f] mt-[3px]">peso {g.peso ?? "—"}</div>
            </div>
          ))}
        </div>

        <p className="mt-3.5 font-body text-[10.5px] text-[#6f6f6f]">
          Cada barra es una institución en {anio}. La altura es el valor como porcentaje del techo
          observado de su métrica —el máximo histórico registrado en este ranking—, para poder poner
          en un mismo eje escalas distintas. Los valores absolutos están a la derecha.
        </p>
       </div>
      </div>

      <div className={estatico ? "w-[322px] flex-none" : "w-full lg:w-[322px] lg:flex-none"}>
        <div className="bg-panel border border-white/[.09] px-4 pt-[15px] pb-[17px]">
          <p className="mb-[3px] font-body font-semibold text-[12.5px] leading-[1.3] text-white">
            {grupoRail.label}
          </p>
          <p className="mb-3.5 font-body font-medium text-[9px] uppercase tracking-[.12em] text-[#7f7f7f]">
            peso {grupoRail.peso ?? "—"} · {anio} · valores absolutos
          </p>
          <div className="flex flex-col gap-2.5">
            {rail.map((r, i) => {
              const color = colorDe(r.id);
              return (
                <motion.div
                  key={r.id}
                  initial={entrada({ opacity: 0, x: 8 })}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.025, 0.4) }}
                >
                  <div className="flex items-baseline gap-2 mb-[5px]">
                    <span className="font-mono text-[9.5px] text-[#6f6f6f] flex-none">{r.pos}</span>
                    <span className="w-2 h-2 flex-none" style={{ background: color }} />
                    <span className={`font-body text-[11px] text-[#dcdcdc] ${claseNombre}`}>{r.nombre}</span>
                    <span className="font-mono font-semibold text-[12.5px] text-white">
                      {fmt(r.valor, grupoRail.decimales)}
                    </span>
                  </div>
                  <div className="h-[3px] bg-white/[.07] ml-[22px]">
                    <motion.div
                      className="h-full"
                      style={{ background: color }}
                      initial={entrada({ width: 0 })}
                      animate={{ width: `${grupoRail.techo ? ((r.valor / grupoRail.techo) * 100).toFixed(1) : 0}%` }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: Math.min(i * 0.025, 0.4) }}
                    />
                  </div>
                </motion.div>
              );
            })}
            {rail.length === 0 && (
              <p className="font-body text-[11px] text-[#6f6f6f]">Sin datos en esta métrica para {anio}.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
