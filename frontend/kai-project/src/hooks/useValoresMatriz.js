import { useEffect, useMemo, useState } from "react";
import { comoLista } from "./respuesta";
import { leer, otroModo, pedir, precargar } from "./cache";

const VACIO = { valoresMap: {}, unidadesMap: {}, edicionesMap: {} };
const NOMBRE = "valores-metrica-universidad";

export function rutaValoresTipo(tipo, universidadId, anio, modo) {
  const params = new URLSearchParams({ tipo, universidad_id: universidadId, modo });
  if (anio) params.append("anio", anio);
  return `/valores-metrica-universidad?${params}`;
}

/** Los valores de todas las dimensiones, indexados por métrica y por ranking. */
function armar(porTipo) {
  const valoresMap = {};
  // En modo numérico cada cifra trae su unidad; se guarda aparte para que
  // quien lee el valor lo siga recibiendo como número en ambos modos.
  const unidadesMap = {};
  const edicionesMap = {};
  porTipo.flat().forEach(v => {
    valoresMap[v.id_metrica] = v.valor_metrica;
    if (v.unidad) unidadesMap[v.id_metrica] = v.unidad;
    if (v.id_ranking != null) edicionesMap[v.id_ranking] = v.anio_metrica;
  });
  return { valoresMap, unidadesMap, edicionesMap };
}

// Mismo patrón que useMetricasMatriz: pide /valores-metrica-universidad por
// cada tipo en paralelo para poblar los valores de la institución elegida
// en toda la matriz, no solo en una categoría a la vez.
//
// Sin `anio`, cada ranking aporta su edición más reciente con datos de la
// institución, y `edicionesMap` dice cuál fue. Un solo año para todos dejaba
// columnas enteras vacías: las ediciones de cada ranking no coinciden.
//
// Con caché, y dejando pedido el otro modo: alternar Puntajes y Valores muestra
// lo que ya llegó, sin volver al servidor. Una respuesta tardía no pisa a la
// vigente.
export function useValoresMatriz(tipos, universidadId, anio, modo = "puntajes") {
  const [estado, setEstado] = useState({ clave: "", ...VACIO });
  const clave = tipos.length && universidadId
    ? `${tipos.join("~")}|${universidadId}|${anio ?? ""}|${modo}` : "";
  const rutas = useMemo(
    () => (clave ? tipos.map(t => rutaValoresTipo(t, universidadId, anio, modo)) : []),
    [clave, tipos, universidadId, anio, modo]
  );
  const completo = rutas.length > 0 && rutas.every(r => leer(r, NOMBRE) !== undefined);
  const desdeCache = useMemo(
    () => (completo ? armar(rutas.map(r => leer(r, NOMBRE))) : null),
    [completo, rutas]
  );

  useEffect(() => {
    if (!clave) return;
    tipos.forEach(t => precargar(rutaValoresTipo(t, universidadId, anio, otroModo(modo)), comoLista, NOMBRE));
    if (completo) return;
    let vigente = true;
    Promise.all(rutas.map(r => pedir(r, comoLista, NOMBRE).catch(() => [])))
      .then(porTipo => vigente && setEstado({ clave, ...armar(porTipo) }));
    return () => { vigente = false; };
  }, [clave, completo, rutas, tipos, universidadId, anio, modo]);

  if (desdeCache) return { ...desdeCache, loading: false };
  const vigente = clave && estado.clave === clave;
  return { ...(vigente ? estado : VACIO), loading: Boolean(clave) && !vigente };
}
