import { useEffect, useMemo, useRef, useState } from "react";
import { useSugerenciasCientificos } from "../../hooks/useSugerenciasCientificos";

// Resalta el trozo que coincide con lo tecleado, para que se vea por qué aparece
// cada sugerencia. Se compara sin tildes para que "Munoz" encuentre "Muñoz".
const sinTildes = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function Resaltado({ texto, termino }) {
  const i = termino ? sinTildes(texto).indexOf(sinTildes(termino)) : -1;
  if (i < 0) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, i)}
      <mark className="bg-transparent text-white font-semibold">{texto.slice(i, i + termino.length)}</mark>
      {texto.slice(i + termino.length)}
    </>
  );
}

export default function BuscadorAutocomplete({
  fuente,
  valor,
  onCambio,
  onElegirInvestigador,
  onElegirTopico,
  onEnviar,
  placeholder = "Buscar investigador o área…",
  className = "",
}) {
  const [abierto, setAbierto] = useState(false);
  const [indice, setIndice] = useState(-1);
  const contenedorRef = useRef(null);
  const listaRef = useRef(null);

  const { sugerencias, cargando } = useSugerenciasCientificos(fuente, valor, { activo: abierto });

  // Se aplana en una sola lista para que el teclado recorra ambos grupos seguidos.
  const opciones = useMemo(() => [
    ...sugerencias.investigadores.map(i => ({
      clave: `inv-${i.id_cientifico}`,
      grupo: "investigador",
      etiqueta: i.nombre_cientifico,
      detalle: [
        i.h_index != null ? `índice H ${i.h_index}` : null,
        i.num_articulos != null ? `${i.num_articulos} docs` : null,
      ].filter(Boolean).join(" · "),
    })),
    ...sugerencias.topicos.map(t => ({
      clave: `top-${t.topico}`,
      grupo: "topico",
      etiqueta: t.topico,
      detalle: `${t.investigadores} investigador${t.investigadores === 1 ? "" : "es"}`,
    })),
  ], [sugerencias]);

  useEffect(() => { setIndice(-1); }, [opciones.length, valor]);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  // Mantiene visible la opción marcada al navegar con el teclado.
  useEffect(() => {
    if (indice < 0 || !listaRef.current) return;
    const el = listaRef.current.querySelector(`[data-idx="${indice}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [indice]);

  const elegir = (op) => {
    if (!op) return;
    if (op.grupo === "investigador") onElegirInvestigador?.(op.etiqueta);
    else onElegirTopico?.(op.etiqueta);
    setAbierto(false);
    setIndice(-1);
  };

  const enTeclado = (e) => {
    if (e.key === "Escape") { setAbierto(false); setIndice(-1); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      // Con una sugerencia marcada se aplica esa; si no, se aplica lo escrito tal
      // cual, para que se pueda filtrar por un nombre que no salga en la lista.
      if (abierto && indice >= 0) elegir(opciones[indice]);
      else if (valor.trim()) { onEnviar?.(valor.trim()); setAbierto(false); setIndice(-1); }
      return;
    }
    if (e.key === "Tab") { setAbierto(false); return; }
    if (!opciones.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault(); setAbierto(true);
      setIndice(i => (i + 1) % opciones.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault(); setAbierto(true);
      setIndice(i => (i <= 0 ? opciones.length - 1 : i - 1));
    }
  };

  const hayPanel = abierto && valor.trim().length >= 2;
  const activoId = indice >= 0 && opciones[indice] ? `sug-${opciones[indice].clave}` : undefined;

  let cursor = -1; // índice plano, para que el teclado y el ratón coincidan

  return (
    <div ref={contenedorRef} className={`relative ${className}`}>
      <input
        type="text"
        role="combobox"
        aria-expanded={hayPanel}
        aria-controls="sugerencias-investigadores"
        aria-autocomplete="list"
        aria-activedescendant={activoId}
        autoComplete="off"
        placeholder={placeholder}
        value={valor}
        onChange={e => { onCambio(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        onKeyDown={enTeclado}
        className="w-full bg-[#1c1c1c] border border-white/[.14] text-white text-xs px-3 py-2.5 outline-none focus:border-white/40"
      />

      {valor && (
        <button
          onClick={() => { onCambio(""); setAbierto(false); }}
          title="Borrar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-[#8a8a8a] hover:text-white transition-colors"
        >
          ×
        </button>
      )}

      {hayPanel && (
        <div
          id="sugerencias-investigadores"
          role="listbox"
          ref={listaRef}
          className="absolute top-[calc(100%+4px)] left-0 right-0 max-h-[340px] overflow-y-auto bg-[#1a1a1a] border border-white/[.16] shadow-[0_18px_44px_rgba(0,0,0,.6)] z-50"
        >
          {opciones.length === 0 ? (
            <div className="px-3 py-3 font-body text-[11px] text-[#6f6f6f]">
              {cargando ? "Buscando…" : "Sin coincidencias"}
            </div>
          ) : (
            ["investigador", "topico"].map(grupo => {
              const delGrupo = opciones.filter(o => o.grupo === grupo);
              if (!delGrupo.length) return null;
              return (
                <div key={grupo}>
                  <div className="px-3 pt-2.5 pb-1 font-mono text-[9px] uppercase tracking-[.14em] text-[#6f6f6f]">
                    {grupo === "investigador" ? "Investigadores" : "Áreas de investigación"}
                  </div>
                  {delGrupo.map(op => {
                    cursor += 1;
                    const idx = cursor;
                    const marcada = idx === indice;
                    return (
                      <button
                        key={op.clave}
                        id={`sug-${op.clave}`}
                        role="option"
                        aria-selected={marcada}
                        data-idx={idx}
                        onMouseEnter={() => setIndice(idx)}
                        onClick={() => elegir(op)}
                        className={`w-full text-left px-3 py-2 flex items-baseline gap-2 transition-colors ${
                          marcada ? "bg-white/[.09]" : "hover:bg-white/[.05]"
                        }`}
                      >
                        <span className="font-body text-[12px] text-[#dcdcdc] flex-1 min-w-0 leading-snug">
                          <Resaltado texto={op.etiqueta} termino={valor.trim()} />
                        </span>
                        <span className="font-mono text-[9.5px] text-[#6f6f6f] flex-none whitespace-nowrap">
                          {op.detalle}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}

          {/* El listado no se filtra al teclear, así que conviene decir cómo se aplica. */}
          <div className="sticky bottom-0 bg-[#1a1a1a] border-t border-white/[.08] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.12em] text-[#6f6f6f]">
            ↑↓ navegar · Enter aplicar · Esc cerrar
          </div>
        </div>
      )}
    </div>
  );
}
