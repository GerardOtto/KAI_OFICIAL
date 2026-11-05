import { useMemo, useState } from "react";
import { useSimulacion } from "../../hooks/useSimulacion";
import { prepararCifras, evaluar, posiciones } from "../../utils/simulacionCifras";
import {
  brechaPorMetrica, clasificar, meta, planConcentrado, planCifras, planParejo, prepararPuntajes,
  puestoCon, unaSolaMetrica, unaSolaMetricaCifras,
} from "../../utils/simulacionInversa";
import { formatearValor } from "../../utils/valoresReales";
import { conSigno, decimal, porcentaje } from "../../utils/formato";
import { nombreCorto } from "../../utils/universidades";

const etiqueta = "font-mono text-[9.5px] uppercase tracking-[.14em] text-[#8a8a8a]";
const control = "bg-[#1c1c1c] border border-white/[.14] text-[#cfcfcf] text-[11.5px] py-2 px-3 focus:outline-none focus:border-white/40";

/** Simulación inversa: qué mover, y cuánto, para superar a una institución o
 *  llegar a un puesto. En puntajes sirve para todos los rankings; en cifras
 *  (Ranking KAI, Scimago) responde en la cifra real. La lógica vive en
 *  utils/simulacionInversa.js; aquí solo se elige el objetivo y se dibuja. */
