import { useMemo, useState } from "react";
import { useSimulacion } from "../../hooks/useSimulacion";
import { useDescarga, motivoAgotado } from "../../hooks/useDescarga";
import { evaluar, pasoPara, posiciones, prepararCifras, topePara } from "../../utils/simulacionCifras";
import { formatearValor } from "../../utils/valoresReales";
import { useAuth } from "../../auth/AuthContext";
import { generarInformeSimulacion } from "../../reportes/informeSimulacion";

/** Simulación de una institución sobre sus cifras medidas.
 *
 * Solo para rankings cuyo puntaje es el percentil de la cifra (Ranking KAI,
 * Scimago). Se mueve la cifra real —por ejemplo, las jornadas con doctorado— y
 * el percentil, el total y la posición se recalculan contra todas las
 * universidades del año. El padre le pasa una `key` por ranking, año e
 * institución, de modo que el escenario empieza limpio al cambiar cualquiera.
 */
export default function SimulacionUnitariaCifras({ rankingId, anio, rankingNombre, universidadId }) {
  // Todas las universidades del año: el percentil se calcula contra ellas.
  const filas = useSimulacion(rankingId, anio, [], "numerico");
  const { metricas, universidades } = useMemo(() => prepararCifras(filas), [filas]);
  const [cifras, setCifras] = useState({}); // { id_metrica: cifra simulada }
  const descarga = useDescarga("simulacion");
  const { usuario } = useAuth();

  const propia = universidades.find((u) => u.id_universidad === universidadId);
  const base = useMemo(() => evaluar(universidades, metricas), [universidades, metricas]);
  const simulado = useMemo(
    () => evaluar(universidades, metricas, universidadId ? { [universidadId]: cifras } : {}),
    [universidades, metricas, universidadId, cifras]);
  const posBase = useMemo(() => posiciones(base, universidades), [base, universidades]);
  const posSim = useMemo(() => posiciones(simulado, universidades), [simulado, universidades]);

  if (!universidadId) {
    return <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">Selecciona una institución para simular.</div>;
  }
  if (!anio || !filas.length) {
    return <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">Cargando cifras…</div>;
  }
  if (!propia) {
    return (
      <div className="flex items-center justify-center h-64 text-outlineSoft text-sm text-center px-6">
        {rankingNombre} no tiene cifras de esta institución en {anio}.
      </div>
    );
  }

  const idPropia = propia.id_universidad;
  const totalBase = base.get(idPropia)?.total ?? 0;
  const totalSim = simulado.get(idPropia)?.total ?? 0;
  const pBase = posBase.get(idPropia);
  const pSim = posSim.get(idPropia);
  const movimiento = pBase != null && pSim != null ? pBase - pSim : 0;
  const hayCambios = Object.keys(cifras).length > 0;

  const otras = universidades.filter((u) => u.id_universidad !== idPropia);
  const superadas = otras.filter((u) =>
    (base.get(u.id_universidad)?.total ?? 0) >= totalBase && (simulado.get(u.id_universidad)?.total ?? 0) < totalSim);
  const perdidas = otras.filter((u) =>
    (base.get(u.id_universidad)?.total ?? 0) <= totalBase && (simulado.get(u.id_universidad)?.total ?? 0) > totalSim);
  const maxTotal = Math.max(1, ...[...simulado.values(), ...base.values()].map((r) => r.total));

  const cifraDe = (m) => cifras[m.id_metrica] ?? propia.valores[m.id_metrica];
  const fijar = (id, v) => setCifras((prev) => ({ ...prev, [id]: v }));

  const filasInforme = () => metricas.map((m) => [
    m.nombre_metrica, m.unidad, m.peso_metrica,
    propia.valores[m.id_metrica] ?? "", cifraDe(m) ?? "",
    (base.get(idPropia)?.puntajes[m.id_metrica] ?? 0).toFixed(1),
    (simulado.get(idPropia)?.puntajes[m.id_metrica] ?? 0).toFixed(1),
  ]);

  const exportarCSV = () => {
    const tabla = [
      ["Institución", propia.nombre], ["Ranking", rankingNombre], ["Año", anio], ["Modo", "valores medidos"], [],
      ["Métrica", "Unidad", "Peso (%)", "Cifra base", "Cifra simulada", "Percentil base", "Percentil simulado"],
      ...filasInforme(), [],
      ["Puntaje base", totalBase.toFixed(2)], ["Puntaje simulado", totalSim.toFixed(2)],
      ["Posición base", pBase ?? ""], ["Posición simulada", pSim ?? ""],
    ];
    const csv = tabla.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `simulacion_cifras_${propia.nombre}_${anio}.csv`.replace(/\s+/g, "_");
    a.click();
  };

  const exportarPDF = async () => {
    if (!(await descarga.permitir("pdf"))) return;
    const siguiente = otras
      .map((u) => ({ nombre: u.nombre, total: simulado.get(u.id_universidad)?.total ?? 0 }))
      .filter((u) => u.total > totalSim)
      .sort((a, b) => a.total - b.total)[0];
    await generarInformeSimulacion({
      tipo: "unitaria", cifras: true, usuario,
      ranking: rankingNombre, anio, institucion: propia.nombre,
      base: { posicion: pBase, score: totalBase },
      simulado: { posicion: pSim, score: totalSim },
      total: universidades.length,
      metricas: metricas.map((m) => {
        const pB = base.get(idPropia)?.puntajes[m.id_metrica] ?? 0;
        const pS = simulado.get(idPropia)?.puntajes[m.id_metrica] ?? 0;
        return {
          nombre: m.nombre_metrica, unidad: m.unidad, peso: m.peso_metrica,
          base: propia.valores[m.id_metrica] ?? null, simulado: cifraDe(m) ?? null,
          percentilBase: pB, percentilSimulado: pS,
          efecto: m.pondera ? ((pS - pB) * m.peso_metrica) / 100 : 0,
          modificada: cifras[m.id_metrica] !== undefined,
        };
      }),
      superadas: superadas.map((u) => u.nombre),
      perdidas: perdidas.map((u) => u.nombre),
      siguiente: siguiente ? { nombre: siguiente.nombre, brecha: siguiente.total - totalSim } : null,
    });
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) 380px" }}>
      <div className="pt-[22px] px-7 pb-7">
        <div className="grid gap-4 pb-2.5 border-b border-white/[.1]" style={{ gridTemplateColumns: "220px 128px 1fr 96px" }}>
          <div className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a]">Métrica</div>
          <div className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a] text-right">Cifra</div>
          <div className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a]">Ajuste</div>
          <div className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a] text-right">Efecto</div>
        </div>

        {metricas.map((m) => {
          const actual = cifraDe(m);
          const original = propia.valores[m.id_metrica];
          const tope = topePara(m, universidades, actual);
          const pB = base.get(idPropia)?.puntajes[m.id_metrica] ?? 0;
          const pS = simulado.get(idPropia)?.puntajes[m.id_metrica] ?? 0;
          const efecto = m.pondera ? ((pS - pB) * m.peso_metrica) / 100 : 0;
          const modificado = cifras[m.id_metrica] !== undefined;
          const id = `cifra-${m.id_metrica}`;
          return (
            <div key={m.id_metrica} className="grid gap-4 items-center py-[13px] border-b border-white/[.06]"
              style={{ gridTemplateColumns: "220px 128px 1fr 96px" }}>
              <div>
                <label htmlFor={id} className="font-body font-semibold text-[12.5px] text-[#e6e6e6]">{m.nombre_metrica}</label>
                <div className="font-mono text-[10px] text-[#6f6f6f] mt-1">
                  peso {m.peso_metrica}% · {m.unidad}{m.sentido === "menor" ? " · menos es mejor" : ""}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-mono font-semibold text-[17px] tabular-nums ${modificado ? "text-accent" : "text-white"}`}>
                  {actual == null ? "—" : formatearValor(actual)}
                </div>
                <div className="font-mono text-[9.5px] text-[#6f6f6f]">
                  base {original == null ? "—" : formatearValor(original)} · supera al {pS.toFixed(0)}%
                </div>
              </div>
              <input
                id={id}
                type="range"
                min={0}
                max={tope}
                step={pasoPara(tope)}
                value={actual ?? 0}
                onChange={(e) => fijar(m.id_metrica, Number(e.target.value))}
                aria-valuetext={`${formatearValor(actual)} ${m.unidad}`}
                className="w-full cursor-pointer accent-white"
              />
              <div className={`text-right font-mono font-semibold text-[12px] ${
                efecto > 0.005 ? "text-positive" : efecto < -0.005 ? "text-negative" : "text-[#6f6f6f]"}`}>
                {Math.abs(efecto) < 0.005 ? "—" : `${efecto > 0 ? "+" : ""}${efecto.toFixed(1)}`}
              </div>
            </div>
          );
        })}

        <p className="text-[11.5px] leading-relaxed text-[#7a7a7a] mt-4">
          Mueve la cifra real de un componente: el percentil se recalcula contra las {universidades.length} universidades
          de {anio}, y con él el puntaje y la posición. Al mejorar una institución, otras pueden perder puntos sin haber
          cambiado nada: su posición relativa empeora.
        </p>
      </div>

      <div className="border-l border-white/[.08] bg-panel py-[26px] px-[26px]">
        <p className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a] mb-4">Resultado simulado</p>
        <p className="text-[10.5px] text-[#8a8a8a] mb-1">Posición</p>
        <div className="flex items-baseline gap-2 mb-5">
          <span className="font-headline text-[52px] font-semibold text-white leading-none">{pSim ?? "—"}</span>
          {movimiento !== 0 && (
            <span className={`font-mono font-semibold text-[13px] ${movimiento > 0 ? "text-positive" : "text-negative"}`}>
              {movimiento > 0 ? `▲${movimiento}` : `▼${Math.abs(movimiento)}`}
            </span>
          )}
        </div>
        <p className="text-[10.5px] text-[#8a8a8a] mb-1">Puntaje</p>
        <div className="flex items-baseline gap-2">
          <span className="font-mono font-semibold text-[26px] text-white">{totalSim.toFixed(1)}</span>
          <span className={`font-mono font-semibold text-[12px] ${
            totalSim > totalBase + 0.005 ? "text-positive" : totalSim < totalBase - 0.005 ? "text-negative" : "text-[#6f6f6f]"}`}>
            {Math.abs(totalSim - totalBase) < 0.005 ? "—" : `${totalSim > totalBase ? "+" : ""}${(totalSim - totalBase).toFixed(1)}`}
          </span>
        </div>
        <div className="relative h-6 bg-white/[.06] mt-4 mb-1.5">
          <div className="absolute top-0 left-0 h-6" style={{ width: `${Math.min(100, (totalSim / maxTotal) * 100)}%`, background: "oklch(0.72 0.13 250 / .35)" }} />
          <div className="absolute top-0 h-6 w-[2px] bg-white" style={{ left: `${Math.min(100, (totalBase / maxTotal) * 100)}%` }} />
        </div>
        <p className="text-[10.5px] text-[#6f6f6f] mb-[22px]">La línea blanca es el puntaje real de {anio}.</p>

        {superadas.length > 0 && (
          <div className="p-3.5 bg-background border border-white/[.08] mb-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[.12em] text-positive mb-2">Superamos a</p>
            {superadas.map((u) => <div key={u.id_universidad} className="text-xs text-[#dcdcdc] py-0.5">{u.nombre}</div>)}
          </div>
        )}
        {perdidas.length > 0 && (
          <div className="p-3.5 bg-background border border-white/[.08] mb-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[.12em] text-negative mb-2">Nos superan</p>
            {perdidas.map((u) => <div key={u.id_universidad} className="text-xs text-[#dcdcdc] py-0.5">{u.nombre}</div>)}
          </div>
        )}
        {!hayCambios && (
          <p className="text-xs leading-relaxed text-[#7a7a7a]">
            Aún no has movido ninguna cifra. Empieza por la que más pesa: {metricas[0]?.nombre_metrica}.
          </p>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={() => setCifras({})} disabled={!hayCambios}
            className="py-2.5 px-3 border border-white/[.18] text-[#cfcfcf] text-[11px] hover:border-white/40 disabled:opacity-40">
            Restablecer
          </button>
          <button onClick={exportarCSV} className="flex-1 py-2.5 bg-white text-[#111] text-[11px] font-semibold hover:bg-white/80">
            Exportar CSV
          </button>
          <button onClick={exportarPDF} disabled={descarga.agotado("pdf")}
            title={descarga.agotado("pdf") ? motivoAgotado("pdf") : undefined}
            className="flex-1 py-2.5 border border-white/[.18] text-[#cfcfcf] text-[11px] hover:border-white/40">
            Exportar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
