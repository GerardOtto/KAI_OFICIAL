import { useEffect, useRef, useState } from "react";
import { useGrupos } from "../hooks/useGrupos";

/** Grupos de comparación guardados: elegir uno reemplaza la selección; la
 *  selección actual se puede guardar con un nombre. `max` respeta el tope de
 *  instituciones de la vista (la comparación anual grafica hasta 24). */
export default function GruposGuardados({ seleccionadas, onAplicar, max = null, clase = "" }) {
  const { grupos, guardar, eliminar, error } = useGrupos();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [guardado, setGuardado] = useState("");
  const caja = useRef(null);

  // Se cierra al hacer clic fuera.
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const enviar = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || !seleccionadas.length) return;
    if (await guardar(nombre.trim(), seleccionadas)) {
      setGuardado(nombre.trim());
      setNombre("");
    }
  };

  const btnMini = "font-body font-medium text-[9.5px] uppercase tracking-[.1em] px-2 py-1 border border-white/[.14] text-[#8a8a8a] hover:text-white hover:border-white/40 transition-colors disabled:opacity-35 disabled:cursor-not-allowed";

  return (
    <div ref={caja} className={`relative flex-none ${clase}`} data-grupos>
      <button
        onClick={() => { setAbierto(v => !v); setGuardado(""); }}
        className={`flex items-center gap-2 px-3 py-[7px] border font-body font-semibold text-[11px] transition-colors ${
          abierto ? "bg-white/10 border-white text-white" : "border-white/[.16] text-[#c4c4c4] hover:text-white"
        }`}
        title="Grupos de instituciones guardados en tu cuenta"
      >
        Grupos
        <span className="font-mono text-[9.5px] text-[#7f7f7f]">{grupos.length}</span>
      </button>

      {abierto && (
        <div className="absolute top-[calc(100%+7px)] left-0 w-[min(340px,calc(100vw-4rem))] bg-[#1a1a1a] border border-white/[.16] shadow-[0_18px_44px_rgba(0,0,0,.6)] p-[11px] z-40">
          {grupos.length === 0 ? (
            <p className="font-body text-[11px] text-[#7f7f7f] mb-2">
              Aún no guardas grupos. Elige instituciones y guárdalas con un nombre para volver a usarlas.
            </p>
          ) : (
            <div className="flex flex-col gap-px mb-2 max-h-[220px] overflow-y-auto">
              {grupos.map(g => (
                <div key={g.id_grupo} className="flex items-center gap-2 hover:bg-white/[.07]">
                  <button
                    onClick={() => { onAplicar(max ? g.universidades.slice(0, max) : g.universidades); setAbierto(false); }}
                    className="flex-1 text-left px-2.5 py-[7px] font-body text-[11.5px] text-[#dcdcdc] truncate"
                    title={max && g.universidades.length > max ? `Esta vista muestra hasta ${max}` : undefined}
                  >
                    {g.nombre}
                    <span className="ml-2 font-mono text-[9.5px] text-[#6f6f6f]">{g.universidades.length}</span>
                  </button>
                  <button
                    onClick={() => eliminar(g.id_grupo)}
                    className="px-2 font-body text-[12px] text-[#7f7f7f] hover:text-white"
                    title={`Borrar «${g.nombre}»`}
                    aria-label={`Borrar el grupo ${g.nombre}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={enviar} className="flex gap-1.5 pt-2 border-t border-white/[.08]">
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              maxLength={60}
              placeholder={`Guardar estas ${seleccionadas.length} como…`}
              className="flex-1 min-w-0 bg-[#242424] border border-white/[.14] text-white font-body text-xs px-2.5 py-[7px] outline-none placeholder:text-[#6f6f6f]"
            />
            <button type="submit" disabled={!nombre.trim() || !seleccionadas.length} className={btnMini}>
              Guardar
            </button>
          </form>
          {guardado && <p className="mt-1.5 font-body text-[10.5px] text-positive">Guardado «{guardado}».</p>}
          {error && <p role="alert" className="mt-1.5 font-body text-[10.5px] text-negative">{error}</p>}
        </div>
      )}
    </div>
  );
}
