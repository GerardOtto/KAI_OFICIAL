import { useMemo, useState, useEffect } from "react";
import jsPDF from "jspdf";
import { useSimulacion } from "../../hooks/useSimulacion";
import { useRankingResumen } from "../../hooks/useRankingResumen";

export default function SimulacionUnitaria({ rankingId, anio, rankingNombre, universidadId, disciplinaFiltro }) {
  const rawData = useSimulacion(rankingId, anio, universidadId ? [universidadId] : []);
  const { data: resumen } = useRankingResumen(rankingId, anio);

  // { id_metrica: valor_editado }
  const [overrides, setOverrides] = useState({});
  useEffect(() => { setOverrides({}); }, [rankingId, anio, universidadId]);

  const filtrado = useMemo(
    () => (disciplinaFiltro ? rawData.filter(r => r.disciplina === disciplinaFiltro) : rawData),
    [rawData, disciplinaFiltro]
  );

  const metricas = useMemo(() => {
    const map = {};
    filtrado.forEach(r => {
      if (!map[r.id_metrica]) {
        map[r.id_metrica] = {
          id_metrica: r.id_metrica,
          nombre_metrica: r.nombre_metrica,
          disciplina: r.disciplina,
          peso_metrica: Number(r.peso_metrica) || 0,
          valor_original: Number(r.valor_metrica) || 0,
        };
      }
    });
    return Object.values(map).sort((a, b) => b.peso_metrica - a.peso_metrica);
  }, [filtrado]);

  const maxPeso = useMemo(() => Math.max(1, ...metricas.map(m => m.peso_metrica)), [metricas]);
  const nombreInstitucion = filtrado[0]?.nombre_universidad || "";

  const getValor = (idMetrica, original) => overrides[idMetrica] ?? original;
  const setValor = (idMetrica, val) => setOverrides(prev => ({ ...prev, [idMetrica]: val }));

  const scoreSimulado = useMemo(
    () => metricas.reduce((acc, m) => acc + (getValor(m.id_metrica, m.valor_original) * m.peso_metrica) / 100, 0),
    [metricas, overrides]
  );
  const scoreBase = useMemo(
    () => metricas.reduce((acc, m) => acc + (m.valor_original * m.peso_metrica) / 100, 0),
    [metricas]
  );

  // Contexto: resto de instituciones del mismo ranking/año, con su score real (sin simular)
  const pares = useMemo(
    () => resumen.filter(u => u.id_universidad !== universidadId),
    [resumen, universidadId]
  );

  const posicionBase = useMemo(() => {
    if (!resumen.length) return null;
    const ordenado = [...resumen].sort((a, b) => b.score_total - a.score_total);
    return ordenado.findIndex(u => u.id_universidad === universidadId) + 1 || null;
  }, [resumen, universidadId]);

  const posicionSimulada = useMemo(() => {
    if (!pares.length) return posicionBase;
    return pares.filter(u => Number(u.score_total) > scoreSimulado).length + 1;
  }, [pares, scoreSimulado, posicionBase]);

  const movimiento = posicionBase != null && posicionSimulada != null ? posicionBase - posicionSimulada : 0;

  const superadas = useMemo(
    () => pares.filter(u => scoreSimulado > Number(u.score_total) && scoreBase <= Number(u.score_total)),
    [pares, scoreSimulado, scoreBase]
  );
  const perdidas = useMemo(
    () => pares.filter(u => scoreSimulado < Number(u.score_total) && scoreBase >= Number(u.score_total)),
    [pares, scoreSimulado, scoreBase]
  );

  const hayOverrides = Object.keys(overrides).length > 0;
  const maxScorePosible = Math.max(scoreBase, scoreSimulado, ...pares.map(u => Number(u.score_total) || 0), 1);

  const metricaMasCercana = useMemo(() => {
    if (movimiento > 0 || !pares.length) return null;
    const siguiente = [...pares].sort((a, b) => Number(a.score_total) - Number(b.score_total))
      .find(u => Number(u.score_total) > scoreSimulado);
    if (!siguiente) return null;
    const gap = Number(siguiente.score_total) - scoreSimulado;
    return `Te faltan ${gap.toFixed(1)} pts para superar a ${siguiente.nombre_universidad}`;
  }, [pares, scoreSimulado, movimiento]);

  const handleExportCSV = () => {
    const filas = [
      ["Institución", nombreInstitucion],
      ["Ranking", rankingNombre],
      ["Año", anio],
      [],
      ["Métrica", "Peso (%)", "Valor base", "Valor simulado"],
      ...metricas.map(m => [m.nombre_metrica, m.peso_metrica, m.valor_original, getValor(m.id_metrica, m.valor_original)]),
      [],
      ["Score base", scoreBase.toFixed(2)],
      ["Score simulado", scoreSimulado.toFixed(2)],
    ];
    const csv = filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `simulacion_unitaria_${nombreInstitucion}_${anio}.csv`.replace(/\s+/g, "_");
    link.click();
  };

  const handleExportPDF = () => {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 14;
    let y = margin;
    pdf.setFontSize(16); pdf.setTextColor(20, 20, 20);
    pdf.text(`KAI — Simulación: ${nombreInstitucion}`, margin, y); y += 7;
    pdf.setFontSize(9); pdf.setTextColor(100, 100, 100);
    pdf.text(`${rankingNombre} · ${anio}`, margin, y); y += 8;
    pdf.setDrawColor(200, 200, 200); pdf.line(margin, y, 196, y); y += 8;

    metricas.forEach(m => {
      const val = getValor(m.id_metrica, m.valor_original);
      pdf.setFontSize(9); pdf.setTextColor(20, 20, 20);
      pdf.text(`${m.nombre_metrica} (peso ${m.peso_metrica}%)`, margin, y);
      pdf.text(`base ${m.valor_original} -> ${val}`, 140, y);
      y += 6;
    });
    y += 4;
    pdf.setFontSize(11); pdf.setFont(undefined, "bold");
    pdf.text(`Score base: ${scoreBase.toFixed(2)}  ->  Score simulado: ${scoreSimulado.toFixed(2)}`, margin, y);
    pdf.setFont(undefined, "normal");
    pdf.save(`simulacion_unitaria_${nombreInstitucion}_${anio}.pdf`.replace(/\s+/g, "_"));
  };

  if (!universidadId) {
    return (
      <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">
        Selecciona una institución para simular.
      </div>
    );
  }
  if (!anio) {
    return (
      <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">
        Selecciona un año para comenzar.
      </div>
    );
  }
  if (!metricas.length) {
    return (
      <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">
        No hay métricas disponibles para esta institución en el año seleccionado.
      </div>
    );
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 380px" }}>
      {/* Sliders */}
      <div className="pt-[22px] px-7 pb-7">
        <div className="grid gap-4 pb-2.5 border-b border-white/[.1]" style={{ gridTemplateColumns: "220px 92px 1fr 96px" }}>
          <div className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a]">Métrica</div>
          <div className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a] text-right">Valor</div>
          <div className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a]">Ajuste</div>
          <div className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a] text-right">Efecto</div>
        </div>

        {metricas.map(m => {
          const actual = getValor(m.id_metrica, m.valor_original);
          const modificado = overrides[m.id_metrica] !== undefined;
          const max = Math.max(100, m.valor_original * 2, actual * 1.2);
          const deltaPts = ((actual - m.valor_original) * m.peso_metrica) / 100;

          return (
            <div
              key={m.id_metrica}
              className="grid gap-4 items-center py-[13px] border-b border-white/[.06]"
              style={{ gridTemplateColumns: "220px 92px 1fr 96px" }}
            >
              <div>
                <div className="font-body font-semibold text-[12.5px] text-[#e6e6e6]">{m.nombre_metrica}</div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="w-[44px] h-1 bg-white/[.08]">
                    <div className="h-1 bg-white/40" style={{ width: `${(m.peso_metrica / maxPeso) * 100}%` }} />
                  </div>
                  <span className="font-mono text-[10px] text-[#6f6f6f]">peso {m.peso_metrica}%</span>
                </div>
              </div>

              <div className="text-right">
                <div className={`font-mono font-semibold text-[17px] tabular-nums ${modificado ? "text-accent" : "text-white"}`}>
                  {Number(actual).toFixed(1)}
                </div>
                <div className="font-mono text-[9.5px] text-[#6f6f6f]">base {Number(m.valor_original).toFixed(1)}</div>
              </div>

              <input
                type="range"
                min={0}
                max={max}
                step={0.1}
                value={actual}
                onChange={e => setValor(m.id_metrica, Number(e.target.value))}
                className="w-full cursor-pointer accent-white"
              />

              <div className={`text-right font-mono font-semibold text-[12px] ${
                deltaPts > 0 ? "text-positive" : deltaPts < 0 ? "text-negative" : "text-[#6f6f6f]"
              }`}>
                {deltaPts === 0 ? "—" : `${deltaPts > 0 ? "+" : ""}${deltaPts.toFixed(1)}`}
              </div>
            </div>
          );
        })}

        <p className="text-[11.5px] leading-relaxed text-[#7a7a7a] mt-4">
          ¿Necesitas ver a los pares celda por celda? Cambia al modo Comparada arriba. Cada modo guarda su propio escenario.
        </p>
      </div>

      {/* Resultado */}
      <div className="border-l border-white/[.08] bg-panel py-[26px] px-[26px]">
        <p className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a] mb-4">Resultado simulado</p>

        <div className="flex items-end gap-[22px] mb-5">
          <div>
            <p className="text-[10.5px] text-[#8a8a8a] mb-1">Posición</p>
            <div className="flex items-baseline gap-2">
              <span className="font-headline text-[52px] font-semibold text-white leading-none">
                {posicionSimulada ?? "—"}
              </span>
              {movimiento !== 0 && (
                <span className={`font-mono font-semibold text-[13px] ${movimiento > 0 ? "text-positive" : "text-negative"}`}>
                  {movimiento > 0 ? `▲${movimiento}` : `▼${Math.abs(movimiento)}`}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="pb-2">
          <p className="text-[10.5px] text-[#8a8a8a] mb-1">Score</p>
          <div className="flex items-baseline gap-2">
            <span className="font-mono font-semibold text-[26px] text-white">{scoreSimulado.toFixed(1)}</span>
            <span className={`font-mono font-semibold text-[12px] ${
              scoreSimulado > scoreBase ? "text-positive" : scoreSimulado < scoreBase ? "text-negative" : "text-[#6f6f6f]"
            }`}>
              {scoreSimulado === scoreBase ? "—" : `${scoreSimulado > scoreBase ? "+" : ""}${(scoreSimulado - scoreBase).toFixed(1)}`}
            </span>
          </div>
        </div>

        <p className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a] mt-5 mb-2">
          Base {scoreBase.toFixed(1)} → simulado
        </p>
        <div className="relative h-6 bg-white/[.06] mb-1.5">
          <div
            className="absolute top-0 left-0 h-6"
            style={{ width: `${Math.min(100, (scoreSimulado / maxScorePosible) * 100)}%`, background: "oklch(0.72 0.13 250 / .35)" }}
          />
          <div
            className="absolute top-0 h-6 w-[2px] bg-white"
            style={{ left: `${Math.min(100, (scoreBase / maxScorePosible) * 100)}%` }}
          />
        </div>
        <p className="text-[10.5px] text-[#6f6f6f] mb-[22px]">La línea blanca es el valor real de {anio}.</p>

        {superadas.length > 0 && (
          <div className="p-3.5 bg-background border border-white/[.08] mb-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[.12em] text-positive mb-2">Superamos a</p>
            {superadas.map(s => (
              <div key={s.id_universidad} className="font-body font-medium text-xs text-[#dcdcdc] py-0.5">
                {s.nombre_universidad}
              </div>
            ))}
          </div>
        )}
        {perdidas.length > 0 && (
          <div className="p-3.5 bg-background border border-white/[.08] mb-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[.12em] text-negative mb-2">Nos superan</p>
            {perdidas.map(s => (
              <div key={s.id_universidad} className="font-body font-medium text-xs text-[#dcdcdc] py-0.5">
                {s.nombre_universidad}
              </div>
            ))}
          </div>
        )}
        {!hayOverrides && (
          <p className="text-xs leading-relaxed text-[#7a7a7a]">
            Aún no has movido ninguna métrica.
            {metricas[0] && ` Empieza por una de peso alto: ${metricas[0].nombre_metrica} pesa ${metricas[0].peso_metrica}%.`}
          </p>
        )}
        {hayOverrides && movimiento === 0 && metricaMasCercana && (
          <div className="p-3.5 bg-background border border-white/[.08]">
            <p className="font-mono text-[10px] uppercase tracking-[.12em] text-warn mb-1.5">Sin cambio de posición todavía</p>
            <p className="text-xs leading-relaxed text-[#a4a4a4]">{metricaMasCercana}.</p>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={handleExportCSV}
            className="flex-1 py-2.5 bg-white text-[#111] text-[11px] font-semibold hover:bg-white/80 transition-colors"
          >
            Exportar CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="flex-1 py-2.5 border border-white/[.18] text-[#cfcfcf] text-[11px] font-medium hover:border-white/40 transition-colors"
          >
            Exportar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
