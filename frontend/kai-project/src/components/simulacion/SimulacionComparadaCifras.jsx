import { useMemo, useState } from "react";
import { useSimulacion } from "../../hooks/useSimulacion";
import { evaluar, pasoPara, posiciones, prepararCifras, topePara } from "../../utils/simulacionCifras";
import { formatearValor } from "../../utils/valoresReales";
import { useDescarga, motivoAgotado } from "../../hooks/useDescarga";
import { useAuth } from "../../auth/AuthContext";
import { generarInformeSimulacion } from "../../reportes/informeSimulacion";
import { institucionPropia } from "../../reportes/documento";

/** Simulación comparada sobre cifras medidas.
 *
 * Matriz de las instituciones elegidas por componente, con la cifra real en cada
 * celda. Al editar una, el percentil se recalcula contra todas las universidades
 * del año —no solo las elegidas—, así que la posición que se muestra es la del
 * ranking completo. El padre le pasa una `key` por ranking y año.
 */
export default function SimulacionComparadaCifras({ rankingId, anio, rankingNombre, selectedUniversidades }) {
  const filas = useSimulacion(rankingId, anio, [], "numerico");
  const { metricas, universidades } = useMemo(() => prepararCifras(filas), [filas]);
  const [cifras, setCifras] = useState({}); // { id_universidad: { id_metrica: cifra } }
  const [celda, setCelda] = useState(null);
  const [soloModificadas, setSoloModificadas] = useState(false);
  const descarga = useDescarga("simulacion");
  const { usuario } = useAuth();

  const simulado = useMemo(() => evaluar(universidades, metricas, cifras), [universidades, metricas, cifras]);
  const base = useMemo(() => evaluar(universidades, metricas), [universidades, metricas]);
  const posSim = useMemo(() => posiciones(simulado, universidades), [simulado, universidades]);
  const posBase = useMemo(() => posiciones(base, universidades), [base, universidades]);

  const elegidas = universidades.filter((u) => selectedUniversidades.includes(u.id_universidad));
  const modificada = (id) => Object.keys(cifras[id] || {}).length > 0;
  const visibles = (soloModificadas ? elegidas.filter((u) => modificada(u.id_universidad)) : elegidas)
    .sort((a, b) => (posSim.get(a.id_universidad) ?? 1e9) - (posSim.get(b.id_universidad) ?? 1e9));

  if (!anio) {
    return <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">Selecciona un año para comenzar.</div>;
  }
  if (!selectedUniversidades.length) {
    return <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">Selecciona al menos una institución para comparar.</div>;
  }
  if (!filas.length) {
    return <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">Cargando cifras…</div>;
  }
  if (!elegidas.length) {
    return <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">{rankingNombre} no tiene cifras de esas instituciones en {anio}.</div>;
  }

  const cifraDe = (u, m) => cifras[u.id_universidad]?.[m.id_metrica] ?? u.valores[m.id_metrica];
  const fijar = (idU, idM, v) => setCifras((prev) => ({ ...prev, [idU]: { ...(prev[idU] || {}), [idM]: v } }));
  const maxTotal = Math.max(1, ...elegidas.map((u) => simulado.get(u.id_universidad)?.total ?? 0));
  const columnas = `200px repeat(${metricas.length}, minmax(104px, 1fr)) 128px`;

  const exportarCSV = () => {
    const tabla = [
      ["Ranking", rankingNombre], ["Año", anio], ["Modo", "valores medidos"], [],
      ["Institución", ...metricas.map((m) => `${m.nombre_metrica} (${m.unidad})`), "Puntaje", "Posición"],
      ...visibles.map((u) => [
        u.nombre,
        ...metricas.map((m) => cifraDe(u, m) ?? ""),
        (simulado.get(u.id_universidad)?.total ?? 0).toFixed(2),
        posSim.get(u.id_universidad) ?? "",
      ]),
    ];
    const csv = tabla.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `simulacion_comparada_cifras_${rankingNombre}_${anio}.csv`.replace(/\s+/g, "_");
    a.click();
  };

  const exportarPDF = async () => {
    if (!(await descarga.permitir("pdf"))) return;
    const porId = new Map(metricas.map((m) => [String(m.id_metrica), m]));
    await generarInformeSimulacion({
      tipo: "comparada", cifras: true, usuario,
      ranking: rankingNombre, anio, universo: universidades.length,
      foco: institucionPropia(usuario, universidades),
      instituciones: elegidas.map((u) => ({
        id: u.id_universidad, nombre: u.nombre,
        scoreBase: base.get(u.id_universidad)?.total ?? 0, scoreSim: simulado.get(u.id_universidad)?.total ?? 0,
        posBase: posBase.get(u.id_universidad), posSim: posSim.get(u.id_universidad),
        modificada: modificada(u.id_universidad),
      })),
      cambios: universidades.flatMap((u) => Object.entries(cifras[u.id_universidad] || {})
        .filter(([idM]) => porId.has(idM))
        .map(([idM, v]) => {
          const m = porId.get(idM);
          return { institucion: u.nombre, metrica: m.nombre_metrica, unidad: m.unidad,
                   base: u.valores[m.id_metrica] ?? 0, simulado: v, menorEsMejor: m.sentido === "menor" };
        })),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-white/[.08]">
        <p className="text-xs text-[#8a8a8a] max-w-[720px]">
          Cifras medidas. Haz clic en una celda y escribe la cifra simulada: el percentil se recalcula contra las{" "}
          {universidades.length} universidades de {anio}, y la posición es la del ranking completo.
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => setSoloModificadas((v) => !v)}
            className={`text-[11px] py-2 px-3 border ${soloModificadas ? "bg-white text-[#111] border-white" : "bg-[#1c1c1c] border-white/[.14] text-[#9a9a9a] hover:text-white"}`}>
            Solo modificadas
          </button>
          <button onClick={() => setCifras({})} className="text-[11px] py-2 px-3 border border-white/[.14] text-[#8a8a8a] hover:text-white">
            Restablecer
          </button>
          <button onClick={exportarCSV} className="text-[11px] font-semibold py-2 px-3 bg-white text-[#111] hover:bg-white/80">
            Exportar CSV
          </button>
          <button onClick={exportarPDF} disabled={descarga.agotado("pdf")}
            title={descarga.agotado("pdf") ? motivoAgotado("pdf") : undefined}
            className="text-[11px] py-2 px-3 border border-white/[.14] text-[#8a8a8a] hover:text-white disabled:opacity-40">
            PDF
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) 300px" }}>
        <div className="pt-4 pr-6 pb-7 overflow-x-auto">
          <div className="grid gap-[5px] pb-2" style={{ gridTemplateColumns: columnas }}>
            <div />
            {metricas.map((m) => (
              <div key={m.id_metrica} className="text-center">
                <div className="font-body font-medium text-[9.5px] text-[#b4b4b4] leading-tight">{m.nombre_metrica}</div>
                <div className="font-mono text-[8.5px] text-[#6f6f6f] mt-0.5 leading-tight">{m.unidad}</div>
                <div className="font-mono text-[9px] text-[#6f6f6f]">{m.peso_metrica}%{m.sentido === "menor" ? " · ↓ mejor" : ""}</div>
              </div>
            ))}
            <div className="font-mono text-[9.5px] uppercase tracking-[.12em] text-[#7a7a7a] text-right self-end">Puntaje</div>
          </div>

          {visibles.map((u) => {
            const total = simulado.get(u.id_universidad)?.total ?? 0;
            return (
              <div key={u.id_universidad} className="grid gap-[5px] items-stretch mb-[5px]"
                style={{ gridTemplateColumns: columnas, borderLeft: `2px solid ${modificada(u.id_universidad) ? "oklch(0.72 0.13 250)" : "transparent"}` }}>
                <div className="flex items-center pl-2 font-body font-semibold text-[12.5px] text-[#e6e6e6] truncate">{u.nombre}</div>
                {metricas.map((m) => {
                  const original = u.valores[m.id_metrica];
                  const actual = cifraDe(u, m);
                  const cambiada = cifras[u.id_universidad]?.[m.id_metrica] !== undefined;
                  const clave = `${u.id_universidad}-${m.id_metrica}`;
                  const tope = topePara(m, universidades, actual);
                  return (
                    <div key={m.id_metrica} onClick={() => setCelda(clave)}
                      className="relative h-[50px] flex flex-col items-center justify-center cursor-pointer border"
                      style={{
                        background: cambiada ? "oklch(0.72 0.13 250 / .16)" : "rgba(255,255,255,.03)",
                        borderColor: cambiada ? "oklch(0.72 0.13 250 / .4)" : "rgba(255,255,255,.08)",
                      }}>
                      {celda === clave ? (
                        <input
                          autoFocus
                          type="number"
                          min={0}
                          max={tope}
                          step={pasoPara(tope)}
                          defaultValue={actual ?? ""}
                          aria-label={`${m.nombre_metrica} de ${u.nombre}`}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setCelda(null); }}
                          onBlur={(e) => {
                            const v = e.target.value === "" ? null : Number(e.target.value);
                            if (v != null && !Number.isNaN(v) && v !== original) fijar(u.id_universidad, m.id_metrica, v);
                            setCelda(null);
                          }}
                          className="w-[88%] bg-background border border-white/30 text-white text-[12px] font-mono text-center py-1 outline-none"
                        />
                      ) : (
                        <>
                          <span className="font-mono font-semibold text-[13px] tabular-nums" style={{ color: cambiada ? "#fff" : "#dcdcdc" }}>
                            {actual == null ? "—" : formatearValor(actual)}
                          </span>
                          <span className="font-mono text-[8.5px] text-[#7a7a7a]">
                            {cambiada ? `base ${formatearValor(original)}` : `p${(simulado.get(u.id_universidad)?.puntajes[m.id_metrica] ?? 0).toFixed(0)}`}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
                <div className="flex items-center gap-2 pr-2">
                  <span className="font-mono font-semibold text-[13px] tabular-nums w-10 text-right" style={{ color: modificada(u.id_universidad) ? "#fff" : "#dcdcdc" }}>
                    {total.toFixed(1)}
                  </span>
                  <div className="flex-1 h-1.5 bg-white/[.07]">
                    <div className="h-1.5" style={{ width: `${(total / maxTotal) * 100}%`, background: modificada(u.id_universidad) ? "oklch(0.72 0.13 250)" : "rgba(255,255,255,.35)" }} />
                  </div>
                </div>
              </div>
            );
          })}
          <p className="text-[11.5px] leading-relaxed text-[#7a7a7a] mt-3.5">
            «p» es el percentil de cada cifra: el porcentaje de las demás universidades a las que supera.
          </p>
        </div>

        <div className="border-l border-white/[.08] bg-panel py-6 px-[22px]">
          <p className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a] mb-1">Posición en el ranking</p>
          <p className="text-[10.5px] text-[#6f6f6f] mb-3.5">Entre las {universidades.length} universidades de {anio}</p>
          {[...elegidas]
            .sort((a, b) => (posSim.get(a.id_universidad) ?? 1e9) - (posSim.get(b.id_universidad) ?? 1e9))
            .map((u) => {
              const pS = posSim.get(u.id_universidad);
              const mov = (posBase.get(u.id_universidad) ?? pS) - pS;
              return (
                <div key={u.id_universidad} className="flex items-center gap-2.5 py-[11px] px-2 border-b border-white/[.06]"
                  style={{ borderLeft: `2px solid ${modificada(u.id_universidad) ? "oklch(0.72 0.13 250)" : "transparent"}` }}>
                  <span className="font-mono text-[12px] text-[#8a8a8a] w-6">{pS}</span>
                  <span className="flex-1 font-body font-semibold text-[12px] truncate text-[#dcdcdc]">{u.nombre}</span>
                  {mov !== 0 && (
                    <span className={`font-mono text-[11px] ${mov > 0 ? "text-positive" : "text-negative"}`}>
                      {mov > 0 ? `▲${mov}` : `▼${Math.abs(mov)}`}
                    </span>
                  )}
                  <span className="font-mono font-semibold text-[12px] tabular-nums text-[#dcdcdc]">
                    {(simulado.get(u.id_universidad)?.total ?? 0).toFixed(1)}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
