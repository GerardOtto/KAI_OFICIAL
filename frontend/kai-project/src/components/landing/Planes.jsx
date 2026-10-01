import { motion } from "framer-motion";

/** Tokens que consume una consulta típica, entrada y salida juntas. El de
 *  Gemini es el promedio medido en uso real; el de Claude, una estimación
 *  conservadora, porque su razonamiento se factura como salida.
 *
 *  Sirven para traducir la cuota a algo que un comprador entienda: «tokens» no
 *  significa nada fuera del gremio, «unas 330 consultas al mes» sí. Es una
 *  estimación, y así se rotula. Ver docs/planes.md. */
const TOKENS_POR_CONSULTA = { claude: 20000, gemini: 15000 };

const Check = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
       aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const Candado = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="1" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const Flecha = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
       aria-hidden="true" className="transition-transform group-hover:translate-x-1">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

function consultas(tokens, motor) {
  if (tokens == null) return "sin tope";
  return `≈ ${Math.round(tokens / TOKENS_POR_CONSULTA[motor]).toLocaleString("es-CL")} consultas al mes`;
}

const pesos = (n) => `$${n.toLocaleString("es-CL")}`;

/** Precio en pesos, que es como compran las universidades, y el de lista que se
 *  muestra tachado mientras dure el descuento de lanzamiento (NULL en la base =
 *  sin tachado). Si el servidor aún no entrega `precio_mensual_clp` —una base
 *  sin la migración 014—, se muestra el de dólares antes que un precio vacío. */
function precio(plan) {
  if (plan.precio_mensual_clp) {
    return {
      cifra: pesos(plan.precio_mensual_clp),
      nota: "/mes + IVA",
      lista: plan.precio_lista_clp > plan.precio_mensual_clp ? pesos(plan.precio_lista_clp) : null,
    };
  }
  return { cifra: `US$ ${plan.precio_mensual_usd.toLocaleString("es-CL")}`, nota: "/mes", lista: null };
}

/** Colores de la tarjeta. La recomendada va invertida —fondo blanco, letra
 *  negra— para destacar sin salir del blanco y negro de la plataforma. */
const TEMAS = {
  normal: {
    tarjeta: "bg-panel border-white/10 text-white",
    sello: "",
    bajada: "text-white/70",
    nota: "text-outlineSoft",
    tachado: "text-white/45",
    descuento: "text-positive border-positive/50",
    divisoria: "border-white/10",
    item: "text-white/90",
    detalle: "text-outlineSoft",
    check: "text-positive",
    candado: "text-outlineSoft",
    foco: "focus-visible:ring-white focus-visible:ring-offset-black",
  },
  invertido: {
    tarjeta: "bg-white border-white text-black",
    sello: "bg-black text-white",
    bajada: "text-black/70",
    nota: "text-black/55",
    tachado: "text-black/45",
    descuento: "text-[#1f7a3d] border-[#1f7a3d]/50",
    divisoria: "border-black/10",
    item: "text-black/85",
    detalle: "text-black/55",
    check: "text-[#1f7a3d]",
    candado: "text-black/40",
    foco: "focus-visible:ring-black focus-visible:ring-offset-white",
  },
};

/** Qué incluye cada plan, en palabras de quien lo compra. Las reglas de acceso
 *  (THE y QS, predicciones, descargas) salen de `backend/app/acceso.py`: si
 *  cambian allí, hay que cambiarlas aquí. Las cuotas vienen de la base. */
function incluye(plan) {
  const gratis = plan.precio_mensual_usd === 0;
  const lineas = gratis
    ? [
        { si: true, texto: "Rankings Scimago, Shanghai y Ranking KAI" },
        { si: true, texto: "Tendencias, simulación y glosario" },
        { si: true, texto: "Un informe PDF y uno Excel por módulo" },
        { si: false, texto: "Rankings THE y QS" },
      ]
    : [
        { si: true, texto: "Todos los rankings, incluidos THE y QS" },
        { si: true, texto: "Simulación con predicciones" },
        { si: true, texto: "Informes PDF y Excel sin límite" },
      ];

  // El gratuito trae un número fijo de consultas por cuenta que no se repone
  // (migración 016); los de pago, cuotas mensuales.
  lineas.push({
    si: true,
    texto: gratis
      ? `Asistente con IA: ${plan.mensajes_totales ?? 3} consultas de prueba`
      : `Asistente con IA: ${plan.mensajes_por_dia == null ? "sin tope diario" : `hasta ${plan.mensajes_por_dia} consultas al día`}`,
    detalle: gratis ? "Motor Gemini · por cuenta, no se reponen"
      : `Gemini ${consultas(plan.tokens_gemini_mes, "gemini")} · Claude ${consultas(plan.tokens_claude_mes, "claude")}`,
  });
  if (gratis) lineas.push({ si: false, texto: "Motor Claude, de razonamiento profundo" });
  return lineas;
}

