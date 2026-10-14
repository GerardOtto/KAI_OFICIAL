import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRankingsPermitidos, ETIQUETA_RESERVADO } from "../hooks/useRankingsPermitidos";
import { useAnios } from "../hooks/useAnios";
import { useUniversidades } from "../hooks/useUniversidades";
import { useMetricas } from "../hooks/useMetricas";
import { useRankingResumen } from "../hooks/useRankingResumen";
import { rutaSimulacion, transformarSimulacion, NOMBRE_SIMULACION } from "../hooks/useSimulacion";
import { otroModo, precargar } from "../hooks/cache";
import { useAuth } from "../auth/AuthContext";
import SelectorUniversidad from "../components/SelectorUniversidad";
import SimulacionUnitaria from "../components/simulacion/SimulacionUnitaria";
import SimulacionComparada from "../components/simulacion/SimulacionComparada";
import AgenteIA from "../components/simulacion/AgenteIA";
import SimulacionUnitariaCifras from "../components/simulacion/SimulacionUnitariaCifras";
import SimulacionComparadaCifras from "../components/simulacion/SimulacionComparadaCifras";
import AvisoModo from "../components/data/AvisoModo";
import { useModoValores } from "../estado/ModoValores";
import { idDeInstitucion } from "../utils/universidades";

// Mismo selector que las vistas de Tendencias. El modo vive en la URL
// (/simulacion/:modo), así que sigue siendo direccionable por enlace.
const MODOS = [
  { modo: "unitaria", label: "Unitaria", sub: "una institución · sliders" },
  { modo: "comparada", label: "Comparada", sub: "varias instituciones · matriz" },
];

// Comparada arranca con la institución de la cuenta y las primeras del ranking.
const COMPARADAS_INICIALES = 4;

const claseControl =
  "bg-[#1c1c1c] border border-white/[.14] text-[#cfcfcf] text-[11px] py-2 px-3 focus:outline-none focus:border-white/40";

