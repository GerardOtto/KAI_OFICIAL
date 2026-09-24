import { useEffect, useRef, useState } from "react";
import { MS_ENTRE_DIBUJOS, cortes, duracion, reducirMovimiento } from "./revelado";

/** Va entregando el texto por palabras hasta completarlo.
 *
 * Devuelve `{ visible, revelando }`: el trozo que toca mostrar y si la aparición
 * sigue en curso. Con `activo` en falso —una conversación que se abre desde el
 * historial, o la sonda que monta el componente suelto— devuelve el texto entero
 * desde el primer dibujo, que es lo que se espera al releer algo ya respondido.
 *
 * `alAvanzar` se llama en cada avance para que quien lo use mantenga la vista
 * pegada al final; se guarda en una referencia para que volver a declararlo en
 * el componente padre no reinicie la animación.
 */
export default function useRevelado(texto, activo, alAvanzar) {
  // Si este mensaje se anima se decide al montarlo y no vuelve a evaluarse: el
  // contenido de una respuesta ya publicada no cambia, y cuando llega la
  // siguiente —que sí se revela— esta no debe empezar de nuevo.
  const [animado] = useState(() => activo && !reducirMovimiento());
  const [corte, setCorte] = useState(0);
  const avisar = useRef(alAvanzar);

  useEffect(() => { avisar.current = alAvanzar; }, [alAvanzar]);

  useEffect(() => {
    if (!animado) return undefined;

    const puntos = cortes(texto);
    const total = duracion(puntos.length);
    const inicio = performance.now();
    let cuadro = 0;
    let ultimoPunto = -1;
    let ultimoDibujo = 0;

    const paso = (ahora) => {
      const avance = Math.min(1, (ahora - inicio) / total);
      const punto = Math.min(puntos.length - 1, Math.floor(avance * puntos.length));
      if (punto !== ultimoPunto && ahora - ultimoDibujo >= MS_ENTRE_DIBUJOS) {
        ultimoPunto = punto;
        ultimoDibujo = ahora;
        setCorte(puntos[punto]);
        avisar.current?.();
      }
      if (avance < 1) {
        cuadro = requestAnimationFrame(paso);
        return;
      }
      setCorte(texto.length);
      avisar.current?.();
    };

    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [texto, animado]);

  return animado
    ? { visible: texto.slice(0, corte), revelando: corte < texto.length }
    : { visible: texto, revelando: false };
}
