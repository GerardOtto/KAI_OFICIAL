import { useCallback, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { linearRegression, rSquared } from "../../utils/regression";
import { fmt, decimalesPara, POSITIVO, NEGATIVO } from "./paleta";

const H = 268;
const DUR_TRAZO = 1.1;

// Redondea el tope del eje Y a un valor "limpio" (1, 2, 2.5 o 5 x 10^n).
function pasoBonito(bruto) {
  if (!bruto || bruto <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(bruto)));
  const f = bruto / exp;
  const mult = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return mult * exp;
}

// Vista B: una métrica en el tiempo, una línea por institución.
// Tramo continuo = dato reportado; tramo punteado = proyección por regresión
// lineal sobre la serie observada (la misma que ya usaba el gráfico anterior).
export default function VistaEvolucion({
  filas,
  universidadesSel,
  universidades,
  colorDe,
  proyeccion,
  anosProyeccion,
  estatico = false,
}) {
  // `estatico` = copia para PDF: disposicion fija (no depende del viewport),
  // sin animaciones de entrada y sin recortes con scroll.
  const entrada = (v) => (estatico ? false : v);
  // html2canvas rasteriza mal los elementos con overflow:hidden + ellipsis: no
  // descuenta el medio interlineado y corta los glifos por abajo. En la copia de
  // impresion no hace falta truncar (el informe ya se pagina), asi que el nombre
  // se deja fluir en varias lineas y sale completo.
  const claseNombre = estatico ? "flex-1 min-w-0 leading-[1.35] break-words" : "flex-1 truncate";
  const [W, setW] = useState(896);
  const [hoverAnio, setHoverAnio] = useState(null);

  // Callback ref en vez de useEffect: el contenedor del gráfico no existe en el
  // primer render (mientras no hay datos se devuelve el aviso de "sin serie"),
  // así que un efecto con deps [] observaba null y nunca volvía a intentarlo,
  // dejando el ancho clavado en el valor inicial y desbordando la página.
  const roRef = useRef(null);
  const wrapRef = useCallback((node) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!node || typeof ResizeObserver === "undefined") return;
    setW(node.getBoundingClientRect().width || 896);
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      if (w > 0) setW(w);
    });
    ro.observe(node);
    roRef.current = ro;
  }, []);

  const aniosReales = useMemo(
    () => [...new Set(filas.map(f => f.anio))].sort((a, b) => a - b),
    [filas]
  );

  const series = useMemo(() => {
    if (!aniosReales.length) return [];
    return universidadesSel
      .map(uid => {
        const puntos = aniosReales.map(a => {
          const f = filas.find(x => x.id_universidad === uid && x.anio === a);
          return f && f.valor !== null ? Number(f.valor) : null;
        });
        if (puntos.every(v => v === null)) return null;

        const observados = aniosReales
          .map((a, i) => ({ x: a, y: puntos[i] }))
          .filter(p => p.y !== null);

        const reg = linearRegression(observados);
        const r2 = reg ? rSquared(observados, reg.slope, reg.intercept) : null;

        const ultimo = aniosReales[aniosReales.length - 1];
        const proy = reg && proyeccion
          ? Array.from({ length: anosProyeccion }, (_, j) => ({
              anio: ultimo + j + 1,
              valor: reg.slope * (ultimo + j + 1) + reg.intercept,
            }))
          : [];

        return {
          id: uid,
          nombre: universidades?.find(u => u.id_universidad === uid)?.nombre_universidad || String(uid),
          color: colorDe(uid),
          puntos,
          proy,
          r2,
          observados,
        };
      })
      .filter(Boolean);
  }, [filas, aniosReales, universidadesSel, universidades, colorDe, proyeccion, anosProyeccion]);

  const anios = useMemo(() => {
    if (!aniosReales.length) return [];
    const ultimo = aniosReales[aniosReales.length - 1];
    const futuros = proyeccion
      ? Array.from({ length: anosProyeccion }, (_, j) => ultimo + j + 1)
      : [];
    return [...aniosReales, ...futuros];
  }, [aniosReales, proyeccion, anosProyeccion]);

  const { top, decimales } = useMemo(() => {
    let mx = 0;
    series.forEach(s => {
      s.puntos.forEach(v => { if (v !== null && v > mx) mx = v; });
      s.proy.forEach(p => { if (p.valor > mx) mx = p.valor; });
    });
    const t = mx > 0 ? Math.ceil(mx / pasoBonito(mx / 4)) * pasoBonito(mx / 4) : 1;
    return { top: t, decimales: decimalesPara(t) };
  }, [series]);

  const anioActivo = hoverAnio && anios.includes(hoverAnio)
    ? hoverAnio
    : aniosReales[aniosReales.length - 1];

  const nPts = anios.length;
  const stepX = nPts > 1 ? W / (nPts - 1) : W;
  const xAt = i => i * stepX;
  const yAt = v => H - (v / top) * H;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    label: fmt(top * f, decimales),
    y: (H - H * f).toFixed(1),
    line: f === 0 ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.06)",
    bottom: `${(H * f).toFixed(0)}px`,
  }));

  // Valor de una serie en un año cualquiera, sea observado o proyectado.
  const valorEn = (s, anio) => {
    const i = aniosReales.indexOf(anio);
    if (i > -1) return s.puntos[i];
    const p = s.proy.find(x => x.anio === anio);
    return p ? p.valor : null;
  };

  const rail = useMemo(() => {
    return series
      .map(s => {
        const v = valorEn(s, anioActivo);
        const idx = anios.indexOf(anioActivo);
        const prev = idx > 0 ? valorEn(s, anios[idx - 1]) : null;
        const d = v !== null && prev !== null ? v - prev : null;
        return { ...s, valor: v, delta: d };
      })
      .filter(r => r.valor !== null)
      .sort((a, b) => b.valor - a.valor);
  }, [series, anioActivo, anios]);

  const cambios = useMemo(() => {
    return series
      .map(s => {
        const obs = s.observados;
        if (obs.length < 2) return null;
        const total = obs[obs.length - 1].y - obs[0].y;
        const base = obs[0].y || 1;
        return {
          id: s.id,
          nombre: s.nombre,
          color: s.color,
          total,
          pct: (total / base) * 100,
          r2: s.r2,
          desde: obs[0].x,
          hasta: obs[obs.length - 1].x,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.total - a.total);
  }, [series]);

  // Rehace el trazo cuando cambia lo graficado (métrica, instituciones, horizonte).
  const claveAnim = `${aniosReales.join(",")}|${universidadesSel.join(",")}|${proyeccion ? anosProyeccion : 0}`;

  if (!series.length) {
    return (
      <p className="font-body text-[11.5px] text-[#6f6f6f] py-16 text-center">
        No hay serie histórica para esta métrica y estas instituciones.
      </p>
    );
  }

  const rangoObs = cambios.length ? `${cambios[0].desde} → ${cambios[0].hasta}` : "";

  return (
    <div data-layout="tendencias" className={estatico
      ? "flex flex-row gap-[26px] items-start"
      : "flex flex-col lg:flex-row gap-6 lg:gap-[26px] items-stretch lg:items-start"}>
      {/* El gráfico scrollea dentro de su columna: nunca empuja el ancho de la página. */}
      <div className={estatico ? "flex-1 min-w-0" : "flex-1 min-w-0 overflow-x-auto pb-1"}>
       <div className="pl-[52px] min-w-[420px]">
        <div ref={wrapRef} className="relative" style={{ height: `${H}px` }}>
          {ticks.map(t => (
            <div
              key={t.label + t.y}
              className="absolute -left-[52px] w-[44px] text-right translate-y-1/2 font-mono text-[9.5px] text-[#6f6f6f] z-[2]"
              style={{ bottom: t.bottom }}
            >
              {t.label}
            </div>
          ))}

          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block overflow-visible">
            {ticks.map(t => (
              <line key={`g${t.y}`} x1="0" y1={t.y} x2={W} y2={t.y} stroke={t.line} strokeWidth="1" />
            ))}
            <line
              x1={xAt(anios.indexOf(anioActivo))}
              y1="0"
              x2={xAt(anios.indexOf(anioActivo))}
              y2={H}
              stroke="rgba(255,255,255,.22)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {series.map((s, si) => {
              const idxConDato = s.puntos.map((v, i) => (v === null ? -1 : i)).filter(i => i > -1);
              const pts = idxConDato.map(i => `${xAt(i).toFixed(1)},${yAt(s.puntos[i]).toFixed(1)}`).join(" ");
              const ultimoIdx = idxConDato[idxConDato.length - 1];

              const ptsProy = s.proy.length && ultimoIdx !== undefined
                ? [`${xAt(ultimoIdx).toFixed(1)},${yAt(s.puntos[ultimoIdx]).toFixed(1)}`]
                    .concat(s.proy.map(p => `${xAt(anios.indexOf(p.anio)).toFixed(1)},${yAt(p.valor).toFixed(1)}`))
                    .join(" ")
                : "";

              // Escalona la entrada de cada serie para que se lean como trazos
              // sucesivos y no como un bloque que aparece de golpe.
              const retraso = Math.min(si * 0.08, 0.6);
              const nDatos = Math.max(1, idxConDato.length);

              return (
                <g key={`${claveAnim}|${s.id}`}>
                  <motion.polyline
                    points={pts}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    initial={entrada({ pathLength: 0 })}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: DUR_TRAZO, ease: "easeInOut", delay: retraso }}
                  />
                  {ptsProy && (
                    <motion.polyline
                      points={ptsProy}
                      fill="none"
                      stroke={s.color}
                      strokeWidth="2.2"
                      strokeDasharray="5 4"
                      initial={entrada({ pathLength: 0, opacity: 0 })}
                      animate={{ pathLength: 1, opacity: 0.7 }}
                      transition={{ duration: 0.5, ease: "easeOut", delay: retraso + DUR_TRAZO }}
                    />
                  )}
                  {idxConDato.map((i, k) => (
                    <motion.circle
                      key={`d${i}`}
                      cx={xAt(i).toFixed(1)}
                      cy={yAt(s.puntos[i]).toFixed(1)}
                      r={aniosReales[i] === anioActivo ? 5 : 3}
                      fill={aniosReales[i] === anioActivo ? s.color : "#131313"}
                      stroke={s.color}
                      strokeWidth="1.6"
                      initial={entrada({ opacity: 0, scale: 0.4 })}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        duration: 0.22,
                        delay: retraso + (k / nDatos) * DUR_TRAZO,
                      }}
                    />
                  ))}
                  {s.proy.map((p, k) => (
                    <motion.circle
                      key={`p${p.anio}`}
                      cx={xAt(anios.indexOf(p.anio)).toFixed(1)}
                      cy={yAt(p.valor).toFixed(1)}
                      r={p.anio === anioActivo ? 4.5 : 2.5}
                      fill="#131313"
                      stroke={s.color}
                      strokeWidth="1.6"
                      initial={entrada({ opacity: 0, scale: 0.4 })}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        duration: 0.22,
                        delay: retraso + DUR_TRAZO + ((k + 1) / (s.proy.length + 1)) * 0.5,
                      }}
                    />
                  ))}
                </g>
              );
            })}
          </svg>

          <div className="absolute left-0 top-0 bottom-0" style={{ width: `${W}px` }}>
            {anios.map((a, i) => {
              const l0 = Math.max(0, xAt(i) - stepX / 2);
              const r0 = Math.min(W, xAt(i) + stepX / 2);
              return (
                <div
                  key={a}
                  onMouseEnter={() => setHoverAnio(a)}
                  className="absolute top-0 bottom-0 cursor-crosshair transition-colors"
                  style={{
                    left: `${l0.toFixed(1)}px`,
                    width: `${(r0 - l0).toFixed(1)}px`,
                    background: a === anioActivo ? "rgba(255,255,255,.05)" : "transparent",
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="relative h-[30px] mt-2" style={{ width: `${W}px` }}>
          {anios.map((a, i) => {
            const l0 = Math.max(0, xAt(i) - stepX / 2);
            const r0 = Math.min(W, xAt(i) + stepX / 2);
            const esProy = !aniosReales.includes(a);
            return (
              <div
                key={a}
                className="absolute text-center"
                style={{ left: `${l0.toFixed(1)}px`, width: `${(r0 - l0).toFixed(1)}px` }}
              >
                <div
                  className="font-mono text-[10.5px] transition-colors"
                  style={{ color: a === anioActivo ? "#fff" : esProy ? "#6f6f6f" : "#9a9a9a" }}
                >
                  {a}
                </div>
                <div className="font-body text-[8px] uppercase tracking-[.12em] text-[#5f5f5f] h-[11px]">
                  {esProy ? "proy." : ""}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-2.5 font-body text-[10.5px] text-[#6f6f6f]">
          Línea continua = dato reportado
          {proyeccion && rangoObs ? ` · tramo punteado = proyección por regresión lineal sobre ${rangoObs}` : ""}.
          Pasa el mouse por el gráfico para fijar el año que lee el panel derecho.
        </p>
       </div>
      </div>

      <div className={estatico ? "w-[322px] flex-none flex flex-col gap-3" : "w-full lg:w-[322px] lg:flex-none flex flex-col gap-3"}>
        <div className="bg-panel border border-white/[.09] px-4 pt-[15px] pb-[17px]">
          <div className="flex items-baseline justify-between mb-3.5">
            <span className="font-headline text-[19px] text-white">{anioActivo}</span>
            <span className="font-body font-medium text-[9px] uppercase tracking-[.12em] text-[#7f7f7f]">
              {!aniosReales.includes(anioActivo)
                ? "proyectado"
                : anioActivo === aniosReales[aniosReales.length - 1]
                ? "último dato"
                : "histórico"}
            </span>
          </div>
          <div className={estatico ? "flex flex-col gap-[11px]" : "flex flex-col gap-[11px] max-h-[420px] overflow-y-auto pr-1"}>
            {rail.map((r, i) => (
              <motion.div
                key={r.id}
                initial={entrada({ opacity: 0, x: 8 })}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.35) }}
              >
                <div className="flex items-baseline gap-2 mb-[5px]">
                  <span className="w-2 h-2 flex-none" style={{ background: r.color }} />
                  <span className={`font-body font-semibold text-[11.5px] text-[#e6e6e6] ${claseNombre}`}>
                    {r.nombre}
                  </span>
                  <span className="font-mono font-semibold text-[13px] text-white">
                    {fmt(r.valor, decimales)}
                  </span>
                  <span
                    className="font-mono text-[10px] min-w-[38px] text-right"
                    style={{
                      color: r.delta === null ? "#5f5f5f" : r.delta > 0 ? POSITIVO : r.delta < 0 ? NEGATIVO : "#6f6f6f",
                    }}
                  >
                    {r.delta === null ? "—" : `${r.delta >= 0 ? "+" : "−"}${fmt(Math.abs(r.delta), decimales)}`}
                  </span>
                </div>
                <div className="h-[3px] bg-white/[.07]">
                  <motion.div
                    className="h-full"
                    style={{ background: r.color }}
                    initial={entrada({ width: 0 })}
                    animate={{ width: `${((r.valor / top) * 100).toFixed(1)}%` }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: Math.min(i * 0.02, 0.35) }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {cambios.length > 0 && (
          <div className="bg-panel border border-white/[.09] px-4 pt-[15px] pb-[17px]">
            <p className="mb-3 font-body font-medium text-[9px] uppercase tracking-[.14em] text-[#7f7f7f]">
              Cambio {rangoObs}
            </p>
            <div className={estatico ? "flex flex-col gap-[9px]" : "flex flex-col gap-[9px] max-h-[320px] overflow-y-auto pr-1"}>
              {cambios.map(c => {
                const fg = c.total > 0 ? POSITIVO : c.total < 0 ? NEGATIVO : "#8a8a8a";
                return (
                  <div key={c.id} className="flex items-baseline gap-2.5">
                    <span className="w-2 h-2 flex-none" style={{ background: c.color }} />
                    <span className={`font-body font-semibold text-[11px] text-[#c4c4c4] ${claseNombre}`}>
                      {c.nombre}
                    </span>
                    <span className="font-mono font-semibold text-[11.5px] w-[52px] text-right" style={{ color: fg }}>
                      {`${c.total >= 0 ? "+" : "−"}${fmt(Math.abs(c.total), decimales)}`}
                    </span>
                    <span className="font-mono text-[10.5px] w-[46px] text-right" style={{ color: fg }}>
                      {`${c.pct >= 0 ? "+" : "−"}${Math.abs(c.pct).toFixed(0)}%`}
                    </span>
                    <span
                      className="font-mono text-[10px] w-[52px] text-right"
                      style={{ color: c.r2 !== null && c.r2 > 0.9 ? "#c4c4c4" : "#8a8a8a" }}
                    >
                      R² {c.r2 === null ? "—" : fmt(c.r2, 2)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 font-body text-[9.5px] leading-relaxed text-[#5f5f5f]">
              R² indica qué tanto explica la recta la serie observada. Bajo 0,90 la proyección
              es solo indicativa.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
