import { useEffect, useMemo, useRef, useState } from "react";
import { normalizar } from "../utils/universidades";

/** Desplegable con buscador para elegir una institución, o varias.
 *
 *  Lo comparten el Glosario y Simulación, que tenían cada uno el suyo: los dos
 *  mostraban solo las 30 primeras coincidencias —la que se buscaba podía no
 *  aparecer sin escribir—, distinguían tildes al buscar y no se cerraban al hacer
 *  clic fuera.
 *
 *  `idPropia` marca la institución de la cuenta y la pone primera. `conDatos`, si
 *  viene, es el conjunto de las que tienen datos en lo que se está viendo: las
 *  demás se pueden elegir igual, pero van al final y lo dicen.
 */
export default function SelectorUniversidad({
  universidades, valor, onCambio, multiple = false, idPropia = null, conDatos = null,
  placeholder = "Seleccionar institución…", claseBoton = "", ancho = 320,
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const raiz = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false); };
    const tecla = (e) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  const seleccion = useMemo(
    () => (multiple ? valor || [] : valor != null ? [valor] : []),
    [multiple, valor]
  );

  // La propia primero; las que no tienen datos, al final. Dentro de cada grupo,
  // el orden alfabético que trae la lista.
  const filas = useMemo(() => {
    const termino = normalizar(q);
    const grupo = (u) =>
      u.id_universidad === idPropia ? 0 : conDatos && !conDatos.has(u.id_universidad) ? 2 : 1;
    return (universidades || [])
      .filter(u => !termino || normalizar(u.nombre_universidad).includes(termino))
      .map((u, i) => ({ u, i }))
      .sort((a, b) => grupo(a.u) - grupo(b.u) || a.i - b.i)
      .map(({ u }) => u);
  }, [universidades, q, idPropia, conDatos]);

  const elegir = (id) => {
    if (multiple) {
      onCambio(seleccion.includes(id) ? seleccion.filter(x => x !== id) : [...seleccion, id]);
      return;
    }
    onCambio(id);
    setAbierto(false);
    setQ("");
  };

  const nombre = (id) => universidades?.find(u => u.id_universidad === id)?.nombre_universidad;
  const texto = multiple
    ? seleccion.length === 0 ? placeholder
      : seleccion.length === 1 ? nombre(seleccion[0]) || "1 seleccionada"
      : `${seleccion.length} seleccionadas`
    : nombre(valor) || placeholder;

  return (
    <div ref={raiz} className="relative">
      <button type="button" onClick={() => setAbierto(v => !v)} aria-expanded={abierto} className={claseBoton}>
        <span className="truncate">{texto}</span>
        <span aria-hidden className="text-[8px] shrink-0 opacity-70">▾</span>
      </button>

      {abierto && (
        <div
          className="absolute top-full left-0 mt-1 z-40 bg-[#1a1a1a] border border-white/[.18] shadow-[0_12px_32px_rgba(0,0,0,.5)]"
          style={{ width: `min(${ancho}px, calc(100vw - 2rem))` }}
        >
          <div className="p-2 border-b border-white/[.1]">
            <input
              autoFocus
              type="text"
              placeholder="Buscar…"
              value={q}
              onChange={e => setQ(e.target.value)}
              className="w-full bg-transparent text-white text-xs px-2 py-1.5 outline-none placeholder:text-outlineSoft"
            />
          </div>
          <div className="max-h-64 overflow-y-auto" role="listbox" aria-multiselectable={multiple || undefined}>
            {filas.map(u => {
              const elegida = seleccion.includes(u.id_universidad);
              const sinDatos = Boolean(conDatos) && !conDatos.has(u.id_universidad);
              return (
                <button
                  type="button"
                  key={u.id_universidad}
                  role="option"
                  aria-selected={elegida}
                  onClick={() => elegir(u.id_universidad)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${
                    elegida ? "bg-white/[.08] text-white"
                    : sinDatos ? "text-[#6a6a6a] hover:text-[#bdbdbd] hover:bg-white/[.04]"
                    : "text-[#9a9a9a] hover:text-white hover:bg-white/[.04]"
                  }`}
                >
                  {multiple && (
                    <span
                      className="w-3 h-3 border flex-none flex items-center justify-center text-[8px] font-bold text-[#111]"
                      style={{ background: elegida ? "#fff" : "transparent", borderColor: elegida ? "#fff" : "rgba(255,255,255,.28)" }}
                    >
                      {elegida ? "✓" : ""}
                    </span>
                  )}
                  <span className="flex-1 min-w-0 truncate">{u.nombre_universidad}</span>
                  {u.id_universidad === idPropia && (
                    <span className="flex-none font-mono text-[8.5px] uppercase tracking-wider text-accent">tu institución</span>
                  )}
                  {sinDatos && (
                    <span className="flex-none font-mono text-[8.5px] uppercase tracking-wider">sin datos</span>
                  )}
                </button>
              );
            })}
            {filas.length === 0 && (
              <p className="px-3 py-4 text-center text-[11px] text-[#6f6f6f]">Sin resultados</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
