import { useState, useMemo } from "react";
import { useCientificos } from "../hooks/useCientificos";
import UniversidadLogo from "../components/UniversidadLogo";

const FUENTE_TOP2 = "Stanford/Elsevier - World's Top 2% Scientists";

const PlaceholderIcon = () => (
  <div className="w-11 h-11 bg-white/[.08] flex items-center justify-center shrink-0">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-outlineSoft">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  </div>
);

export default function Cientificos() {
  const [search, setSearch] = useState("");
  const [campoActivo, setCampoActivo] = useState(null);

  const { data, loading } = useCientificos({ fuente: FUENTE_TOP2, q: search });

  const facetas = useMemo(() => {
    const counts = {};
    data.forEach(c => {
      if (c.campo_principal) counts[c.campo_principal] = (counts[c.campo_principal] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const visibles = useMemo(() => {
    if (!campoActivo) return data;
    return data.filter(c => c.campo_principal === campoActivo);
  }, [data, campoActivo]);

  return (
    <div className="min-h-screen bg-background text-white">
      <main className="max-w-[1600px] mx-auto px-8 pt-[26px] pb-20">

        {/* Cabecera */}
        <section className="flex items-end justify-between gap-4 flex-wrap mb-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-outlineSoft mb-2">
              Stanford / Elsevier · World's Top 2% Scientists · {data.length} investigadores en Chile
            </p>
            <h2 className="font-headline text-[28px] font-semibold text-white tracking-[-0.01em]">
              Top 2% Científicos Mundiales
            </h2>
            <p className="text-xs text-[#8a8a8a] max-w-2xl leading-relaxed mt-2">
              Investigadores chilenos incluidos en el índice-c de Ioannidis (Stanford), que combina citas totales,
              índice H, índice Hm y coautoría.
            </p>
          </div>
          <input
            type="text"
            placeholder="Nombre del investigador..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-[260px] bg-[#1c1c1c] border border-white/[.14] text-white text-xs px-3 py-2.5 outline-none focus:border-white/40"
          />
        </section>

        {/* Facetas por campo */}
        {facetas.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-6">
            <button
              onClick={() => setCampoActivo(null)}
              className={`px-[11px] py-1.5 text-[11px] transition-colors ${
                campoActivo === null ? "bg-white text-[#111]" : "bg-white/[.04] border border-white/[.12] text-[#c4c4c4] hover:text-white"
              }`}
            >
              Todos <span className="font-mono text-[10.5px] ml-1">{data.length}</span>
            </button>
            {facetas.map(([campo, count]) => (
              <button
                key={campo}
                onClick={() => setCampoActivo(campo)}
                className={`px-[11px] py-1.5 text-[11px] transition-colors ${
                  campoActivo === campo ? "bg-white text-[#111]" : "bg-white/[.04] border border-white/[.12] text-[#c4c4c4] hover:text-white"
                }`}
              >
                {campo} <span className="font-mono text-[10.5px] ml-1">{count}</span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">Cargando...</div>
        ) : visibles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <span className="text-outlineSoft text-sm">No se encontraron investigadores con esos filtros.</span>
            <button
              onClick={() => { setSearch(""); setCampoActivo(null); }}
              className="text-[10px] uppercase tracking-wider px-3 py-2 bg-white/[.04] border border-white/[.12] text-[#c4c4c4] hover:text-white transition-colors"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div>
            {visibles.map((c) => (
              <div
                key={c.id_cientifico}
                className="grid items-center gap-5 py-4 border-t border-white/[.07]"
                style={{ gridTemplateColumns: "1fr 96px 1fr" }}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {c.id_universidad ? (
                    <UniversidadLogo idUniversidad={c.id_universidad} nombre={c.nombre_universidad} size={44} fallback={<PlaceholderIcon />} />
                  ) : (
                    <PlaceholderIcon />
                  )}
                  <div className="min-w-0">
                    <div className="font-body font-semibold text-[15px] text-white truncate">{c.nombre_cientifico}</div>
                    <div className="text-[11.5px] text-[#7f7f7f] truncate">
                      {c.nombre_universidad || c.institucion_original}
                      {c.citas_totales != null && ` · ${Number(c.citas_totales).toLocaleString("es-CL")} citas`}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#7a7a7a] mb-1">Rank Global</div>
                  <span className="font-mono font-semibold text-[15px] text-white tabular-nums">
                    #{c.rank_global?.toLocaleString("es-CL") ?? "—"}
                  </span>
                </div>

                <div className="text-sm text-[#c4c4c4]">
                  {c.campo_principal}
                  {c.subcampo_principal && (
                    <span className="text-[#6f6f6f]"> · {c.subcampo_principal}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