export default function SimulacionObjetivo({
  rankingId, anio, rankingNombre, universidadId, disciplinaFiltro, enCifras, onProbar,
}) {
  const filas = useSimulacion(rankingId, anio, [], enCifras ? "numerico" : "puntajes");
  const filtradas = useMemo(
    () => (disciplinaFiltro ? filas.filter(f => f.disciplina === disciplinaFiltro) : filas),
    [filas, disciplinaFiltro]);

  // Clasificación de la edición, en la misma escala que se va a mover.
  const datos = useMemo(() => {
    if (enCifras) {
      const { metricas, universidades } = prepararCifras(filtradas);
      const r = evaluar(universidades, metricas);
      const pos = posiciones(r, universidades);
      const clasificacion = universidades
        .map(u => ({ ...u, total: r.get(u.id_universidad)?.total ?? 0, puesto: pos.get(u.id_universidad) }))
        .sort((a, b) => a.puesto - b.puesto);
      return { metricas, universidades, clasificacion };
    }
    const { metricas, universidades } = prepararPuntajes(filtradas);
    return { metricas, universidades, clasificacion: clasificar(universidades) };
  }, [filtradas, enCifras]);

  const propia = datos.clasificacion.find(u => u.id_universidad === universidadId);
  const delante = useMemo(
    () => (propia ? datos.clasificacion.filter(u => u.puesto < propia.puesto) : []),
    [datos.clasificacion, propia]);

  // Sin elección: superar a la que está justo delante.
  const [elegido, setElegido] = useState(null);
  const objetivo = useMemo(() => {
    if (elegido?.tipo === "puesto" && propia && elegido.puesto < propia.puesto) return elegido;
    if (elegido?.tipo === "superar" && delante.some(u => u.id_universidad === elegido.id)) return elegido;
    const siguiente = delante[delante.length - 1];
    return siguiente ? { tipo: "superar", id: siguiente.id_universidad } : null;
  }, [elegido, propia, delante]);

  if (!universidadId) return <Aviso>Selecciona una institución para fijar su objetivo.</Aviso>;
  if (!anio || !filas.length) return <Aviso>Cargando la edición…</Aviso>;
  if (!propia) {
    return <Aviso>{rankingNombre} no tiene datos de esta institución en {anio}{disciplinaFiltro ? ` (${disciplinaFiltro})` : ""}.</Aviso>;
  }
  if (!objetivo) {
    return <Aviso>{propia.nombre} ya es la primera de {rankingNombre} {anio}: no hay a quién superar.</Aviso>;
  }

  const referencia = objetivo.tipo === "superar"
    ? datos.clasificacion.find(u => u.id_universidad === objetivo.id)
    : datos.clasificacion.find(u => u.puesto === objetivo.puesto && u.id_universidad !== universidadId);

  return (
    <div className="pt-4">
      {/* Objetivo */}
      <div className="flex flex-wrap items-end gap-4 pb-5 border-b border-white/[.08]">
        <div>
          <p className={`${etiqueta} mb-1.5`}>Objetivo</p>
          <select aria-label="Objetivo"
            className={control}
            value={objetivo.tipo}
            onChange={e => setElegido(e.target.value === "puesto"
              ? { tipo: "puesto", puesto: Math.max(1, propia.puesto - 1) }
              : { tipo: "superar", id: delante[delante.length - 1].id_universidad })}
          >
            <option value="superar">Superar a una institución</option>
            <option value="puesto">Llegar a un puesto</option>
          </select>
        </div>
        {objetivo.tipo === "superar" ? (
          <div>
            <p className={`${etiqueta} mb-1.5`}>Institución</p>
            <select aria-label="Institución a superar" className={`${control} max-w-[360px]`} value={objetivo.id}
                    onChange={e => setElegido({ tipo: "superar", id: Number(e.target.value) })}>
              {[...delante].reverse().map(u => (
                <option key={u.id_universidad} value={u.id_universidad}>
                  {u.puesto}. {u.nombre} · {decimal(u.total)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <p className={`${etiqueta} mb-1.5`}>Puesto</p>
            <select aria-label="Puesto objetivo" className={control} value={objetivo.puesto}
                    onChange={e => setElegido({ tipo: "puesto", puesto: Number(e.target.value) })}>
              {delante.map(u => <option key={u.puesto} value={u.puesto}>{u.puesto}.º</option>)}
            </select>
          </div>
        )}
        <p className="text-[11.5px] text-[#9a9a9a] leading-relaxed pb-2 max-w-[520px]">
          Hoy <span className="text-white font-semibold">{nombreCorto(propia.nombre)}</span> está en el puesto{" "}
          <span className="font-mono text-white">{propia.puesto}</span> con{" "}
          <span className="font-mono text-white">{decimal(propia.total)}</span>
          {referencia && <> y {nombreCorto(referencia.nombre)}, en el <span className="font-mono text-white">{referencia.puesto}</span>,
            con <span className="font-mono text-white">{decimal(referencia.total)}</span></>}.
        </p>
      </div>

      {enCifras
        ? <ObjetivoCifras datos={datos} propia={propia} objetivo={objetivo} referencia={referencia} onProbar={onProbar} />
        : <ObjetivoPuntajes datos={datos} propia={propia} objetivo={objetivo} referencia={referencia}
                            rankingNombre={rankingNombre} onProbar={onProbar} />}
    </div>
  );
}

function Aviso({ children }) {
  return <div className="flex items-center justify-center h-64 text-outlineSoft text-sm text-center px-6">{children}</div>;
}

function ObjetivoPuntajes({ datos, propia, objetivo, referencia, onProbar }) {
  const m = meta(datos.clasificacion, propia.id_universidad, objetivo);
  const una = useMemo(() => unaSolaMetrica(propia, datos.metricas, m.brecha), [propia, datos.metricas, m.brecha]);
  const concentrado = useMemo(() => planConcentrado(propia, datos.metricas, m.brecha), [propia, datos.metricas, m.brecha]);
  const parejo = useMemo(() => planParejo(propia, datos.metricas, m.brecha), [propia, datos.metricas, m.brecha]);
  const origen = referencia ? brechaPorMetrica(propia, referencia, datos.metricas) : [];
  const maxAporte = Math.max(1e-9, ...origen.map(o => Math.abs(o.aporte)));

  // Lo que se lleva a la simulación unitaria: el valor redondeado hacia arriba al
  // decimal, para que el plan siga cumpliendo al mostrarse con un decimal.
  const probar = (pasos) => onProbar?.(Object.fromEntries(
    pasos.map(p => [p.id_metrica, Math.min(p.techo, Math.ceil(p.a * 10 - 1e-9) / 10)])));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6">
      <div>
        <p className={`${etiqueta} mb-1`}>Faltan</p>
        <p className="font-headline text-[40px] font-semibold text-white leading-none mb-1" data-brecha>
          {decimal(m.brecha)} <span className="text-[16px] text-[#9a9a9a] font-body">puntos de total</span>
        </p>
        <p className="text-[11px] text-[#8a8a8a] mb-6">
          La diferencia de totales más una ventaja mínima de 0,05: superar es quedar por encima, no empatar.
        </p>

        {origen.length > 0 && (
          <section className="mb-8" data-seccion="origen">
            <h2 className="font-body font-semibold text-[13px] text-white mb-1">De dónde viene la brecha</h2>
            <p className="text-[11px] text-[#8a8a8a] mb-3">
              Cuánto aporta cada métrica a la diferencia con {nombreCorto(referencia.nombre)}: a la derecha, donde te
              saca ventaja; a la izquierda, donde la llevas tú.
            </p>
            {origen.map(o => (
              <div key={o.id_metrica} className="grid items-center gap-3 py-1.5 border-b border-white/[.05]"
                   style={{ gridTemplateColumns: "minmax(96px, 180px) minmax(0, 1fr) 64px" }}>
                <span className="text-[11.5px] text-[#dcdcdc] truncate" title={o.nombre_metrica}>{o.nombre_metrica}</span>
                <div className="relative h-3">
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/20" />
                  <div className="absolute top-0.5 bottom-0.5"
                       style={{
                         left: o.aporte >= 0 ? "50%" : `${50 - (Math.abs(o.aporte) / maxAporte) * 50}%`,
                         width: `${(Math.abs(o.aporte) / maxAporte) * 50}%`,
                         background: o.aporte >= 0 ? "oklch(0.68 0.16 25 / .75)" : "oklch(0.72 0.13 150 / .75)",
                       }} />
                </div>
                <span className={`font-mono text-[11px] text-right ${o.aporte > 0 ? "text-negative" : o.aporte < 0 ? "text-positive" : "text-[#858585]"}`}>
                  {conSigno(o.aporte)}
                </span>
              </div>
            ))}
          </section>
        )}

        <section data-seccion="una-metrica">
          <h2 className="font-body font-semibold text-[13px] text-white mb-1">Con una sola métrica</h2>
          <p className="text-[11px] text-[#8a8a8a] mb-3">Cuánto tendría que llegar a valer cada una, si fuera la única que se mueve.</p>
          <div className="grid gap-x-3 pb-1.5 border-b border-white/[.1]" style={{ gridTemplateColumns: "1fr 56px 56px 70px" }}>
            <span className={etiqueta}>Métrica</span>
            <span className={`${etiqueta} text-right`}>Hoy</span>
            <span className={`${etiqueta} text-right`}>Meta</span>
            <span className={`${etiqueta} text-right`}>Cambio</span>
          </div>
          {una.map(u => (
            <div key={u.id_metrica} className="grid gap-x-3 py-1.5 border-b border-white/[.05] items-baseline"
                 style={{ gridTemplateColumns: "1fr 56px 56px 70px" }}>
              <span className="text-[11.5px] text-[#dcdcdc] truncate" title={u.nombre_metrica}>
                {u.nombre_metrica} <span className="font-mono text-[9.5px] text-[#858585]">{porcentaje(u.peso_metrica)}</span>
              </span>
              <span className="font-mono text-[11.5px] text-right text-[#9a9a9a]">{decimal(u.de)}</span>
              <span className={`font-mono text-[11.5px] text-right ${u.alcanzable ? "text-white" : "text-[#858585]"}`}>
                {u.alcanzable ? decimal(u.a) : "—"}
              </span>
              <span className={`font-mono text-[11px] text-right ${u.alcanzable ? "text-positive" : "text-[#8a8a8a]"}`}
                    title={u.alcanzable ? undefined : `Aunque llegue a ${decimal(u.techo, 0)} aporta ${decimal(u.maximoAporte)} de ${decimal(m.brecha)}`}>
                {u.alcanzable ? conSigno(u.cambio) : "no alcanza"}
              </span>
            </div>
          ))}
        </section>
      </div>

      <div className="flex flex-col gap-5">
        <Plan
          titulo="Plan concentrado" datos="concentrado"
          explicacion="El de menos puntos: sube primero las métricas que más pesan, hasta su techo."
          plan={concentrado} clasificacion={datos.clasificacion} propia={propia}
          onProbar={() => probar(concentrado.pasos)}
        />
        <Plan
          titulo="Plan parejo" datos="parejo"
          explicacion={parejo.fraccion != null
            ? `Cierra el ${porcentaje(Math.min(100, parejo.fraccion * 100).toFixed(1))} de lo que le falta a cada métrica para su techo.`
            : "No queda margen en ninguna métrica."}
          plan={parejo} clasificacion={datos.clasificacion} propia={propia}
          onProbar={() => probar(parejo.pasos)}
        />
      </div>
    </div>
  );
}

function Plan({ titulo, datos, explicacion, plan, clasificacion, propia, onProbar }) {
  const nuevoTotal = propia.total + plan.pasos.reduce((s, p) => s + p.aporte, 0);
  const puesto = puestoCon(clasificacion, propia.id_universidad, nuevoTotal);
  return (
    <section className="p-5 bg-panel border border-white/[.08]" data-plan={datos}>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h2 className="font-body font-semibold text-[13px] text-white">{titulo}</h2>
        {plan.alcanzable ? (
          <span className="font-mono text-[11px] text-positive">puesto {propia.puesto} → {puesto}</span>
        ) : (
          <span className="font-mono text-[11px] text-warn">no alcanza</span>
        )}
      </div>
      <p className="text-[11px] text-[#8a8a8a] mb-3">{explicacion}</p>
      {plan.pasos.map(p => (
        <div key={p.id_metrica} className="flex items-baseline justify-between gap-3 py-1 border-b border-white/[.05]">
          <span className="text-[11.5px] text-[#dcdcdc] truncate" title={p.nombre_metrica}>{p.nombre_metrica}</span>
          <span className="font-mono text-[11.5px] text-[#cfcfcf] shrink-0">
            {decimal(p.de)} → <span className="text-white">{decimal(p.a)}</span>
            <span className="text-positive ml-2">{conSigno(p.aporte)}</span>
          </span>
        </div>
      ))}
      {!plan.alcanzable && (
        <p className="text-[11px] text-warn mt-2">
          Ni llevando cada métrica a su techo se cierra la brecha.
        </p>
      )}
      {plan.alcanzable && plan.pasos.length > 0 && onProbar && (
        <button onClick={onProbar}
                className="mt-3 text-[11px] font-semibold px-3 py-2 bg-white text-[#111] hover:bg-white/80 transition-colors">
          Probar en la simulación unitaria
        </button>
      )}
    </section>
  );
}

function ObjetivoCifras({ datos, propia, objetivo, referencia, onProbar }) {
  const { universidades, metricas } = datos;
  const una = useMemo(
    () => unaSolaMetricaCifras(universidades, metricas, propia.id_universidad, objetivo),
    [universidades, metricas, propia.id_universidad, objetivo]);
  const plan = useMemo(
    () => planCifras(universidades, metricas, propia.id_universidad, objetivo),
    [universidades, metricas, propia.id_universidad, objetivo]);
  const unidad = (m) => (m.unidad ? ` ${m.unidad}` : "");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6">
      <section data-seccion="una-metrica">
        <h2 className="font-body font-semibold text-[13px] text-white mb-1">Con una sola métrica</h2>
        <p className="text-[11px] text-[#8a8a8a] mb-3">
          La cifra mínima que cumple el objetivo si fuera la única que cambia. Se recalcula el percentil de todas las
          universidades del año: dejar atrás a otra también le quita puntos a ella.
        </p>
        {una.map(u => (
          <div key={u.id_metrica} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-white/[.05]">
            <span className="text-[11.5px] text-[#dcdcdc] truncate" title={u.nombre_metrica}>{u.nombre_metrica}</span>
            <span className="font-mono text-[11.5px] shrink-0 text-right">
              {u.sinCifra ? <span className="text-[#858585]">sin cifra</span>
                : u.alcanzable ? (
                  <>
                    <span className="text-[#9a9a9a]">{formatearValor(u.de)}</span> →{" "}
                    <span className="text-white">{formatearValor(u.a)}</span>
                    <span className="text-[#858585]">{unidad(u)}</span>
                  </>
                ) : <span className="text-[#8a8a8a]">no alcanza sola</span>}
            </span>
          </div>
        ))}
      </section>

      <section className="p-5 bg-panel border border-white/[.08] self-start" data-plan="cifras">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <h2 className="font-body font-semibold text-[13px] text-white">Plan combinado</h2>
          {plan.alcanzable
            ? <span className="font-mono text-[11px] text-positive">puesto {propia.puesto} → {plan.puesto}</span>
            : <span className="font-mono text-[11px] text-warn">no alcanza</span>}
        </div>
        <p className="text-[11px] text-[#8a8a8a] mb-3">
          Deja atrás, una a una, a la universidad siguiente en la métrica de más peso y, a igual peso, en la que está
          más cerca en proporción{referencia ? `, hasta superar a ${nombreCorto(referencia.nombre)}` : ""}.
        </p>
        {plan.pasos.map(p => (
          <div key={p.id_metrica} className="flex items-baseline justify-between gap-3 py-1 border-b border-white/[.05]">
            <span className="text-[11.5px] text-[#dcdcdc] truncate" title={p.nombre_metrica}>{p.nombre_metrica}</span>
            <span className="font-mono text-[11.5px] shrink-0">
              <span className="text-[#9a9a9a]">{formatearValor(p.de)}</span> → <span className="text-white">{formatearValor(p.a)}</span>
              <span className="text-[#858585]">{unidad(p)}</span>
            </span>
          </div>
        ))}
        {plan.alcanzable && plan.pasos.length > 0 && onProbar && (
          <button onClick={() => onProbar(Object.fromEntries(plan.pasos.map(p => [p.id_metrica, p.a])))}
                  className="mt-3 text-[11px] font-semibold px-3 py-2 bg-white text-[#111] hover:bg-white/80 transition-colors">
            Probar en la simulación unitaria
          </button>
        )}
        {!plan.alcanzable && (
          <p className="text-[11px] text-warn mt-2">Ni dejando atrás a todas en cada métrica se cumple el objetivo.</p>
        )}
      </section>
    </div>
  );
}
