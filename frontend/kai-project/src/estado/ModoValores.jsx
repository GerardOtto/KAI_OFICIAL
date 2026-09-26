import { createContext, useCallback, useContext, useMemo, useState } from "react";

/** Modo de valores de toda la plataforma: «puntajes» o «numerico».
 *
 * Es un estado único: el switch del header lo cambia y Resumen, Tendencias,
 * Simulación y Glosario lo leen. Se recuerda en el navegador de cada persona
 * como comodidad —si no se puede leer, arranca en puntajes—, porque es una
 * preferencia de vista y no un dato que deba compartirse ni persistir.
 */
const MODOS = ["puntajes", "numerico"];
const CLAVE = "kai_modo_valores";

const ModoValoresContext = createContext({
  modo: "puntajes",
  numerico: false,
  setModo: () => {},
});

function leerGuardado() {
  try {
    const v = window.localStorage.getItem(CLAVE);
    return MODOS.includes(v) ? v : "puntajes";
  } catch {
    return "puntajes";
  }
}

export function ModoValoresProvider({ children }) {
  const [modo, setModoEstado] = useState(leerGuardado);

  const setModo = useCallback((nuevo) => {
    if (!MODOS.includes(nuevo)) return;
    setModoEstado(nuevo);
    try {
      window.localStorage.setItem(CLAVE, nuevo);
    } catch {
      // Navegación privada o almacenamiento bloqueado: el modo vale igual en la sesión.
    }
  }, []);

  const valor = useMemo(() => ({ modo, numerico: modo === "numerico", setModo }), [modo, setModo]);
  return <ModoValoresContext.Provider value={valor}>{children}</ModoValoresContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useModoValores() {
  return useContext(ModoValoresContext);
}

/** Rutas donde el switch tiene efecto. El asistente y la portada quedan fuera. */
// eslint-disable-next-line react-refresh/only-export-components
export const RUTAS_CON_MODO = ["/ranking", "/tendencias", "/simulacion", "/metricas"];
