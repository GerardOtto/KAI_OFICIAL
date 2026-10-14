import { useEffect, useState } from "react";
import { cabeceraAuth } from "../auth/AuthContext";
import { comoLista } from "./respuesta";

const VACIO = { valoresMap: {}, unidadesMap: {}, edicionesMap: {} };

// Mismo patrón que useMetricasMatriz: pide /valores-metrica-universidad por
// cada tipo en paralelo para poblar los valores de la institución elegida
// en toda la matriz, no solo en una categoría a la vez.
//
// Sin `anio`, cada ranking aporta su edición más reciente con datos de la
// institución, y `edicionesMap` dice cuál fue. Un solo año para todos dejaba
// columnas enteras vacías: las ediciones de cada ranking no coinciden.
//
// El resultado queda ligado a la petición que lo produjo: al cambiar de
// institución, de año o de modo, los valores anteriores dejan de valer en el acto
// y una respuesta tardía no pisa a la vigente.
export function useValoresMatriz(tipos, universidadId, anio, modo = "puntajes") {
  const [estado, setEstado] = useState({ clave: "", ...VACIO });
  const clave = tipos.length && universidadId
    ? `${tipos.join("~")}|${universidadId}|${anio ?? ""}|${modo}` : "";

  useEffect(() => {
    if (!clave) return;
    const [lista, uni, a, m] = clave.split("|");
    let vigente = true;
    Promise.all(
      lista.split("~").map(tipo => {
        const params = new URLSearchParams({ tipo, universidad_id: uni, modo: m });
        if (a) params.append("anio", a);
        return fetch(`${import.meta.env.VITE_API_URL}/valores-metrica-universidad?${params}`, { headers: cabeceraAuth() })
          .then(r => r.json()).then(comoLista)
          .catch(() => []);
      })
    ).then(porTipo => {
      if (!vigente) return;
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
      setEstado({ clave, valoresMap, unidadesMap, edicionesMap });
    });
    return () => { vigente = false; };
  }, [clave]);

  const vigente = clave && estado.clave === clave;
  return { ...(vigente ? estado : VACIO), loading: Boolean(clave) && !vigente };
}
