import { useMemo, useState, useEffect } from "react";
import { useDescarga, motivoAgotado } from "../../hooks/useDescarga";
import { useSimulacion } from "../../hooks/useSimulacion";
import { useAuth } from "../../auth/AuthContext";
import { useUniversidades } from "../../hooks/useUniversidades";
import { generarInformeSimulacion } from "../../reportes/informeSimulacion";
import { institucionPropia } from "../../reportes/documento";

const PASO_STEPPER = 1;

export default function SimulacionComparada({ rankingId, anio, rankingNombre, selectedUniversidades, disciplinaFiltro }) {
  const rawData = useSimulacion(rankingId, anio, selectedUniversidades);

  // { id_universidad: { id_metrica: valor_editado } }
  const [overrides, setOverrides] = useState({});
  const [celdaSeleccionada, setCeldaSeleccionada] = useState(null); // `${idUni}-${idMetrica}`
  const [soloModificadas, setSoloModificadas] = useState(false);

  useEffect(() => { setOverrides({}); }, [rankingId, anio]);

  const { metricas, filas } = useMemo(() => {
    const data = disciplinaFiltro ? rawData.filter(r => r.disciplina === disciplinaFiltro) : rawData;
    if (!data.length) return { metricas: [], filas: [] };

    const metricaMap = {};
    data.forEach(r => {
      if (!metricaMap[r.id_metrica]) {
        metricaMap[r.id_metrica] = { id_metrica: r.id_metrica, nombre_metrica: r.nombre_metrica, disciplina: r.disciplina, peso_metrica: Number(r.peso_metrica) || 0 };
      }
    });
    const metricas = Object.values(metricaMap).sort((a, b) => b.peso_metrica - a.peso_metrica);

    const uniMap = {};
    data.forEach(r => {
      if (!uniMap[r.id_universidad]) {
        uniMap[r.id_universidad] = { id_universidad: r.id_universidad, nombre: r.nombre_universidad, valores: {} };
      }
      uniMap[r.id_universidad].valores[r.id_metrica] = Number(r.valor_metrica) || 0;
    });

    return { metricas, filas: Object.values(uniMap) };
  }, [rawData, disciplinaFiltro]);

  const getValor = (idUni, idMetrica, original) => overrides[idUni]?.[idMetrica] ?? original ?? 0;
  const setValor = (idUni, idMetrica, val) => {
    setOverrides(prev => ({ ...prev, [idUni]: { ...(prev[idUni] || {}), [idMetrica]: val } }));
  };
  const esModificado = (idUni, idMetrica) => overrides[idUni]?.[idMetrica] !== undefined;
  const filaTieneOverride = (idUni) => Object.keys(overrides[idUni] || {}).length > 0;

  const calcScore = (fila) =>
    metricas.reduce((acc, m) => acc + (getValor(fila.id_universidad, m.id_metrica, fila.valores[m.id_metrica]) * m.peso_metrica) / 100, 0);

  const filasVisibles = useMemo(() => {
    const base = soloModificadas ? filas.filter(f => filaTieneOverride(f.id_universidad)) : filas;
    return [...base].sort((a, b) => calcScore(b) - calcScore(a));
  }, [filas, overrides, soloModificadas]);

  const rankingCompleto = useMemo(
    () => [...filas].map(f => ({ ...f, score: calcScore(f) })).sort((a, b) => b.score - a.score),
    [filas, overrides]
  );
  const maxScore = Math.max(1, ...rankingCompleto.map(r => r.score));

  const handleReset = () => setOverrides({});

  const handleExportCSV = () => {
    if (!filas.length) return;
    const headers = ["Institución", ...metricas.map(m => `${m.nombre_metrica} (${m.peso_metrica}%)`), "Score Total"];
    const rows = filas.map(f => [
      f.nombre,
      ...metricas.map(m => getValor(f.id_universidad, m.id_metrica, f.valores[m.id_metrica])),
      calcScore(f).toFixed(2),
    ]);
    const csv = [
      `Ranking:,${rankingNombre}`, `Año:,${anio}`, `Instituciones:,${filas.length}`, "",
      headers.join(","), ...rows.map(r => r.join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `simulacion_comparada_${rankingNombre}_${anio}.csv`.replace(/\s+/g, "_");
    link.click();
  };

  const descarga = useDescarga("simulacion");

  const { usuario } = useAuth();
  const { universidades } = useUniversidades();

  const handleExportPDF = async () => {
    if (!(await descarga.permitir("pdf"))) return;
    if (!filas.length) return;
    const scoreBase = (fila) =>
      metricas.reduce((acc, m) => acc + ((fila.valores[m.id_metrica] ?? 0) * m.peso_metrica) / 100, 0);
    const posiciones = (puntaje) => new Map(
      [...filas].sort((a, b) => puntaje(b) - puntaje(a)).map((f, i) => [f.id_universidad, i + 1]));
    const posBase = posiciones(scoreBase);
    const posSim = posiciones(calcScore);
    const nombreMetrica = Object.fromEntries(metricas.map(m => [m.id_metrica, m.nombre_metrica]));
    await generarInformeSimulacion({
      tipo: "comparada", cifras: false, usuario,
      ranking: rankingNombre, anio, disciplina: disciplinaFiltro,
      foco: institucionPropia(usuario, universidades),
      instituciones: filas.map(f => ({
        id: f.id_universidad, nombre: f.nombre,
        scoreBase: scoreBase(f), scoreSim: calcScore(f),
        posBase: posBase.get(f.id_universidad), posSim: posSim.get(f.id_universidad),
        modificada: filaTieneOverride(f.id_universidad),
      })),
      cambios: filas.flatMap(f => Object.entries(overrides[f.id_universidad] || {})
        .filter(([idM]) => nombreMetrica[idM])
        .map(([idM, v]) => ({
          institucion: f.nombre, metrica: nombreMetrica[idM], base: f.valores[idM] ?? 0, simulado: v,
        }))),
    });
  };

  if (!anio) {
    return <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">Selecciona un año para comenzar.</div>;
  }
  if (!selectedUniversidades.length) {
    return <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">Selecciona al menos una institución para comparar.</div>;
  }
  if (!filas.length) {
    return <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">No hay datos para esta selección.</div>;
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-white/[.08]">
        <p className="text-xs text-[#8a8a8a]">
          Intensidad = valor relativo. Celda de color = modificada en la simulación. Haz clic en una celda para editarla.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoloModificadas(v => !v)}
            className={`font-body font-medium text-[11px] py-2 px-3 border transition-colors ${
              soloModificadas ? "bg-white text-[#111] border-white" : "bg-[#1c1c1c] border-white/[.14] text-[#9a9a9a] hover:text-white"
            }`}
          >
            Solo modificadas
          </button>
          <button
            onClick={handleReset}
            className="font-body font-medium text-[11px] py-2 px-3 border border-white/[.14] text-[#8a8a8a] hover:text-white transition-colors"
          >
            Restablecer
          </button>
          <button
            onClick={handleExportCSV}
            className="font-body font-semibold text-[11px] py-2 px-3 bg-white text-[#111] hover:bg-white/80 transition-colors"
          >
            Exportar CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={descarga.agotado("pdf")}
            title={descarga.agotado("pdf") ? motivoAgotado("pdf") : undefined}
            className="font-body font-medium text-[11px] py-2 px-3 border border-white/[.14] text-[#8a8a8a] hover:text-white transition-colors"
          >
            PDF
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 300px" }}>
        {/* Matriz */}
        <div className="pt-4 pr-6 pb-7 overflow-x-auto">
          <div
            className="grid gap-[5px] pb-2"
            style={{ gridTemplateColumns: `200px repeat(${metricas.length}, minmax(90px, 1fr)) 128px` }}
          >
            <div />
            {metricas.map(m => (
              <div key={m.id_metrica} className="text-center">
                <div className="font-body font-medium text-[9.5px] text-[#b4b4b4] leading-tight">{m.nombre_metrica}</div>
                <div className="font-mono text-[9px] text-[#6f6f6f] mt-0.5">{m.peso_metrica}%</div>
              </div>
            ))}
            <div className="font-mono text-[9.5px] uppercase tracking-[.12em] text-[#7a7a7a] text-right self-end">Score</div>
          </div>

          {filasVisibles.map(fila => {
            const score = calcScore(fila);
            const modificadaFila = filaTieneOverride(fila.id_universidad);
            return (
              <div
                key={fila.id_universidad}
                className="grid gap-[5px] items-stretch mb-[5px]"
                style={{ gridTemplateColumns: `200px repeat(${metricas.length}, minmax(90px, 1fr)) 128px`, borderLeft: `2px solid ${modificadaFila ? "oklch(0.72 0.13 250)" : "transparent"}` }}
              >
                <div className="flex items-center pl-2 font-body font-semibold text-[12.5px] text-[#e6e6e6] truncate">
                  {fila.nombre}
                </div>
                {metricas.map(m => {
                  const original = fila.valores[m.id_metrica];
                  const actual = getValor(fila.id_universidad, m.id_metrica, original);
                  const modificado = esModificado(fila.id_universidad, m.id_metrica);
                  const key = `${fila.id_universidad}-${m.id_metrica}`;
                  const seleccionada = celdaSeleccionada === key;
                  return (
                    <div
                      key={m.id_metrica}
                      onClick={() => setCeldaSeleccionada(seleccionada ? null : key)}
                      className="relative h-[46px] flex flex-col items-center justify-center cursor-pointer border"
                      style={{
                        background: modificado ? "oklch(0.72 0.13 250 / .16)" : "rgba(255,255,255,.03)",
                        borderColor: modificado ? "oklch(0.72 0.13 250 / .4)" : "rgba(255,255,255,.08)",
                      }}
                    >
                      <span className="font-mono font-semibold text-[14px] tabular-nums" style={{ color: modificado ? "#fff" : "#dcdcdc" }}>
                        {Number(actual).toFixed(1)}
                      </span>
                      {modificado && (
                        <span className="font-mono text-[8.5px] text-[#8a8a8a]">base {Number(original).toFixed(1)}</span>
                      )}
                      {seleccionada && (
                        <div className="absolute -top-px -right-px -bottom-px flex flex-col">
                          <button
                            onClick={e => { e.stopPropagation(); setValor(fila.id_universidad, m.id_metrica, Number(actual) + PASO_STEPPER); }}
                            className="flex-1 w-5 bg-white text-[#111] text-[10px] font-semibold leading-none"
                          >
                            +
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setValor(fila.id_universidad, m.id_metrica, Math.max(0, Number(actual) - PASO_STEPPER)); }}
                            className="flex-1 w-5 bg-[#2a2a2a] text-white text-[10px] font-semibold leading-none"
                          >
                            −
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="flex items-center gap-2 pr-2">
                  <span className="font-mono font-semibold text-[13px] tabular-nums w-10 text-right" style={{ color: modificadaFila ? "#fff" : "#dcdcdc" }}>
                    {score.toFixed(1)}
                  </span>
                  <div className="flex-1 h-1.5 bg-white/[.07]">
                    <div className="h-1.5" style={{ width: `${(score / maxScore) * 100}%`, background: modificadaFila ? "oklch(0.72 0.13 250)" : "rgba(255,255,255,.35)" }} />
                  </div>
                </div>
              </div>
            );
          })}

          <p className="text-[11.5px] leading-relaxed text-[#7a7a7a] mt-3.5">
            ¿Quieres afinar solo tu institución? Cambia al modo Unitaria arriba.
          </p>
        </div>

        {/* Ranking dinámico */}
        <div className="border-l border-white/[.08] bg-panel py-6 px-[22px]">
          <p className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a] mb-1">Ranking simulado</p>
          <p className="text-[10.5px] text-[#6f6f6f] mb-3.5">Se reordena al editar</p>
          {rankingCompleto.map((r, i) => {
            const modificada = filaTieneOverride(r.id_universidad);
            return (
              <div
                key={r.id_universidad}
                className="flex items-center gap-2.5 py-[11px] px-2 border-b border-white/[.06]"
                style={{ borderLeft: `2px solid ${modificada ? "oklch(0.72 0.13 250)" : "transparent"}` }}
              >
                <span className="font-mono text-[12px] text-[#8a8a8a]">{i + 1}</span>
                <span className="flex-1 font-body font-semibold text-[12px] truncate" style={{ color: modificada ? "#fff" : "#dcdcdc" }}>
                  {r.nombre}
                </span>
                <span className="font-mono font-semibold text-[12px] tabular-nums" style={{ color: modificada ? "#fff" : "#dcdcdc" }}>
                  {r.score.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