export default function Simulacion() {
  const { modo: modoParam } = useParams();
  const navigate = useNavigate();
  const modo = MODOS.some(m => m.modo === modoParam) ? modoParam : "comparada";

  // Igual que en Tendencias: la elección inicial la fija el catálogo.
  const [rankingId, setRankingId] = useState(null);
  // Lo que eligió el usuario; null = lo que corresponda por defecto.
  const [anio, setAnio] = useState(null);
  const [disciplina, setDisciplina] = useState(null);
  // `undefined` = sin tocar: la institución de la cuenta (y, en Comparada, las
  // primeras del ranking). Lo elegido se conserva al cambiar de ranking: antes
  // se borraba y había que volver a buscar cada institución.
  const [unitariaElegida, setUnitariaElegida] = useState(undefined);
  const [comparadasElegidas, setComparadasElegidas] = useState(undefined);

  const { rankings } = useRankingsPermitidos(rankingId, setRankingId);
  const { usuario } = useAuth();

  // Switch global. En «Valores» se simula sobre la cifra real solo donde el
  // puntaje es su percentil (Ranking KAI, Scimago); en los demás rankings se
  // simula con puntajes y el aviso explica por qué.
  const { numerico: pidioNumerico } = useModoValores();
  const rankingSel = rankings.find(r => r.id_ranking === rankingId);
  const enCifras = pidioNumerico && Boolean(rankingSel?.tiene_valores_reales)
    && rankingSel?.normalizacion === "percentil";
  const aviso = !pidioNumerico || !rankingSel ? null
    : !rankingSel.tiene_valores_reales ? "sinValores"
    : rankingSel.normalizacion !== "percentil" ? "noSimulable" : null;

  const anios = useAnios(rankingId, enCifras ? "numerico" : "puntajes");
  // El año elegido si este ranking lo tiene; si no, su edición más reciente. Se
  // resuelve aquí y no en un efecto: el efecto corría con los años del ranking
  // anterior y dejaba, por ejemplo, el Ranking KAI en 2023 en vez de 2025.
  const anioActivo = anios.length ? (anio && anios.includes(anio) ? anio : anios[0]) : null;
  const { universidades } = useUniversidades();
  const metricasRanking = useMetricas(rankingId);

  const disciplinas = useMemo(
    () => [...new Set(metricasRanking.map(m => m.disciplina).filter(d => d && d !== "General"))].sort(),
    [metricasRanking]
  );
  // Un ranking multidisciplinario se simula disciplina por disciplina: cada una
  // reparte sus propios pesos al 100 %, y la opción «Todas» sumaba esos totales en
  // uno que no corresponde a ninguna clasificación.
  const disciplinaActiva = disciplinas.length
    ? (disciplina && disciplinas.includes(disciplina) ? disciplina : disciplinas[0])
    : null;

  // Quiénes figuran en lo que se está viendo: el selector lo marca y la página
  // avisa por las elegidas que no aparecen.
  const resumen = useRankingResumen(rankingId, anioActivo, disciplinaActiva);
  const conDatos = useMemo(
    () => (resumen.loading || !anioActivo ? null : new Set(resumen.data.map(u => u.id_universidad))),
    [resumen.loading, resumen.data, anioActivo]
  );

  const propia = useMemo(
    () => idDeInstitucion(usuario?.institucion, universidades),
    [usuario, universidades]
  );
  const institucionUnitaria = unitariaElegida === undefined ? propia : unitariaElegida;
  const institucionesComparada = useMemo(() => {
    if (comparadasElegidas !== undefined) return comparadasElegidas;
    const primeras = resumen.data.map(u => u.id_universidad);
    return [...new Set([propia, ...primeras].filter(Boolean))].slice(0, COMPARADAS_INICIALES);
  }, [comparadasElegidas, propia, resumen.data]);

  const rankingNombre = rankingSel?.nombre_ranking || "";
  const nombreDe = (id) => universidades?.find(u => u.id_universidad === id)?.nombre_universidad;
  const nombreUnitaria = nombreDe(institucionUnitaria);

  const elegidasAhora = modo === "unitaria"
    ? (institucionUnitaria ? [institucionUnitaria] : [])
    : institucionesComparada;
  const faltantes = conDatos ? elegidasAhora.filter(id => !conDatos.has(id)) : [];
  const dondeSeVe = [rankingNombre, disciplinaActiva, anioActivo].filter(Boolean).join(" · ");

  // El otro modo, ya pedido: en los rankings que se simulan sobre la cifra
  // (Ranking KAI, Scimago) alternar Puntajes y Valores cambia de vista, y la
  // nueva no debe esperar al servidor. La de cifras usa todas las universidades
  // del año; la de puntajes, las elegidas.
  const puedeCifras = Boolean(rankingSel?.tiene_valores_reales) && rankingSel?.normalizacion === "percentil";
  const modoOtro = otroModo(enCifras ? "numerico" : "puntajes");
  const aniosOtro = useAnios(puedeCifras ? rankingId : null, modoOtro);
  const anioOtro = aniosOtro.length ? (anio && aniosOtro.includes(anio) ? anio : aniosOtro[0]) : null;
  useEffect(() => {
    if (!puedeCifras || !anioOtro) return;
    const elegidas = modo === "unitaria" ? (institucionUnitaria ? [institucionUnitaria] : []) : institucionesComparada;
    if (modoOtro === "puntajes" && !elegidas.length) return;
    precargar(rutaSimulacion(rankingId, anioOtro, modoOtro === "numerico" ? [] : elegidas, modoOtro),
      transformarSimulacion, NOMBRE_SIMULACION);
  }, [puedeCifras, anioOtro, modoOtro, modo, institucionUnitaria, institucionesComparada, rankingId]);

  const handleRankingChange = (id) => {
    setRankingId(id);
    setAnio(null);
    setDisciplina(null);
  };

  return (
    <div className="min-h-screen bg-background text-white">
      <main className="max-w-[1600px] mx-auto px-8 pt-[22px] pb-10">

        {/* Título */}
        <section className="mb-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-outlineSoft mb-2">
            Simulación · {rankingNombre}{disciplinaActiva ? ` · ${disciplinaActiva}` : ""} · {anioActivo ?? "—"} · modo {modo}{enCifras ? " · cifras medidas" : ""}
          </p>
          <h2 className="font-headline text-[28px] font-semibold text-white tracking-[-0.01em]">
            Simulación de escenarios
          </h2>
        </section>

        {/* Pestañas de modo */}
        <div className="flex gap-2 pt-[18px]">
          {MODOS.map(m => {
            const activa = modo === m.modo;
            return (
              <button
                key={m.modo}
                onClick={() => navigate(`/simulacion/${m.modo}`)}
                className={`text-left px-3.5 py-[9px] border transition-colors ${
                  activa ? "bg-white border-white" : "border-white/[.14] hover:border-white/40"
                }`}
              >
                <div className={`font-body font-semibold text-[12px] ${activa ? "text-[#111]" : "text-[#9a9a9a]"}`}>
                  {m.label}
                </div>
                <div className={`font-body text-[10px] mt-0.5 ${activa ? "text-black/50" : "text-[#6f6f6f]"}`}>
                  {m.sub}
                </div>
              </button>
            );
          })}
        </div>

        {/* Controles: ranking / año / disciplina / instituciones */}
        <div className="flex items-end gap-3 flex-wrap py-4 mb-2 border-b border-white/[.08]">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#7a7a7a] mb-1.5">Ranking</p>
            <select
              value={rankingId ?? ""}
              onChange={e => handleRankingChange(Number(e.target.value))}
              className={claseControl}
            >
              {rankings.map(r => (
                <option key={r.id_ranking} value={r.id_ranking} disabled={r.restringido}>
                  {r.nombre_ranking}{r.restringido ? ETIQUETA_RESERVADO : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#7a7a7a] mb-1.5">Año</p>
            <select
              value={anioActivo || ""}
              onChange={e => setAnio(Number(e.target.value))}
              className={claseControl}
            >
              {anios.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {disciplinas.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#7a7a7a] mb-1.5">Disciplina</p>
              <select
                value={disciplinaActiva || ""}
                onChange={e => setDisciplina(e.target.value)}
                className={`${claseControl} max-w-[260px]`}
              >
                {disciplinas.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#7a7a7a] mb-1.5">
              {modo === "unitaria" ? "Institución" : `Instituciones (${institucionesComparada.length})`}
            </p>
            <SelectorUniversidad
              universidades={universidades}
              multiple={modo === "comparada"}
              valor={modo === "unitaria" ? institucionUnitaria : institucionesComparada}
              onCambio={modo === "unitaria" ? setUnitariaElegida : setComparadasElegidas}
              idPropia={propia}
              conDatos={conDatos}
              placeholder="Seleccionar..."
              claseBoton={`${claseControl} min-w-[240px] max-w-[340px] text-left flex items-center justify-between gap-3 hover:border-white/30 transition-colors`}
            />
          </div>
        </div>

        {aviso && <AvisoModo tipo={aviso} ranking={rankingNombre} />}

        {faltantes.length > 0 && (
          <p className="mb-3 text-[11.5px] leading-relaxed text-warn">
            {modo === "unitaria"
              ? `${nombreDe(faltantes[0]) || "La institución elegida"} no figura en ${dondeSeVe}. Elige otra institución o cambia de ranking, de año o de disciplina.`
              : `No figuran en ${dondeSeVe}: ${faltantes.map(id => nombreDe(id) || id).join(", ")}. Se comparan las demás.`}
          </p>
        )}

        {/* Cuerpo por modo */}
        {enCifras ? (
          modo === "unitaria" ? (
            <SimulacionUnitariaCifras
              key={`${rankingId}-${anioActivo}-${institucionUnitaria}`}
              rankingId={rankingId}
              anio={anioActivo}
              rankingNombre={rankingNombre}
              universidadId={institucionUnitaria}
            />
          ) : (
            <SimulacionComparadaCifras
              key={`${rankingId}-${anioActivo}`}
              rankingId={rankingId}
              anio={anioActivo}
              rankingNombre={rankingNombre}
              selectedUniversidades={institucionesComparada}
            />
          )
        ) : modo === "unitaria" ? (
          <SimulacionUnitaria
            rankingId={rankingId}
            anio={anioActivo}
            rankingNombre={rankingNombre}
            universidadId={institucionUnitaria}
            disciplinaFiltro={disciplinaActiva}
          />
        ) : (
          <SimulacionComparada
            rankingId={rankingId}
            anio={anioActivo}
            rankingNombre={rankingNombre}
            selectedUniversidades={institucionesComparada}
            disciplinaFiltro={disciplinaActiva}
          />
        )}
      </main>

      <AgenteIA
        rankingNombre={rankingNombre}
        anio={anioActivo}
        disciplina={disciplinaActiva}
        institucion={modo === "unitaria" ? nombreUnitaria : nombreDe(propia)}
      />
    </div>
  );
}
