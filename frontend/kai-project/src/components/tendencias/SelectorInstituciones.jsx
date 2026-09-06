import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { alpha } from "./paleta";

const normalizar = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Buscador + chips de instituciones. Compartido por las dos vistas de Tendencias.
// `max` es opcional: si viene null no hay tope de series (caso de Evolución).
export default function SelectorInstituciones({
  universidades,
  seleccionadas,
  setSeleccionadas,
  colorDe,
  max = null,
  notaTope,
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");

  const conTope = typeof max === "number";
  const graficadas = conTope ? seleccionadas.slice(0, max) : seleccionadas;

  const filas = useMemo(() => {
    if (!universidades) return [];
    const term = normalizar(q);
    return universidades
      .filter(u => !term
        || normalizar(u.nombre_universidad).includes(term)
        || normalizar(u.pais_universidad).includes(term))
      .slice(0, 120);
  }, [universidades, q]);

  const visiblesIds = useMemo(() => filas.map(u => u.id_universidad), [filas]);
  const todasVisiblesDentro = visiblesIds.every(id => seleccionadas.includes(id));

  const alternar = (id) => {
    const dentro = seleccionadas.includes(id);
    if (dentro) setSeleccionadas(seleccionadas.filter(x => x !== id));
    else if (!conTope || seleccionadas.length < max) setSeleccionadas([...seleccionadas, id]);
  };

  // Añade lo que se está viendo en el buscador respetando el tope, si lo hay.
  const agregarVisibles = () => {
    const nuevas = visiblesIds.filter(id => !seleccionadas.includes(id));
    const cupo = conTope ? Math.max(0, max - seleccionadas.length) : nuevas.length;
    setSeleccionadas([...seleccionadas, ...nuevas.slice(0, cupo)]);
  };

  const quitarVisibles = () =>
    setSeleccionadas(seleccionadas.filter(id => !visiblesIds.includes(id)));

  const btnMini =
    "font-body font-medium text-[9.5px] uppercase tracking-[.1em] px-2 py-1 border border-white/[.14] text-[#8a8a8a] hover:text-white hover:border-white/40 transition-colors disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:text-[#8a8a8a] disabled:hover:border-white/[.14]";

  return (
    <div className="mt-2 px-3.5 py-2.5 bg-panel border border-hairline flex items-center gap-2.5 flex-wrap relative z-20">
      <span className="font-mono text-[9px] uppercase tracking-[.14em] text-[#7f7f7f] flex-none">
        Instituciones
      </span>

      <div className="relative flex-none">
        <button
          onClick={() => setAbierto(v => !v)}
          className={`flex items-center gap-2 px-3 py-[7px] border border-dashed font-body font-semibold text-[11px] transition-colors ${
            abierto ? "bg-white/10 border-white text-white" : "border-white/[.16] text-[#c4c4c4] hover:text-white"
          }`}
        >
          + Buscar institución
          <span className="font-mono text-[9.5px] text-[#7f7f7f]">
            {conTope ? `${graficadas.length}/${max}` : graficadas.length}
          </span>
        </button>

        <AnimatePresence>
          {abierto && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute top-[calc(100%+7px)] left-0 w-[min(430px,calc(100vw-4rem))] bg-[#1a1a1a] border border-white/[.16] shadow-[0_18px_44px_rgba(0,0,0,.6)] p-[11px] z-40"
            >
              <input
                autoFocus
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar por nombre o país…"
                className="w-full bg-[#242424] border border-white/[.14] text-white font-body text-xs px-[11px] py-[9px] outline-none placeholder:text-[#6f6f6f]"
              />
              <div className="flex items-center justify-between gap-2 my-2 flex-wrap">
                <span className="font-mono text-[9.5px] text-[#7f7f7f]">
                  {seleccionadas.length} de {universidades?.length ?? 0}
                  {conTope ? ` · máx. ${max}` : " · sin tope"}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={agregarVisibles}
                    disabled={!filas.length || todasVisiblesDentro || (conTope && seleccionadas.length >= max)}
                    className={btnMini}
                    title="Añadir todas las instituciones que muestra el buscador"
                  >
                    Añadir visibles
                  </button>
                  <button
                    onClick={quitarVisibles}
                    disabled={!visiblesIds.some(id => seleccionadas.includes(id))}
                    className={btnMini}
                    title="Quitar de la selección las que muestra el buscador"
                  >
                    Quitar visibles
                  </button>
                  <button
                    onClick={() => setSeleccionadas([])}
                    disabled={!seleccionadas.length}
                    className={btnMini}
                  >
                    Limpiar todo
                  </button>
                </div>
              </div>
              <div className="max-h-[268px] overflow-y-auto flex flex-col gap-px">
                {filas.map(u => {
                  const on = seleccionadas.includes(u.id_universidad);
                  const lleno = !on && conTope && seleccionadas.length >= max;
                  return (
                    <button
                      key={u.id_universidad}
                      onClick={() => alternar(u.id_universidad)}
                      disabled={lleno}
                      className={`flex items-center gap-2.5 w-full text-left px-2.5 py-[7px] transition-colors ${
                        on ? "bg-white/[.06]" : "hover:bg-white/[.09]"
                      } ${lleno ? "cursor-not-allowed" : ""}`}
                    >
                      <span
                        className="w-[13px] h-[13px] flex-none border flex items-center justify-center font-body font-bold text-[9px] text-[#111]"
                        style={{
                          background: on ? "#fff" : "transparent",
                          borderColor: on ? "#fff" : "rgba(255,255,255,.28)",
                        }}
                      >
                        {on ? "✓" : ""}
                      </span>
                      <span className={`font-body text-[11.5px] flex-1 truncate ${
                        lleno ? "text-[#5f5f5f]" : on ? "text-white" : "text-[#c4c4c4]"
                      }`}>
                        {u.nombre_universidad}
                      </span>
                      <span className="font-mono text-[9.5px] text-[#6f6f6f] flex-none">
                        {u.pais_universidad || ""}
                      </span>
                    </button>
                  );
                })}
                {filas.length === 0 && (
                  <div className="p-4 text-center font-body text-[11px] text-[#6f6f6f]">Sin resultados</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-[5px] flex-wrap flex-1 min-w-0">
        <AnimatePresence initial={false}>
          {graficadas.map(id => {
            const u = universidades?.find(x => x.id_universidad === id);
            const color = colorDe(id);
            return (
              <motion.span
                key={id}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                title={u?.nombre_universidad}
                className="flex items-center gap-1.5 pl-[9px] pr-1.5 py-[5px] border"
                style={{ background: alpha(color, ".12"), borderColor: alpha(color, ".45") }}
              >
                <span className="w-2 h-2 flex-none" style={{ background: color }} />
                <span className="font-body font-semibold text-[10.5px] text-[#e6e6e6] max-w-[150px] truncate">
                  {u?.nombre_universidad || id}
                </span>
                <button
                  onClick={() => setSeleccionadas(seleccionadas.filter(x => x !== id))}
                  title="Quitar"
                  className="w-3.5 h-3.5 flex items-center justify-center font-body font-semibold text-[11px] text-[#8a8a8a] hover:text-white transition-colors"
                >
                  ×
                </button>
              </motion.span>
            );
          })}
        </AnimatePresence>
        {graficadas.length === 0 && (
          <span className="font-body text-[11px] text-[#6f6f6f]">Sin instituciones seleccionadas.</span>
        )}
      </div>

      {seleccionadas.length > 0 && (
        <button
          onClick={() => setSeleccionadas([])}
          className="flex-none font-body font-semibold text-[9.5px] uppercase tracking-[.1em] px-2.5 py-[6px] border border-white/[.16] text-[#9a9a9a] hover:bg-white hover:text-[#111] hover:border-white transition-colors"
          title="Quitar todas las instituciones seleccionadas"
        >
          Limpiar ({seleccionadas.length})
        </button>
      )}

      {notaTope && (
        <span className="font-body text-[10px] text-warn flex-none">{notaTope}</span>
      )}
    </div>
  );
}
