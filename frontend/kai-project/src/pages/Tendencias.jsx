import { useState, useMemo, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

import { useRankings } from "../hooks/useRankings";
import { useAnios } from "../hooks/useAnios";
import { useMetricas } from "../hooks/useMetricas";
import { useUniversidades } from "../hooks/useUniversidades";
import { useTendenciasComparacion } from "../hooks/useTendenciasComparacion";
import { useSeriesEvolucion } from "../hooks/useSeriesEvolucion";

import SelectorInstituciones from "../components/tendencias/SelectorInstituciones";
import VistaAnual from "../components/tendencias/VistaAnual";
import VistaEvolucion from "../components/tendencias/VistaEvolucion";
import { colorDeIndice, fmt } from "../components/tendencias/paleta";

// Dos vistas hermanas sobre los mismos selectores: cambia el eje X.
// `max: null` = sin tope de series.
const VISTAS = [
  { id: "anual", label: "Comparación anual", sub: "barras · un año, varias métricas", max: 24 },
  { id: "evolucion", label: "Evolución", sub: "líneas · serie histórica, sin tope", max: null },
];

const MAX_CHIPS_METRICA = 6;

// Ancho fijo con el que se renderiza la copia que va al PDF. Es independiente del
// tamaño de la ventana, así el informe sale siempre igual aunque el usuario esté
// con el navegador angosto y la vista en pantalla se haya apilado.
const ANCHO_PDF = 1400;

export default function Tendencias() {
  const [vista, setVista] = useState("anual");
  const [rankingId, setRankingId] = useState(1);
  const [disciplina, setDisciplina] = useState(null);
  const [anio, setAnio] = useState(null);
  const [metricaId, setMetricaId] = useState(null);
  const [metricasSel, setMetricasSel] = useState([]);
  const [universidadesSel, setUniversidadesSel] = useState([]);
  const [proyeccion, setProyeccion] = useState(true);
  const [anosProyeccion, setAnosProyeccion] = useState(3);
  const [pdfEstado, setPdfEstado] = useState("idle"); // idle | generando | listo | error
  const [exportando, setExportando] = useState(false);

  const impresionRef = useRef(null);

  const rankings = useRankings();
  const anios = useAnios(rankingId);
  const metricas = useMetricas(rankingId);
  const { universidades } = useUniversidades();

  const esAnual = vista === "anual";
  const maxSeries = VISTAS.find(v => v.id === vista).max;
  const rankingNombre = rankings.find(r => r.id_ranking === rankingId)?.nombre_ranking || "";

  const disciplinas = useMemo(
    () => [...new Set(metricas.map(m => m.disciplina).filter(d => d && d !== "General"))].sort(),
    [metricas]
  );

  // Se resuelven contra los datos ya cargados en lugar de esperar al efecto, para
  // que cambiar de ranking no deje un frame sin disciplina ni año válidos.
  const disciplinaActiva = disciplinas.length
    ? (disciplina && disciplinas.includes(disciplina) ? disciplina : disciplinas[0])
    : null;
  const anioActivo = anios.length
    ? (anio && anios.includes(anio) ? anio : anios[0])
    : null;

  // Las métricas disponibles dependen de la disciplina elegida (Shanghai GRAS y
  // QS por Disciplina traen cientos de métricas repartidas por área).
  const metricasDisponibles = useMemo(() => {
    if (!disciplinaActiva) return metricas;
    return metricas.filter(m => m.disciplina === disciplinaActiva);
  }, [metricas, disciplinaActiva]);

  // --- defaults reactivos ---
  useEffect(() => {
    if (disciplinaActiva !== disciplina) setDisciplina(disciplinaActiva);
  }, [disciplinaActiva, disciplina]);

  useEffect(() => {
    if (anioActivo !== anio) setAnio(anioActivo);
  }, [anioActivo, anio]);

  useEffect(() => {
    if (!metricasDisponibles.length) return;
    const ids = metricasDisponibles.map(m => m.id_metrica);
    if (!metricaId || !ids.includes(metricaId)) setMetricaId(ids[0]);
    setMetricasSel(prev => {
      const validas = prev.filter(id => ids.includes(id));
      return validas.length ? validas : ids.slice(0, Math.min(4, ids.length));
    });
  }, [metricasDisponibles, metricaId]);

  // Solo la primera carga siembra instituciones; si no, "Limpiar" se repoblaría solo.
  const sembradoRef = useRef(false);
  useEffect(() => {
    if (sembradoRef.current || !universidades?.length) return;
    sembradoRef.current = true;
    setUniversidadesSel(universidades.slice(0, 6).map(u => u.id_universidad));
  }, [universidades]);

  const graficadas = useMemo(
    () => (typeof maxSeries === "number" ? universidadesSel.slice(0, maxSeries) : universidadesSel),
    [universidadesSel, maxSeries]
  );

  const colorDe = useMemo(() => {
    const mapa = {};
    graficadas.forEach((id, i) => { mapa[id] = colorDeIndice(i); });
    return (id) => mapa[id] || "#8a8a8a";
  }, [graficadas]);

  const metricaActual = metricasDisponibles.find(m => m.id_metrica === metricaId);

  // --- datos ---
  const { filas: filasAnual } = useTendenciasComparacion(
    esAnual ? rankingId : null, anioActivo, metricasSel, graficadas
  );
  const { filas: filasEvol } = useSeriesEvolucion(
    esAnual ? null : rankingId, metricaId, graficadas
  );

  const techoActual = filasAnual.length ? Number(filasAnual[0].techo) : null;

  // --- exportación (se conserva del gráfico anterior, adaptada a la vista activa) ---
  const nombreUni = (id) =>
    universidades?.find(u => u.id_universidad === id)?.nombre_universidad || String(id);

  const filasExport = useMemo(() => {
    if (esAnual) {
      return filasAnual.map(f => ({
        Ranking: rankingNombre,
        Año: anioActivo,
        Métrica: f.nombre_metrica,
        Peso: f.peso_metrica,
        Universidad: f.nombre_universidad,
        Valor: Number(f.valor),
        "Techo observado": Number(f.techo),
        "% del techo": Number(f.techo) ? Number(((f.valor / f.techo) * 100).toFixed(1)) : null,
      }));
    }
    return filasEvol.map(f => ({
      Ranking: rankingNombre,
      Métrica: metricaActual?.nombre_metrica || "",
      Universidad: f.universidad || nombreUni(f.id_universidad),
      Año: f.anio,
      Valor: Number(f.valor),
    }));
  }, [esAnual, filasAnual, filasEvol, rankingNombre, anioActivo, metricaActual, universidades]);

  const handleXLSX = () => {
    if (!filasExport.length) return;
    const ws = XLSX.utils.json_to_sheet(filasExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, esAnual ? "Comparación anual" : "Evolución");
    XLSX.writeFile(wb, `tendencias_${rankingNombre}_${vista}.xlsx`);
  };

  const handlePDF = async () => {
    if (pdfEstado === "generando" || !filasExport.length) return;
    setPdfEstado("generando");
    setExportando(true);
    try {
      // Espera a que React monte la copia de impresión y a que su ResizeObserver
      // haya medido el ancho fijo (el gráfico de líneas dimensiona su SVG con él).
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise(r => setTimeout(r, 450));

      const nodo = impresionRef.current;
      if (!nodo) throw new Error("No se montó la copia de impresión");

      const canvas = await html2canvas(nodo, {
        backgroundColor: "#131313",
        scale: 2,
        logging: false,
        useCORS: true,
        // Fija el viewport del clon: así los media queries del CSS se evalúan
        // siempre igual y no según el tamaño real de la ventana.
        windowWidth: ANCHO_PDF + 100,
        windowHeight: 1200,
        width: nodo.scrollWidth,
        height: nodo.scrollHeight,
      });

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 12;
      let y = margin + 4;

      pdf.setFontSize(15);
      pdf.setTextColor(20, 20, 20);
      pdf.text("Informe de Tendencias", margin, y);
      y += 7;

      pdf.setFontSize(9);
      pdf.setTextColor(90, 90, 90);
      pdf.text(
        esAnual
          ? `${rankingNombre}${disciplinaActiva ? ` · ${disciplinaActiva}` : ""} · comparación ${anioActivo} · ${metricasSel.length} métricas · ${graficadas.length} instituciones`
          : `${rankingNombre}${disciplinaActiva ? ` · ${disciplinaActiva}` : ""} · ${metricaActual?.nombre_metrica || ""} · ${graficadas.length} instituciones`,
        margin, y
      );
      y += 7;

      // La captura se trocea en franjas del alto de una página. Con muchas series
      // el panel lateral crece mucho, y así el informe nunca sale reescalado a
      // tamaño ilegible: se reparte en las páginas que haga falta.
      const imgW = pageW - margin * 2;
      const mmPorPx = imgW / canvas.width;
      const corte = document.createElement("canvas");
      const ctx = corte.getContext("2d");
      let consumido = 0;

      while (consumido < canvas.height) {
        const dispMm = pageH - y - margin;
        const dispPx = Math.floor(dispMm / mmPorPx);

        // Si en esta página ya casi no cabe nada, se salta a la siguiente.
        if (dispPx < 80) {
          pdf.addPage();
          y = margin;
          continue;
        }

        const altoPx = Math.min(dispPx, canvas.height - consumido);
        corte.width = canvas.width;
        corte.height = altoPx;
        ctx.fillStyle = "#131313";
        ctx.fillRect(0, 0, corte.width, corte.height);
        ctx.drawImage(canvas, 0, consumido, canvas.width, altoPx, 0, 0, canvas.width, altoPx);

        // JPEG en vez de PNG: a scale 2 el PNG dejaba informes de 7-8 MB.
        pdf.addImage(corte.toDataURL("image/jpeg", 0.92), "JPEG", margin, y, imgW, altoPx * mmPorPx);
        consumido += altoPx;
        y += altoPx * mmPorPx;

        if (consumido < canvas.height) {
          pdf.addPage();
          y = margin;
        }
      }
      y += 8;

      // Tabla de datos: mismas filas que exporta el XLSX.
      if (filasExport.length) {
        const cols = Object.keys(filasExport[0]);
        const anchoCol = (pageW - margin * 2) / cols.length;
        const filaAlto = 5;

        const encabezado = () => {
          pdf.setFillColor(28, 28, 28);
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(7);
          pdf.rect(margin, y, pageW - margin * 2, filaAlto, "F");
          cols.forEach((c, i) => pdf.text(String(c), margin + 1.5 + i * anchoCol, y + 3.5));
          y += filaAlto;
        };

        if (y + filaAlto * 3 > pageH - margin) { pdf.addPage(); y = margin; }
        pdf.setFontSize(10);
        pdf.setTextColor(20, 20, 20);
        pdf.text("Datos", margin, y);
        y += 5;
        encabezado();

        pdf.setFontSize(7);
        filasExport.forEach((row, i) => {
          if (y + filaAlto > pageH - margin) { pdf.addPage(); y = margin; encabezado(); pdf.setFontSize(7); }
          const tono = i % 2 === 0 ? 245 : 255;
          pdf.setFillColor(tono, tono, tono);
          pdf.rect(margin, y, pageW - margin * 2, filaAlto, "F");
          pdf.setTextColor(20, 20, 20);
          cols.forEach((c, j) => {
            const v = row[c];
            const txt = v === null || v === undefined ? "—" : String(v);
            pdf.text(txt.slice(0, Math.max(6, Math.floor(anchoCol / 1.6))), margin + 1.5 + j * anchoCol, y + 3.5);
          });
          y += filaAlto;
        });
      }

      pdf.save(`tendencias_${vista}_${rankingNombre.replace(/\s+/g, "-")}.pdf`);
      setPdfEstado("listo");
      setTimeout(() => setPdfEstado("idle"), 2500);
    } catch (err) {
      console.error("Error al generar el PDF:", err);
      setPdfEstado("error");
      setTimeout(() => setPdfEstado("idle"), 4000);
    } finally {
      setExportando(false);
    }
  };

  const notaTope = typeof maxSeries !== "number"
    ? ""
    : universidadesSel.length > maxSeries
    ? `Se grafican las primeras ${maxSeries} de ${universidadesSel.length} seleccionadas`
    : universidadesSel.length === maxSeries
    ? `Tope de ${maxSeries} alcanzado`
    : "";

  const btnSecundario =
    "font-body font-semibold text-[10px] uppercase tracking-[.1em] px-3.5 py-[9px] border border-white/[.16] text-[#c4c4c4] hover:bg-white hover:text-[#111] hover:border-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#c4c4c4] disabled:hover:border-white/[.16]";
  const selectClase =
    "bg-[#242424] border border-white/[.14] text-white font-body font-medium text-[11.5px] px-2.5 py-[7px] cursor-pointer focus:outline-none focus:border-white/40 max-w-[260px]";
  const etiqueta = "font-body font-medium text-[9px] uppercase tracking-[.14em] text-[#7f7f7f]";

  return (
    <div className="min-h-screen bg-background text-white">
      <main className="max-w-[1600px] mx-auto px-8 pt-[22px] pb-10">

        {/* Contexto + título + exportación */}
        <section className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#8a8a8a] mb-2">
              Tendencias · {rankingNombre}
              {disciplinaActiva ? ` · ${disciplinaActiva}` : ""}
              {esAnual && techoActual ? ` · escala 0–${fmt(techoActual, 0)}` : ""}
            </p>
            {esAnual ? (
              <>
                <h2 className="font-headline text-[28px] font-semibold text-white tracking-[-0.01em] mb-1.5">
                  Comparación {anioActivo ?? "—"}
                </h2>
                <p className="font-body text-[11.5px] text-[#7f7f7f]">
                  {graficadas.length} instituciones × {metricasSel.length} métricas · valores normalizados al techo de cada métrica
                </p>
              </>
            ) : (
              <>
                <h2 className="font-headline text-[28px] font-semibold text-white tracking-[-0.01em] mb-1.5">
                  {metricaActual?.nombre_metrica || "—"}
                  {metricaActual?.peso_metrica != null ? ` · Peso ${metricaActual.peso_metrica}` : ""}
                </h2>
                <p className="font-body text-[11.5px] text-[#7f7f7f]">
                  Serie histórica{proyeccion ? ` · proyección lineal a ${anosProyeccion} años` : ""}
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-none">
            {pdfEstado === "error" && (
              <span className="font-body text-[10px] text-negative">No se pudo generar el PDF</span>
            )}
            {pdfEstado === "listo" && (
              <span className="font-body text-[10px] text-positive">PDF descargado</span>
            )}
            <button
              onClick={handlePDF}
              disabled={pdfEstado === "generando" || !filasExport.length}
              className={btnSecundario}
            >
              {pdfEstado === "generando" ? "Generando…" : "↓ PDF"}
            </button>
            <button onClick={handleXLSX} disabled={!filasExport.length} className={btnSecundario}>
              ↓ XLSX
            </button>
          </div>
        </section>

        {/* Pestañas de vista */}
        <div className="flex gap-2 pt-[18px]">
          {VISTAS.map(v => {
            const activa = vista === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setVista(v.id)}
                className={`text-left px-3.5 py-[9px] border transition-colors ${
                  activa ? "bg-white border-white" : "border-white/[.14] hover:border-white/40"
                }`}
              >
                <div className={`font-body font-semibold text-[12px] ${activa ? "text-[#111]" : "text-[#9a9a9a]"}`}>
                  {v.label}
                </div>
                <div className={`font-body text-[10px] mt-0.5 ${activa ? "text-black/50" : "text-[#6f6f6f]"}`}>
                  {v.sub}
                </div>
              </button>
            );
          })}
        </div>

        {/* Barra de control compartida */}
        <div className="mt-4 px-3.5 py-[11px] bg-panel border border-hairline flex items-center gap-4 flex-wrap relative z-[25]">
          <div className="flex items-center gap-2">
            <span className={etiqueta}>Ranking</span>
            <select
              value={rankingId}
              onChange={e => {
                setRankingId(Number(e.target.value));
                setDisciplina(null);
                setAnio(null);
                setMetricaId(null);
                setMetricasSel([]);
              }}
              className={selectClase}
            >
              {rankings.map(r => (
                <option key={r.id_ranking} value={r.id_ranking}>{r.nombre_ranking}</option>
              ))}
            </select>
          </div>

          {disciplinas.length > 0 && (
            <div className="flex items-center gap-2">
              <span className={etiqueta}>Disciplina</span>
              <select
                value={disciplinaActiva || ""}
                onChange={e => { setDisciplina(e.target.value); setMetricaId(null); setMetricasSel([]); }}
                className={selectClase}
              >
                {disciplinas.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}

          {esAnual ? (
            <div className="flex items-center gap-2">
              <span className={etiqueta}>Año</span>
              <div className="flex gap-[3px] flex-wrap">
                {anios.map(a => (
                  <button
                    key={a}
                    onClick={() => setAnio(a)}
                    className={`font-mono font-semibold text-[11px] px-[9px] py-1.5 border transition-colors ${
                      a === anioActivo
                        ? "bg-white text-[#111] border-white"
                        : "border-white/[.14] text-[#9a9a9a] hover:text-white"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className={etiqueta}>Métrica</span>
                <select
                  value={metricaId || ""}
                  onChange={e => setMetricaId(Number(e.target.value))}
                  className={selectClase}
                >
                  {metricasDisponibles.map(m => (
                    <option key={m.id_metrica} value={m.id_metrica}>
                      {m.nombre_metrica}{m.peso_metrica != null ? ` · ${m.peso_metrica}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-px h-[26px] bg-white/10" />

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setProyeccion(v => !v)}
                  className={`font-body font-semibold text-[10px] uppercase tracking-[.1em] px-3 py-[7px] border transition-colors ${
                    proyeccion ? "bg-white text-[#111] border-white" : "border-white/[.16] text-[#9a9a9a] hover:text-white"
                  }`}
                >
                  Proyección
                </button>
                {proyeccion && (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => setAnosProyeccion(v => Math.max(1, v - 1))}
                      className="w-6 h-[26px] bg-[#242424] border border-white/[.14] text-[#c4c4c4] font-body font-semibold text-xs hover:text-white transition-colors"
                    >
                      −
                    </button>
                    <span className="min-w-[46px] text-center font-mono text-[11px] text-[#e6e6e6]">
                      {anosProyeccion} años
                    </span>
                    <button
                      onClick={() => setAnosProyeccion(v => Math.min(6, v + 1))}
                      className="w-6 h-[26px] bg-[#242424] border border-white/[.14] text-[#c4c4c4] font-body font-semibold text-xs hover:text-white transition-colors"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Chips de métricas: solo la vista de barras pone varias en el eje */}
        {esAnual && metricasDisponibles.length > 0 && (
          <div className="mt-2 px-3.5 py-2.5 bg-panel border border-hairline flex items-center gap-2.5 flex-wrap">
            <span className={`${etiqueta} flex-none`}>Métricas en el eje</span>
            <div className="flex gap-[5px] flex-wrap">
              {metricasDisponibles.map(m => {
                const on = metricasSel.includes(m.id_metrica);
                const lleno = !on && metricasSel.length >= MAX_CHIPS_METRICA;
                return (
                  <button
                    key={m.id_metrica}
                    disabled={lleno}
                    onClick={() =>
                      setMetricasSel(prev =>
                        prev.includes(m.id_metrica)
                          ? (prev.length > 1 ? prev.filter(id => id !== m.id_metrica) : prev)
                          : [...prev, m.id_metrica]
                      )
                    }
                    className={`flex items-baseline gap-1.5 px-2.5 py-1.5 border transition-colors ${
                      on ? "bg-white/[.09] border-white/40" : "border-white/[.12] hover:border-white/30"
                    } ${lleno ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    <span className={`font-body font-semibold text-[11px] ${on ? "text-white" : "text-[#7f7f7f]"}`}>
                      {m.nombre_metrica}
                    </span>
                    <span className="font-mono text-[9px] text-[#6f6f6f]">{m.peso_metrica ?? "—"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Instituciones */}
        <SelectorInstituciones
          universidades={universidades}
          seleccionadas={universidadesSel}
          setSeleccionadas={setUniversidadesSel}
          colorDe={colorDe}
          max={maxSeries}
          notaTope={notaTope}
        />

        {/* Gráfico + panel lateral */}
        <div className="pt-[22px] pb-2">
          {graficadas.length === 0 ? (
            <p className="font-body text-[11.5px] text-[#6f6f6f] py-16 text-center">
              Selecciona al menos una institución para ver el gráfico.
            </p>
          ) : esAnual ? (
            <VistaAnual
              filas={filasAnual}
              metricasSel={metricasSel}
              universidadesSel={graficadas}
              universidades={universidades}
              colorDe={colorDe}
              anio={anioActivo}
            />
          ) : (
            <VistaEvolucion
              filas={filasEvol}
              universidadesSel={graficadas}
              universidades={universidades}
              colorDe={colorDe}
              proyeccion={proyeccion}
              anosProyeccion={anosProyeccion}
            />
          )}
        </div>
      </main>

      {/* Copia para el PDF: ancho fijo y disposición fija, montada solo mientras
          se exporta. Va detrás del fondo opaco (z-index negativo) para que el
          usuario no la vea, pero con layout real para poder medirla y capturarla. */}
      {exportando && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: `${ANCHO_PDF}px`,
            zIndex: -1,
            background: "#131313",
            padding: "26px 30px",
          }}
        >
          <div ref={impresionRef} style={{ background: "#131313" }}>
            <p className="font-mono text-[11px] uppercase tracking-[.16em] text-[#8a8a8a] mb-2">
              {rankingNombre}
              {disciplinaActiva ? ` · ${disciplinaActiva}` : ""}
              {esAnual ? ` · ${anioActivo}` : ""}
            </p>
            <h2 className="font-headline text-[24px] font-semibold text-white mb-5">
              {esAnual ? `Comparación ${anioActivo ?? ""}` : metricaActual?.nombre_metrica || ""}
            </h2>
            {esAnual ? (
              <VistaAnual
                estatico
                filas={filasAnual}
                metricasSel={metricasSel}
                universidadesSel={graficadas}
                universidades={universidades}
                colorDe={colorDe}
                anio={anioActivo}
              />
            ) : (
              <VistaEvolucion
                estatico
                filas={filasEvol}
                universidadesSel={graficadas}
                universidades={universidades}
                colorDe={colorDe}
                proyeccion={proyeccion}
                anosProyeccion={anosProyeccion}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
