import { useSyncExternalStore } from "react";

// Por debajo de `md` de Tailwind (768 px): las tablas de varias columnas fijas
// no caben y se reorganizan. Cuando el cambio es solo de estilo, conviene usar
// las clases `md:` de Tailwind; este gancho es para cuando cambia qué se dibuja
// (columnas de una grilla en línea, paneles que se pliegan).
const CONSULTA = "(max-width: 767px)";

const suscribir = (aviso) => {
  const mq = window.matchMedia?.(CONSULTA);
  if (!mq) return () => {};
  mq.addEventListener("change", aviso);
  return () => mq.removeEventListener("change", aviso);
};
const leer = () => window.matchMedia?.(CONSULTA).matches ?? false;

export default function useEsMovil() {
  return useSyncExternalStore(suscribir, leer, () => false);
}