/** Los planes de la portada, con precio en pesos y un botón de contratación
 *  que se distinga a simple vista de todo lo demás. */
export default function Planes({ planes, onElegir }) {
  if (!planes.length) {
    return <p className="text-sm text-outlineSoft">Cargando planes…</p>;
  }

  // Se destaca el plan de pago más barato: es la conversión que interesa, y
  // destacar el más caro se lee como venta agresiva.
  const recomendado = planes.find((p) => p.precio_mensual_usd > 0)?.codigo_plan;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {planes.map((p) => {
        const destacado = p.codigo_plan === recomendado;
        const gratis = p.precio_mensual_usd === 0;
        const t = TEMAS[destacado ? "invertido" : "normal"];
        const { cifra, nota, lista } = precio(p);
        return (
          <motion.article
            key={p.codigo_plan}
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className={`relative flex flex-col p-6 border ${t.tarjeta}`}
          >
            {destacado && (
              <span className={`absolute -top-3 left-6 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border border-white/40 ${t.sello}`}>
                Recomendado
              </span>
            )}

            <h3 className="font-headline text-2xl">{p.nombre_plan}</h3>
            {/* Tres líneas reservadas: con descripciones de largo distinto, los
                precios y los botones quedarían a alturas distintas en la fila. */}
            <p className={`mt-2 text-[14px] leading-snug sm:min-h-[3.9rem] ${t.bajada}`}>{p.descripcion}</p>

            {/* Tres filas de alto fijo —rótulo, precio y condiciones— que existen
                también en el gratuito, para que los precios de todas las
                tarjetas queden a la misma altura. */}
            <div className="mt-4 h-[22px]">
              {lista && (
                <span className={`inline-block px-1.5 py-0.5 border text-[10.5px] font-bold uppercase tracking-wider ${t.descuento}`}>
                  Descuento de lanzamiento
                </span>
              )}
            </div>
            <p className="mt-2 flex items-baseline gap-2.5">
              <span className="font-headline text-[34px] leading-none">{gratis ? "Gratis" : cifra}</span>
              {lista && (
                <span className={`text-[17px] leading-none line-through ${t.tachado}`} aria-label={`Antes ${lista}`}>{lista}</span>
              )}
            </p>
            <p className={`mt-1.5 text-[13px] ${t.nota}`}>{gratis ? "Sin tarjeta ni contrato" : nota}</p>

            <button
              onClick={() => onElegir(p)}
              className={`group mt-6 w-full flex items-center justify-center gap-2 px-3 py-3.5 font-boton text-[14px] font-semibold uppercase tracking-wider whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${t.foco} ${
                // Borde en los tres, del color del fondo en los rellenos: si solo
                // lo tuviera el de contorno, mediría 4 px más que los otros.
                gratis
                  ? "border-2 border-white/60 text-white hover:bg-white hover:text-black"
                  : destacado
                    ? "border-2 border-black bg-black text-white hover:bg-black/80 hover:border-black/0"
                    : "border-2 border-white bg-white text-black hover:bg-white/85 hover:border-white/0"
              }`}
            >
              {gratis ? "Crear cuenta gratis" : "Contratar ahora"}
              <Flecha />
            </button>

            <ul className={`mt-6 flex flex-col gap-3 border-t pt-5 ${t.divisoria}`}>
              {incluye(p).map(({ si, texto, detalle }) => (
                <li key={texto} className={`flex items-start gap-2.5 ${si ? "" : "opacity-50"}`}>
                  <span className={`mt-0.5 shrink-0 ${si ? t.check : t.candado}`}>
                    {si ? <Check /> : <Candado />}
                  </span>
                  <span className={`text-[14px] leading-snug ${t.item}`}>
                    {si ? texto : `Sin ${texto.charAt(0).toLowerCase()}${texto.slice(1)}`}
                    {detalle && <span className={`block text-[12px] mt-0.5 ${t.detalle}`}>{detalle}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </motion.article>
        );
      })}
    </div>
  );
}
