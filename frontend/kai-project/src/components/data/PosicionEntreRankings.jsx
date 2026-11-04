import { useEffect, useMemo, useState } from "react";
import { leer, pedir } from "../../hooks/cache";
import { comoLista } from "../../hooks/respuesta";

const NOMBRE = "posiciones-por-ranking";
const ruta = (id) => `/posiciones-por-ranking?universidad_id=${id}`;
const MAX_EDICIONES = 8;

/** El lugar de la institución entre las chilenas de cada ranking, edición por
 *  edición. Es lo comparable entre rankings: sus puntajes viven en escalas
 *  distintas, pero «3.ª de 31» se lee igual en todos. */
export default function PosicionEntreRankings({ universidadId, universidadNombre }) {
  const [estado, setEstado] = useState({ id: null, filas: [] });
  const enCache = universidadId ? leer(ruta(universidadId), NOMBRE) : undefined;

  useEffect(() => {
    if (!universidadId || leer(ruta(universidadId), NOMBRE) !== undefined) return undefined;
    let vigente = true;
    pedir(ruta(universidadId), comoLista, NOMBRE)
      .then(filas => vigente && setEstado({ id: universidadId, filas }))
      .catch(() => vigente && setEstado({ id: universidadId, filas: [] }));
    return () => { vigente = false; };
  }, [universidadId]);

  const filas = useMemo(
    () => enCache ?? (estado.id === universidadId ? estado.filas : []),
    [enCache, estado, universidadId]);
  const { rankings, anios } = useMemo(() => {
    const porRanking = new Map();
    filas.forEach(f => {
      const r = porRanking.get(f.id_ranking) || { id: f.id_ranking, nombre: f.nombre_ranking, ediciones: {} };
      r.ediciones[f.anio] = f;
      porRanking.set(f.id_ranking, r);
    });
    const todos = [...new Set(filas.map(f => f.anio))].sort((a, b) => a - b).slice(-MAX_EDICIONES);
    return { rankings: [...porRanking.values()], anios: todos };
  }, [filas]);

  if (!universidadId || !rankings.length) return null;

  return (
    <section className="mt-10" data-seccion="entre-rankings">
      <h3 className="font-headline text-[19px] font-semibold text-white mb-1">Su lugar en cada ranking</h3>
      <p className="text-xs text-[#8a8a8a] max-w-2xl leading-relaxed mb-4">
        Posición de {universidadNombre} entre las universidades chilenas de cada ranking, por edición. Los puntajes de
        cada ranking no se comparan entre sí; el lugar que ocupa entre las chilenas, sí. Más intenso, mejor ubicada; la
        flecha compara con la edición anterior del mismo ranking. Quedan fuera los rankings por disciplina.
      </p>
      <div className="overflow-x-auto">
        <div className="grid gap-1.5 min-w-[720px]"
             style={{ gridTemplateColumns: `180px repeat(${anios.length}, minmax(64px, 1fr))` }}>
          <div />
          {anios.map(a => (
            <div key={a} className="font-mono text-[10px] text-outlineSoft text-center py-1">{a}</div>
          ))}
          {rankings.map(r => {
            const propias = Object.keys(r.ediciones).map(Number).sort((a, b) => a - b);
            return [
              <div key={`${r.id}-n`} className="font-body font-semibold text-[12px] text-[#e6e6e6] flex items-center">
                {r.nombre}
              </div>,
              ...anios.map(a => {
                const e = r.ediciones[a];
                if (!e) return <div key={`${r.id}-${a}`} className="h-12 border border-white/[.05] bg-white/[.02]" />;
                const previa = propias.filter(x => x < a).pop();
                const antes = previa != null ? r.ediciones[previa].posicion : null;
                const cambio = antes != null ? antes - e.posicion : null;
                // Intensidad por percentil: la primera de 30 y la primera de 2 no son
                // lo mismo, y la escala lo respeta.
                const lugar = e.de > 1 ? 1 - (e.posicion - 1) / (e.de - 1) : 1;
                return (
                  <div key={`${r.id}-${a}`}
                       className="h-12 border border-white/[.08] flex flex-col items-center justify-center"
                       style={{ background: `oklch(0.72 0.13 250 / ${(0.06 + lugar * 0.42).toFixed(2)})` }}
                       title={`${r.nombre} ${a}: puesto ${e.posicion} de ${e.de} chilenas · total ${Number(e.total).toLocaleString("es-CL")}`}
                       data-celda-posicion>
                    <span className="font-mono font-semibold text-[14px] text-white leading-none">
                      {e.posicion}<span className="text-[10px] text-white/55">/{e.de}</span>
                    </span>
                    {cambio != null && cambio !== 0 && (
                      <span className={`font-mono text-[9.5px] ${cambio > 0 ? "text-positive" : "text-negative"}`}>
                        {cambio > 0 ? `▲${cambio}` : `▼${-cambio}`}
                      </span>
                    )}
                  </div>
                );
              }),
            ];
          })}
        </div>
      </div>
    </section>
  );
}
