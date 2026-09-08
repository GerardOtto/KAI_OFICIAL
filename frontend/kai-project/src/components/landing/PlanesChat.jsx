import { motion } from "framer-motion";

/** Tokens que consume una consulta típica, medidos sobre consultas reales que
 *  obligan al modelo a llamar a una herramienta y leer su resultado.
 *
 *  Sirven para traducir la cuota a algo que un comprador entienda: «tokens» no
 *  significa nada fuera del gremio, «unas 230 consultas al mes» sí. Es una
 *  estimación, y así se rotula. */
const TOKENS_POR_CONSULTA = { claude: 3000, gemini: 1300 };

const CandadoIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="11" width="16" height="10" rx="1" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

/** Convierte una cifra de tokens en algo legible de un vistazo. */
function tokensLegibles(n) {
  if (n == null) return "Sin límite";
  if (n === 0) return "No incluido";
  if (n >= 1000000) return `${(n / 1000000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} M tokens`;
  return `${Math.round(n / 1000)} mil tokens`;
}

function consultasAprox(tokens, motor) {
  if (tokens == null) return "sin tope";
  if (tokens === 0) return null;
  const n = Math.round(tokens / TOKENS_POR_CONSULTA[motor]);
  return `≈ ${n.toLocaleString("es-CL")} consultas`;
}

function Limite({ motor, etiqueta, tokens, destacado }) {
  const incluido = tokens !== 0;
  const aprox = consultasAprox(tokens, motor);
  return (
    <div className={`flex items-start gap-2.5 ${incluido ? "" : "opacity-45"}`}>
      <span className={`mt-0.5 shrink-0 ${incluido ? (destacado ? "text-black" : "text-white") : "text-outlineSoft"}`}>
        {incluido ? <CheckIcon /> : <CandadoIcon />}
      </span>
      <div className="min-w-0">
        <p className={`text-[12px] leading-snug ${destacado ? "text-black" : "text-white/90"}`}>
          <span className="font-semibold">{etiqueta}</span>
          {" — "}
          {tokensLegibles(tokens)}
        </p>
        {aprox && (
          <p className={`font-mono text-[9px] uppercase tracking-widest mt-0.5 ${
            destacado ? "text-black/50" : "text-outlineSoft"
          }`}>
            {aprox} al mes
          </p>
        )}
      </div>
    </div>
  );
}

/** Los planes, presentados dentro de la conversación de la portada. */
export default function PlanesChat({ planes, onElegir }) {
  if (!planes.length) {
    return <p className="text-[12px] text-outlineSoft">Cargando planes…</p>;
  }

  // El plan de pago más barato es el que se destaca: es la conversión que
  // interesa, y destacar el más caro se lee como venta agresiva.
  const dePago = planes.filter((p) => p.precio_mensual_usd > 0);
  const destacadoId = dePago.length ? dePago[0].codigo_plan : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed text-white/85">
        Se cobra por <strong className="font-semibold text-white">consumo de tokens</strong>, que es como
        facturan los modelos por debajo. Cada plan trae una cuota mensual por motor y un tope de consultas
        diarias.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {planes.map((p) => {
          const destacado = p.codigo_plan === destacadoId;
          const gratis = p.precio_mensual_usd === 0;
          return (
            <motion.div
              key={p.codigo_plan}
              whileHover={{ y: -3 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className={`relative flex flex-col gap-3 p-5 border ${
                destacado ? "bg-white border-white" : "bg-black/40 border-outline/40 backdrop-blur-sm"
              }`}
            >
              {destacado && (
                <span className="absolute -top-2.5 right-4 bg-black text-white px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest">
                  Recomendado
                </span>
              )}

              <div>
                <h4 className={`font-headline text-xl leading-none ${destacado ? "text-black" : "text-white"}`}>
                  {p.nombre_plan}
                </h4>
                <p className={`text-[10px] uppercase tracking-widest mt-2 leading-relaxed ${
                  destacado ? "text-black/60" : "text-outlineSoft"
                }`}>
                  {p.descripcion}
                </p>
              </div>

              <p className={`font-headline text-3xl leading-none ${destacado ? "text-black" : "text-white"}`}>
                {gratis ? "Gratis" : `US$ ${p.precio_mensual_usd.toLocaleString("es-CL")}`}
                {!gratis && (
                  <span className={`font-label text-[10px] uppercase tracking-widest ml-1 ${
                    destacado ? "text-black/50" : "text-outlineSoft"
                  }`}>
                    /mes
                  </span>
                )}
              </p>

              <div className="flex flex-col gap-2 pt-1">
                <Limite motor="gemini" etiqueta="Gemini · respuestas rápidas"
                        tokens={p.tokens_gemini_mes} destacado={destacado} />
                <Limite motor="claude" etiqueta="Claude · razonamiento profundo"
                        tokens={p.tokens_claude_mes} destacado={destacado} />
                <div className="flex items-start gap-2.5">
                  <span className={`mt-0.5 shrink-0 ${destacado ? "text-black" : "text-white"}`}>
                    <CheckIcon />
                  </span>
                  <p className={`text-[12px] leading-snug ${destacado ? "text-black" : "text-white/90"}`}>
                    <span className="font-semibold">
                      {p.mensajes_por_dia == null ? "Sin tope diario" : `${p.mensajes_por_dia} consultas al día`}
                    </span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => onElegir(p)}
                className={`mt-auto w-full py-2.5 text-[10px] uppercase tracking-widest font-bold transition-colors ${
                  destacado
                    ? "bg-black text-white hover:bg-black/80"
                    : "border border-outline/50 text-white hover:bg-white hover:text-black"
                }`}
              >
                {gratis ? "Crear cuenta" : "Contratar"}
              </button>
            </motion.div>
          );
        })}
      </div>

      <p className="text-[11px] leading-relaxed text-outlineSoft border-l-2 border-outline pl-3">
        Con una cuenta y sin plan contratado quedas en el plan gratuito: motor Gemini, con su cuota y su
        tope diario. <strong className="font-semibold text-white/90">Claude solo se incluye en los planes
        de pago.</strong> Las estimaciones de consultas suponen un consumo medio por consulta y son
        orientativas; lo que se descuenta son los tokens realmente usados.
      </p>
    </div>
  );
}
