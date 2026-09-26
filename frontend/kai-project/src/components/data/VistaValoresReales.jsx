import { useMemo, useState } from "react";
import {
  CALIDADES, columnas, detalleCelda, formatearValor, matriz, ordenar, sinValor,
} from "../../utils/valoresReales";

const PUCV_ID = 2;
const numero = (v) => Number(v).toLocaleString("es-CL", { maximumFractionDigits: 1 });

/** Advertencia al entrar al modo numérico: qué parte del ranking se puede mostrar
 * en valores medidos, qué parte no, y cuánto se parece cada valor a lo que el
 * ranking mide. Cambia según el origen de los datos, porque no es lo mismo una
 * cifra publicada por la fuente que una medida por KAI con la definición ajena.
 */
function Aviso({ datos, nombreRanking, propio }) {
  const c = datos.cobertura;
  const faltan = sinValor(datos.metricas);
  const completo = c.componentes_con_valor === c.componentes;
  const hay = (calidad) => (c.calidades?.[calidad] ?? 0) > 0;

  let explicacion;
  if (datos.origen === "fuente") {
    explicacion = `${nombreRanking} publica estos valores tal cual —conteos, porcentajes e índices—: son los mismos de la fuente, sin normalizar.`;
  } else if (propio) {
    explicacion = `Son los valores medidos que ${nombreRanking} convierte en percentiles, tomados del SIES, la ANID y OpenAlex.`;
  } else {
    explicacion = `No son las cifras que cada universidad envió a ${nombreRanking}: KAI las calculó con la definición que ${nombreRanking} publica, a partir del SIES, la ANID, OpenAlex y SCImago. Sirven para entender el orden de magnitud y comparar, no para reemplazar las del ranking.`;
  }

  return (
    <section
      role="note"
      aria-labelledby="titulo-aviso-valores"
      className={`mb-5 border px-4 py-4 ${completo ? "border-white/[.12] bg-[#161616]" : "border-[#b8862b]/40 bg-[#1d1810]"}`}
    >
      <h2 id="titulo-aviso-valores" className="font-mono text-[10px] uppercase tracking-[.14em] text-[#cfcfcf]">
        Valores medidos, no puntajes
      </h2>
      <p className="text-xs text-[#9a9a9a] leading-relaxed mt-1.5 max-w-[860px]">{explicacion}</p>

      <p className="text-xs text-[#dcdcdc] leading-relaxed mt-2">
        {completo
          ? `Cubren las ${c.componentes} componentes del ranking.`
          : `Cubren ${c.componentes_con_valor} de ${c.componentes} componentes, que suman ${numero(c.peso_con_valor)} de los ${numero(c.peso_total)} puntos del ranking en ${datos.anio}.`}
      </p>

      {faltan.length > 0 && (
        <p className="text-xs text-[#9a9a9a] leading-relaxed mt-1.5">
          Sin valor medido:{" "}
          {faltan.map((m, i) => (
            <span key={m.id_metrica}>
              {i > 0 && ", "}
              {m.nombre_metrica} <span className="font-mono text-[#6f6f6f]">({numero(m.peso_metrica)})</span>
            </span>
          ))}
          .
        </p>
      )}

      {datos.origen !== "fuente" && (hay("aproximada") || hay("parcial")) && (
        <ul className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-[#9a9a9a]">
          {hay("aproximada") && (
            <li><span className="font-mono text-[#e0b25a] mr-1.5">{CALIDADES.aproximada.marca}</span>{CALIDADES.aproximada.texto}</li>
          )}
          {hay("parcial") && (
            <li><span className="font-mono text-[#e0b25a] mr-1.5">{CALIDADES.parcial.marca}</span>{CALIDADES.parcial.texto}</li>
          )}
        </ul>
      )}

      <p className="text-[11px] text-[#6f6f6f] mt-2.5">
        Los valores medidos no se suman entre sí, así que esta vista no tiene total: conserva la
        posición del puntaje. Haz clic en una columna para ordenar por ella.
      </p>
    </section>
  );
}

export default function VistaValoresReales({
  datos, loading, error, ordenPuntaje, nombreRanking, propio, anio, onElegirAnio,
}) {
  const [criterio, setCriterio] = useState({ tipo: "posicion" });

  const cols = useMemo(() => (datos ? columnas(datos.metricas) : []), [datos]);
  const filas = useMemo(() => {
    if (!datos) return [];
    return ordenar(matriz(datos.valores, ordenPuntaje), criterio, datos.metricas);
  }, [datos, ordenPuntaje, criterio]);

  if (error) {
    return <div className="flex items-center justify-center h-64 text-negative text-sm">{error}</div>;
  }
  if (loading || !datos) {
    return <div className="flex items-center justify-center h-64 text-outlineSoft text-sm">Cargando valores medidos…</div>;
  }
  if (!datos.valores.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-outlineSoft text-sm text-center">
        <p>No hay valores medidos de {nombreRanking} para {anio}.</p>
        {datos.anios.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            <span className="text-[11px] mr-1 self-center">Años con valores:</span>
            {datos.anios.map((a) => (
              <button key={a} type="button" onClick={() => onElegirAnio(a)}
                className="bg-[#1c1c1c] border border-white/[.14] text-[#cfcfcf] text-[11px] py-1 px-2.5 hover:border-white/30">
                {a}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const alternar = (idMetrica) => setCriterio((c) =>
    c.id_metrica === idMetrica
      ? { id_metrica: idMetrica, direccion: c.direccion === "mejor" ? "peor" : "mejor" }
      : { id_metrica: idMetrica, direccion: "mejor" });
  const ordenDe = (idMetrica) => {
    if (criterio.id_metrica !== idMetrica) return "none";
    const menor = cols.find((m) => m.id_metrica === idMetrica)?.sentido === "menor";
    return (criterio.direccion === "mejor") === menor ? "ascending" : "descending";
  };

  return (
    <>
      <Aviso datos={datos} nombreRanking={nombreRanking} propio={propio} />

      <div className="overflow-x-auto border-t border-white/[.12]">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Valores medidos de {nombreRanking} en {datos.anio}, por universidad y componente
          </caption>
          <thead>
            <tr className="border-b border-white/[.12]">
              <th scope="col" aria-sort={criterio.tipo === "posicion" ? "ascending" : "none"}
                className="sticky left-0 z-10 bg-background py-2.5 px-3 align-bottom">
                <button type="button" onClick={() => setCriterio({ tipo: "posicion" })}
                  className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a] hover:text-white">
                  Pos
                </button>
              </th>
              <th scope="col" className="sticky left-[52px] z-10 bg-background py-2.5 px-3 align-bottom min-w-[220px]">
                <span className="font-mono text-[9.5px] uppercase tracking-[.14em] text-[#7a7a7a]">Institución</span>
              </th>
              {cols.map((m) => (
                <th key={m.id_metrica} scope="col" aria-sort={ordenDe(m.id_metrica)}
                  className="py-2.5 px-3 align-bottom text-right min-w-[132px]">
                  <button type="button" onClick={() => alternar(m.id_metrica)}
                    className="text-right w-full group" title={`Ordenar por ${m.nombre_metrica}`}>
                    <span className="block text-[11px] font-semibold text-[#dcdcdc] group-hover:text-white leading-tight">
                      {m.nombre_metrica}
                      {criterio.id_metrica === m.id_metrica && (
                        <span className="ml-1 text-[#9a9a9a]">{criterio.direccion === "mejor" ? "▼" : "▲"}</span>
                      )}
                    </span>
                    <span className="block font-mono text-[9.5px] text-[#6f6f6f] mt-0.5 leading-tight">
                      {datos.valores.find((v) => v.id_metrica === m.id_metrica)?.unidad || m.unidad_valor || "según la fuente"}
                    </span>
                    <span className="block font-mono text-[9.5px] text-[#6f6f6f] leading-tight">
                      peso {numero(m.peso_metrica)}{m.sentido === "menor" ? " · menos es mejor" : ""}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const propia = f.id_universidad === PUCV_ID;
              return (
                <tr key={f.id_universidad}
                  className={`border-t border-white/[.05] hover:bg-white/[.03] ${propia ? "bg-[rgba(70,130,255,.07)]" : ""}`}>
                  <td className={`sticky left-0 z-[1] py-2 px-3 font-mono text-[12.5px] tabular-nums ${propia ? "bg-[#161b24] text-white" : "bg-background text-[#8a8a8a]"}`}>
                    {f.posicion != null ? String(f.posicion).padStart(2, "0") : "—"}
                  </td>
                  <th scope="row" className={`sticky left-[52px] z-[1] py-2 px-3 text-sm font-semibold font-body truncate max-w-[280px] ${propia ? "bg-[#161b24] text-white" : "bg-background text-[#dcdcdc]"}`}>
                    {f.nombre_universidad}
                  </th>
                  {cols.map((m) => {
                    const v = f.celdas[m.id_metrica];
                    const marca = datos.origen !== "fuente" && v ? CALIDADES[v.calidad]?.marca : "";
                    return (
                      <td key={m.id_metrica} title={detalleCelda(v, datos.origen)}
                        className="py-2 px-3 text-right font-mono text-[12px] tabular-nums text-[#dcdcdc] whitespace-nowrap">
                        {marca && <span className="text-[#e0b25a] mr-1" aria-label={CALIDADES[v.calidad].etiqueta}>{marca}</span>}
                        {v ? formatearValor(v.valor) : <span className="text-[#5f5f5f]">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[11px] text-[#6f6f6f]">
        Pasa el cursor sobre un valor para ver su fórmula, sus fuentes y de qué años salen los datos.
      </p>
    </>
  );
}
