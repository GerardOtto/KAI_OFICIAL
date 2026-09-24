import { useEffect, useState } from "react";
import { SparkleIcon } from "./iconos";

/** Segundos tras los cuales se avisa de que la consulta va larga.
 *
 * Una respuesta normal llega en dos a seis segundos; pasado este umbral el
 * silencio empieza a parecerse a una caída, y conviene decir que no lo es. */
const AVISO_LENTO = 15;

/** Desde cuándo se muestra el cronómetro. Antes estorba más que informa. */
const CRONOMETRO_DESDE = 3;

const Punto = ({ retraso }) => (
  <span
    className="w-[3px] h-[3px] bg-outlineSoft animate-onda motion-reduce:animate-none"
    style={{ animationDelay: `${retraso}ms` }}
  />
);

/** Indicador de que el asistente está trabajando.
 *
 * Todo el movimiento es CSS sobre elementos que ya están en la página: ni una
 * imagen que descargar, se adapta al color del tema y se ve nítido en cualquier
 * pantalla. Con `prefers-reduced-motion` queda el mismo indicador quieto.
 *
 * Nada de lo que muestra es inventado: el servidor no informa del progreso
 * mientras responde, así que se anuncia lo único que se sabe con certeza —que la
 * consulta sigue en curso y cuánto lleva—, sin fingir etapas.
 */
export default function Cargando({ etiqueta = "Consultando la base de datos" }) {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    const reloj = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(reloj);
  }, []);

  return (
    <div className="flex items-start gap-3" role="status" aria-live="polite">
      <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-surfaceHigh border border-outline/50 text-white mt-1 animate-latido motion-reduce:animate-none">
        <SparkleIcon />
      </div>

      <div className="flex flex-col gap-2 mt-1.5 min-w-0">
        <div className="flex items-center gap-2.5">
          {/* El barrido de claridad recorre el propio texto: el degradado se
              recorta contra las letras y se desplaza, así que la frase parece
              iluminarse de izquierda a derecha sin mover nada de sitio. */}
          <span className="text-sm italic bg-[linear-gradient(90deg,#919191_0%,#919191_40%,#ffffff_50%,#919191_60%,#919191_100%)] bg-[length:250%_100%] bg-clip-text text-transparent animate-barrido motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-outlineSoft">
            {etiqueta}
          </span>
          <span className="flex items-center gap-[3px] pb-0.5">
            <Punto retraso={0} />
            <Punto retraso={160} />
            <Punto retraso={320} />
          </span>
          {segundos >= CRONOMETRO_DESDE && (
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#5f5f5f] tabular-nums">
              {segundos}s
            </span>
          )}
        </div>

        {/* Barra indeterminada: informa de actividad, no de cuánto falta. */}
        <div className="h-px w-44 max-w-full bg-outline/30 overflow-hidden">
          <div className="h-px w-1/3 bg-white/60 animate-deslizar motion-reduce:hidden" />
        </div>

        {segundos >= AVISO_LENTO && (
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#6f6f6f]">
            La consulta sigue en curso; las que cruzan varios rankings tardan más
          </p>
        )}
      </div>
    </div>
  );
}
