import { useMemo, useState, useEffect } from "react";
import { useSimulacion } from "../../hooks/useSimulacion";
import { motion } from "framer-motion";
import { useRef } from "react";

export default function TablaSimulacion({ rankingId, anio, selectedUniversidades, onDataChange }) {
  const rawData = useSimulacion(rankingId, anio, selectedUniversidades);
  const [width, setWidth] = useState(256); // 256px = w-64 inicial
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // { id_universidad: { id_metrica: valor_editado } }
  const [overrides, setOverrides] = useState({});

  // Resetear overrides cuando cambia ranking/año
  useEffect(() => { setOverrides({}); }, [rankingId, anio]);

  const { metricas, filas } = useMemo(() => {
    if (!rawData.length) return { metricas: [], filas: [] };

    // Métricas únicas ordenadas
    const metricaMap = {};
    rawData.forEach(r => {
      if (!metricaMap[r.id_metrica]) {
        metricaMap[r.id_metrica] = { id_metrica: r.id_metrica, nombre_metrica: r.nombre_metrica, peso_metrica: r.peso_metrica };
      }
    });
    const metricas = Object.values(metricaMap);

    // Agrupar por universidad
    const uniMap = {};
    rawData.forEach(r => {
      if (!uniMap[r.id_universidad]) {
        uniMap[r.id_universidad] = { id_universidad: r.id_universidad, nombre: r.nombre_universidad, valores: {} };
      }
      uniMap[r.id_universidad].valores[r.id_metrica] = r.valor_metrica;
    });

    const filas = Object.values(uniMap);
    return { metricas, filas };
  }, [rawData]);

  const getValor = (idUni, idMetrica, original) => {
    return overrides[idUni]?.[idMetrica] ?? original ?? 0;
  };

  const setValor = (idUni, idMetrica, val) => {
    setOverrides(prev => ({
      ...prev,
      [idUni]: { ...(prev[idUni] || {}), [idMetrica]: val }
    }));
  };

  const calcScore = (fila) => {
    return metricas.reduce((acc, m) => {
      const val = parseFloat(getValor(fila.id_universidad, m.id_metrica, fila.valores[m.id_metrica])) || 0;
      const peso = parseFloat(m.peso_metrica) || 0;
      return acc + val * peso;
    }, 0);
  };

  // Ranking dinámico sidebar
  const ranking = useMemo(() => {
    return [...filas]
      .map(f => ({ nombre: f.nombre, score: calcScore(f) }))
      .sort((a, b) => b.score - a.score);
  }, [filas, overrides]);

  useEffect(() => {
    function handleMouseMove(e) {
      if (!isResizing) return;
  
      // Limitar ancho (UX importante)
      const delta = e.clientX - startX.current;
      const newWidth = Math.max(180, Math.min(500, startWidth.current + delta));
      setWidth(newWidth);
    }
  
    function handleMouseUp() {
      setIsResizing(false);
    }
  
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    document.body.style.cursor = isResizing ? "col-resize" : "default";
  }, [isResizing]);

  useEffect(() => {
    if (onDataChange) onDataChange({ filas, metricas, overrides });
  }, [filas, metricas, overrides]);

  useEffect(() => {
    document.body.style.userSelect = isResizing ? "none" : "auto";
  }, [isResizing]);
  
  if (!anio) return (
    <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
      Selecciona un año para comenzar.
    </div>
  );

  if (!selectedUniversidades.length) return (
    <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
      Selecciona al menos una universidad.
    </div>
  );

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* Ranking dinámico */}
      <div
        style={{ width }}
        className="shrink-0 border-r border-outline/30 bg-[#1a1a1a] flex flex-col relative"
      >
        <div
          onMouseDown={(e) => {
            setIsResizing(true);
            startX.current = e.clientX;
            startWidth.current = width;
          }}
          className="absolute top-0 right-0 h-full w-2 cursor-col-resize bg-white/10 hover:bg-white/30 transition"
        />
        <div className="p-5 border-b border-outline/30">
          <p className="text-[10px] uppercase tracking-widest text-outlineSoft">Ranking Dinámico</p>
          <p className="text-[9px] text-outlineSoft/60 mt-1 italic">Ordenado por Score Total</p>
        </div>
        <motion.div layout={!isResizing} className="flex flex-col overflow-y-auto">
          {ranking.map((r, i) => (
            <motion.div
              key={r.nombre}
              layout={!isResizing}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 70 }}
              className={`p-4 flex items-center justify-between border-b border-outline/10 ${
                i === 0 ? "border-l-2 border-l-white bg-white/5" : "hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`font-mono text-lg ${i === 0 ? "text-white" : "text-outlineSoft"}`}>
                    {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-xs font-semibold truncate flex-1">{r.nombre}</span>
              </div>
              <span className={`font-mono text-sm ${i === 0 ? "text-white" : "text-outlineSoft"}`}>
                  {r.score.toFixed(1)}
              </span>
          </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-[#1a1a1a] border-b border-outline/30 sticky top-0 z-10">
              <th className="p-4 text-left border-r border-outline/30 sticky left-0 bg-[#1a1a1a] z-20 min-w-[200px]">
                <span className="text-[10px] uppercase tracking-widest text-outlineSoft">Institución</span>
              </th>
              {metricas.map(m => (
                <th key={m.id_metrica} className="p-4 text-center border-r border-outline/30 min-w-[130px]">
                <div className="text-[12px] text-white/80 uppercase tracking-tight mb-1">
                {m.nombre_metrica}
                </div>
                <div className="text-[18px] text-white/40">
                    {m.peso_metrica}%
                </div>
                </th>
              ))}
              <th className="p-4 text-center bg-white/5 min-w-[100px] sticky right-0">
                <div className="text-[10px] text-outlineSoft uppercase tracking-widest mb-1">Total</div>
                <div className="text-xs font-bold text-white">Score</div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline/20">
            {filas.map(fila => (
              <tr key={fila.id_universidad} className="hover:bg-white/[0.02] transition-colors">
                <td className="p-4 text-sm font-semibold sticky left-0 bg-[#131313] border-r border-outline/30 z-10">
                  {fila.nombre}
                </td>
                {metricas.map(m => {
                  const original = fila.valores[m.id_metrica];
                  const actual = getValor(fila.id_universidad, m.id_metrica, original);
                  const modificado = overrides[fila.id_universidad]?.[m.id_metrica] !== undefined;
                  return (
                    <td key={m.id_metrica} className="p-3 text-center border-r border-outline/30 relative group">
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={e => {
                            const val = parseFloat(e.target.innerText);
                            if (!isNaN(val)) setValor(fila.id_universidad, m.id_metrica, val);
                            else e.target.innerText = getValor(fila.id_universidad, m.id_metrica, fila.valores[m.id_metrica]);
                        }}
                        className="text-xl font-mono py-1 focus:outline-none focus:border-b focus:border-white cursor-text"
                        style={{ color: modificado ? "#a78bfa" : "inherit" }}
                        >
                        {actual ?? 0}
                        </div>
                      {modificado && (
                        <div className="text-[9px] text-outlineSoft uppercase tracking-tighter">
                          Original: {original}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="p-4 text-center bg-white/5 font-mono text-white sticky right-0">
                  {calcScore(fila).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}