import { useMemo, useState } from "react";
import { useSimulacion } from "../../hooks/useSimulacion";
import { desglose } from "../../utils/desgloseCambio";
import { NEGATIVO, POSITIVO, fmt } from "./paleta";
import { nombreCorto } from "../../utils/universidades";

const control = "bg-[#242424] border border-white/[.14] text-white font-body font-medium text-[11.5px] px-2.5 py-[6px] cursor-pointer focus:outline-none focus:border-white/40";
const signo = (v, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmt(Math.abs(v), d)}`;

/** Por qué cambió el total de una institución entre dos ediciones: cuánto aporta
 *  cada métrica a la variación. Solo en puntajes: en cifras medidas no hay total. */
export default function DesgloseCambio({ rankingId, anios, candidatas, universidades, disciplina, foco }) {
  const [elegida, setElegida] = useState(null);
  const [desde, setDesde] = useState(null);
  const [hasta, setHasta] = useState(null);

  const institucion = candidatas.includes(elegida) ? elegida
    : candidatas.includes(foco) ? foco : candidatas[0];
  const ordenados = [...anios].sort((a, b) => b - a);
  const anioHasta = hasta && ordenados.includes(hasta) ? hasta : ordenados[0];
  const anioDesde = desde && ordenados.includes(desde) && desde < anioHasta
    ? desde : ordenados.find(a => a < anioHasta);

  const filasDesde = useSimulacion(anioDesde ? rankingId : null, anioDesde, institucion ? [institucion] : []);
  const filasHasta = useSimulacion(anioHasta ? rankingId : null, anioHasta, institucion ? [institucion] : []);
  const resultado = useMemo(() => {
    const filtrar = (filas) => filas.filter(f => f.id_universidad === institucion
      && (!disciplina || f.disciplina === disciplina));
    const a = filtrar(filasDesde);
    const b = filtrar(filasHasta);
    return a.length && b.length ? desglose(a, b) : null;
  }, [filasDesde, filasHasta, institucion, disciplina]);

  if (!institucion || ordenados.length < 2) return null;
  const nombre = universidades?.find(u => u.id_universidad === institucion)?.nombre_universidad || "";
  const maximo = Math.max(1e-9, ...(resultado?.metricas || []).map(m => Math.abs(m.delta)));

  return (
    <section className="mt-6 bg-panel border border-white/[.09] px-5 pt-4 pb-5" data-seccion="desglose-cambio">
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h2 className="font-body font-semibold text-[13px] text-white mr-2">Por qué cambió el total</h2>
        <select aria-label="Institución del desglose" className={`${control} max-w-[260px]`} value={institucion} onChange={e => setElegida(Number(e.target.value))}>
          {candidatas.map(id => (
            <option key={id} value={id}>
              {nombreCorto(universidades?.find(u => u.id_universidad === id)?.nombre_universidad || String(id))}
            </option>
          ))}
        </select>
        <select aria-label="Año inicial" className={control} value={anioDesde ?? ""} onChange={e => setDesde(Number(e.target.value))}>
          {ordenados.filter(a => a < anioHasta).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-[#8a8a8a] text-[11px]">→</span>
        <select aria-label="Año final" className={control} value={anioHasta ?? ""} onChange={e => setHasta(Number(e.target.value))}>
          {ordenados.slice(0, -1).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <p className="font-body text-[10.5px] text-[#8a8a8a] mb-4">
        Cuánto aporta cada métrica a la variación del total: su puntaje por lo que pesa, en una edición y en la otra.
      </p>

      {!resultado ? (
        <p className="font-body text-[11.5px] text-[#858585]">
          {nombreCorto(nombre)} no tiene datos en {anioDesde} y en {anioHasta}{disciplina ? ` (${disciplina})` : ""}.
        </p>
      ) : (
        <>
          <p className="font-body text-[12px] text-[#c4c4c4] mb-3" data-resumen-cambio>
            La suma de las métricas pasa de <span className="font-mono text-white">{fmt(resultado.totalAntes)}</span> a{" "}
            <span className="font-mono text-white">{fmt(resultado.totalDespues)}</span>{" "}
            <span className="font-mono" style={{ color: resultado.delta > 0 ? POSITIVO : resultado.delta < 0 ? NEGATIVO : "#8a8a8a" }}>
              ({signo(resultado.delta)})
            </span>
            {resultado.registradoAntes != null && resultado.registradoDespues != null && (
              <> · total registrado en el ranking: {fmt(resultado.registradoAntes)} → {fmt(resultado.registradoDespues)}</>
            )}
          </p>
          {resultado.metricas.map(m => (
            <div key={m.nombre} className="grid items-center gap-3 py-1.5 border-b border-white/[.05] grid-cols-[minmax(0,1fr)_88px_52px] md:grid-cols-[200px_92px_minmax(0,1fr)_64px]">
              <span className="font-body text-[11.5px] text-[#dcdcdc] truncate" title={m.nombre}>
                {m.nombre}
                {m.estado && <span className="ml-1.5 font-mono text-[9px] uppercase text-[#8a8a8a]">{m.estado}</span>}
              </span>
              <span className="font-mono text-[10.5px] text-[#9a9a9a] text-right">
                {m.antes == null ? "—" : fmt(m.antes)} → {m.despues == null ? "—" : fmt(m.despues)}
              </span>
              <div className="relative h-3 hidden md:block" aria-hidden="true">
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/20" />
                <div className="absolute top-0.5 bottom-0.5"
                     style={{
                       left: m.delta >= 0 ? "50%" : `${50 - (Math.abs(m.delta) / maximo) * 50}%`,
                       width: `${(Math.abs(m.delta) / maximo) * 50}%`,
                       background: m.delta >= 0 ? POSITIVO : NEGATIVO,
                       opacity: 0.75,
                     }} />
              </div>
              <span className="font-mono text-[11px] text-right"
                    style={{ color: m.delta > 0 ? POSITIVO : m.delta < 0 ? NEGATIVO : "#858585" }}>
                {Math.abs(m.delta) < 0.005 ? "—" : signo(m.delta, 2)}
              </span>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
