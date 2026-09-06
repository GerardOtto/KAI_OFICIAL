import { useState, useEffect, useMemo } from "react";
import { useCientificos } from "../hooks/useCientificos";
import UniversidadLogo from "../components/UniversidadLogo";
import BuscadorAutocomplete from "../components/cientificos/BuscadorAutocomplete";

const FUENTE_SCOPUS_PUCV = "Scopus - Censo institucional PUCV";
const LOTE = 20;
const H_MAX = 60;

const PlaceholderIcon = () => (
  <div className="w-11 h-11 bg-white/[.08] flex items-center justify-center shrink-0">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-outlineSoft">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  </div>
);

const Chip = ({ etiqueta, valor, onQuitar }) => (
  <span className="flex items-center gap-2 pl-2.5 pr-1.5 py-[6px] bg-white/[.06] border border-white/[.14] max-w-full">
    <span className="font-mono text-[9px] uppercase tracking-[.14em] text-[#7f7f7f] flex-none">{etiqueta}</span>
    <span className="font-body text-[11.5px] text-[#e6e6e6] truncate max-w-[420px]">{valor}</span>
    <button
      onClick={onQuitar}
      title={`Quitar filtro por ${etiqueta.toLowerCase()}`}
      className="w-4 h-4 flex items-center justify-center text-[13px] text-[#8a8a8a] hover:text-white transition-colors flex-none"
    >
      ×
    </button>
  </span>
);

export default function InvestigadoresPUCV() {
  // `texto` es solo lo que hay escrito en la barra: alimenta el autocompletado y
  // nada más. El listado depende exclusivamente de los filtros aplicados, que se
  // fijan al elegir una sugerencia o al pulsar Enter, nunca al teclear.
  const [texto, setTexto] = useState("");
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroArea, setFiltroArea] = useState("");
  const [cursor, setCursor] = useState(LOTE);

  const { data, loading } = useCientificos({
    fuente: FUENTE_SCOPUS_PUCV,
    q: filtroNombre,
    topico: filtroArea,
  });

  const aplicarNombre = (nombre) => {
    setTexto(nombre);
    setFiltroNombre(nombre);
    setFiltroArea("");
  };

  const aplicarArea = (area) => {
    setTexto("");
    setFiltroNombre("");
    setFiltroArea(area);
  };

  const limpiarFiltros = () => { setTexto(""); setFiltroNombre(""); setFiltroArea(""); };

  useEffect(() => { setCursor(LOTE); }, [filtroNombre, filtroArea]);

  const visibles = useMemo(() => data.slice(0, cursor), [data, cursor]);
  const hayMas = cursor < data.length;

  return (
    <div className="min-h-screen bg-background text-white">
      <main className="max-w-[1600px] mx-auto px-8 pt-[26px] pb-20">

        {/* Cabecera */}
        <section className="flex items-end justify-between gap-4 flex-wrap mb-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-outlineSoft mb-2">
              Scopus · Censo institucional PUCV · {data.length.toLocaleString("es-CL")} investigadores
            </p>
            <h2 className="font-headline text-[28px] font-semibold text-white tracking-[-0.01em]">
              Investigadores
            </h2>
          </div>
          <BuscadorAutocomplete
            className="w-[340px] max-w-full"
            fuente={FUENTE_SCOPUS_PUCV}
            valor={texto}
            onCambio={setTexto}
            placeholder="Buscar investigador o área…"
            onElegirInvestigador={aplicarNombre}
            onElegirTopico={aplicarArea}
            onEnviar={aplicarNombre}
          />
        </section>

        {/* Filtros aplicados. Como teclear ya no altera el listado, los chips son
            la única señal de qué está filtrando: se muestran ambos, incluido el
            nombre, porque la barra puede tener texto distinto al filtro vigente. */}
        {(filtroNombre || filtroArea) && (
          <div className="mb-6 flex items-center gap-2 flex-wrap">
            {filtroNombre && (
              <Chip etiqueta="Nombre" valor={filtroNombre} onQuitar={() => setFiltroNombre("")} />
            )}
            {filtroArea && (
              <Chip etiqueta="Área" valor={filtroArea} onQuitar={() => setFiltroArea("")} />
            )}
            <button
              onClick={limpiarFiltros}
              className="text-[10px] uppercase tracking-wider px-3 py-2 bg-white/[.04] border border-white/[.12] text-[#c4c4c4] hover:text-white transition-colors"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">Cargando...</div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <span className="text-outlineSoft text-sm">No se encontraron investigadores con esos filtros.</span>
            <button
              onClick={limpiarFiltros}
              className="text-[10px] uppercase tracking-wider px-3 py-2 bg-white/[.04] border border-white/[.12] text-[#c4c4c4] hover:text-white transition-colors"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <>
            <div>
              {visibles.map((c) => (
                <div
                  key={c.id_cientifico}
                  className="grid items-center gap-5 py-4 border-t border-white/[.07]"
                  style={{ gridTemplateColumns: "1fr 96px 90px 320px" }}
                >
                  {/* Nombre + afiliación */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    {c.id_universidad ? (
                      <UniversidadLogo idUniversidad={c.id_universidad} nombre={c.nombre_universidad} size={44} fallback={<PlaceholderIcon />} />
                    ) : (
                      <PlaceholderIcon />
                    )}
                    <div className="min-w-0">
                      <div className="font-body font-semibold text-[15px] text-white truncate">{c.nombre_cientifico}</div>
                      <div className="text-[11.5px] text-[#7f7f7f] truncate">
                        {c.institucion_original || c.nombre_universidad}
                        {c.citas_totales != null && ` · ${Number(c.citas_totales).toLocaleString("es-CL")} citas`}
                      </div>
                    </div>
                  </div>

                  {/* Índice H */}
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#7a7a7a] mb-1">Índice H</div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-[19px] text-white tabular-nums">{c.h_index ?? "—"}</span>
                      <div className="w-[34px] h-[5px] bg-white/[.08]">
                        <div className="h-full bg-accent" style={{ width: `${Math.min(100, ((c.h_index || 0) / H_MAX) * 100)}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Documentos (total; el desglose por año queda pendiente de datos) */}
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#7a7a7a] mb-1">Docs.</div>
                    <span className="font-mono font-semibold text-[15px] text-white tabular-nums">
                      {c.num_articulos?.toLocaleString("es-CL") ?? "—"}
                    </span>
                  </div>

                  {/* Topics */}
                  <div className="flex flex-wrap gap-1.5">
                    {(c.topics_top3 || []).map((t, i) => (
                      <span key={i} className="rounded-full px-[9px] py-1 text-[10.5px] bg-white/[.05] border border-white/[.1] text-[#c4c4c4]">
                        {t.topico}
                        {t.autor_documentos != null && <span className="text-[#6f6f6f]"> {t.autor_documentos}</span>}
                      </span>
                    ))}
                    {c.topics_total > 3 && (
                      <span className="rounded-full px-[9px] py-1 text-[10.5px] text-[#6f6f6f]">
                        +{c.topics_total - 3}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {hayMas && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => setCursor(c => c + LOTE)}
                  className="px-6 py-2.5 border border-outline/40 text-[11px] uppercase tracking-widest text-white hover:bg-white hover:text-black transition-all"
                >
                  Cargar más ({data.length - cursor} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
