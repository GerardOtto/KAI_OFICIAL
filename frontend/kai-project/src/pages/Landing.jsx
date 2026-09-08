import { useState, useRef, useEffect, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import logo from "../assets/logo.png";
import bgImage from "../assets/La_scuola_di_Atene.jpg";
import muestra from "../assets/muestra.jpg";
import AuthModal from "../components/AuthModal";
import Header from "../components/Header";
import PlanesChat from "../components/landing/PlanesChat";
import { usePlanes } from "../hooks/useConversaciones";
import { useAuth } from "../auth/AuthContext";

const SparkleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z" />
  </svg>
);

const SendIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 21 23 12 2 3v7l15 2-15 2z" />
  </svg>
);

const ESCUDO = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const BRUJULA = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="3" /><line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" />
    <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" /><line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
    <line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" />
    <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" /><line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
  </svg>
);

/** Las tres preguntas que organizan la portada. Cada una es un turno de la
 *  conversación: al pulsarla se añade la pregunta y su respuesta, en vez de
 *  desplazar la página a una sección. */
const PREGUNTAS = [
  { id: "que", texto: "¿Qué puedo consultar aquí?" },
  { id: "datos", texto: "¿De dónde salen los datos?" },
  { id: "precio", texto: "¿Cuánto cuesta?" },
];

const CAPACIDADES = [
  ["Rankings", "Posiciones y puntajes de THE, QS, Scimago y Shanghai, año a año."],
  ["Tendencias", "La evolución de una métrica y la comparación entre instituciones."],
  ["Simulación", "Qué pasaría con el puntaje si una métrica cambiara."],
  ["Investigadores", "Producción y campos de estudio del cuerpo académico."],
];

const FUNDAMENTOS = [
  {
    icono: ESCUDO,
    titulo: "Datos confiables y metodología de vanguardia",
    texto: "Todas las fuentes del repositorio KAI son oficiales o investigadas de primera mano, asegurando una fidelidad a los datos públicos del 99.9%.",
    relleno: true,
  },
  {
    icono: BRUJULA,
    titulo: "Muestreo y análisis avanzado",
    texto: "Descubre conexiones entre distintos campos de estudio para que puedas trabajar en tus puntos fuertes y débiles de manera transversal.",
    relleno: false,
  },
];

/** Burbuja del asistente. `ancha` la deja ocupar todo el ancho disponible, que
 *  es lo que necesitan los planes para caber en dos columnas. */
function Respuesta({ children, ancha = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex items-start gap-3"
    >
      <div className="w-7 h-7 shrink-0 flex items-center justify-center border border-white/25 bg-black/50 text-white mt-0.5">
        <SparkleIcon />
      </div>
      <div className={`min-w-0 ${ancha ? "flex-1" : "max-w-2xl"}`}>{children}</div>
    </motion.div>
  );
}

function Pregunta({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex justify-end"
    >
      <div className="max-w-xl bg-white/10 border border-white/20 backdrop-blur-sm px-5 py-3">
        <p className="text-[13px] text-white">{children}</p>
      </div>
    </motion.div>
  );
}

export default function Landing() {
  const [mostrarAuth, setMostrarAuth] = useState(false);
  const [mostrarCita, setMostrarCita] = useState(false);
  const [turnos, setTurnos] = useState([]);
  const planes = usePlanes();
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const hiloRef = useRef(null);

  useEffect(() => {
    hiloRef.current?.scrollTo({ top: hiloRef.current.scrollHeight, behavior: "smooth" });
  }, [turnos]);

  // Quien llega desde «Ver planes» (por ejemplo, desde el selector de motor del
  // asistente) espera encontrarlos, no una pregunta que aún hay que pulsar.
  useEffect(() => {
    if (window.location.hash === "#planes") setTurnos(["precio"]);
  }, []);

  const preguntar = (id) => setTurnos((prev) => (prev.includes(id) ? prev : [...prev, id]));

  /** Entrar al asistente: si ya hay sesión se va directo; si no, se pide. */
  const entrar = () => (usuario ? navigate("/asistente") : setMostrarAuth(true));

  const pendientes = PREGUNTAS.filter((p) => !turnos.includes(p.id));

  /** El contenido de cada respuesta, indexado por la pregunta que la abre.
   *
   *  Va en un mapa y no en el orden del JSX porque los turnos se pintan en el
   *  orden en que el usuario pulsó, no en el que están escritos aquí. */
  const RESPUESTAS = {
    que: {
      contenido: (
        <>
          <p className="text-[13px] text-white/85 leading-relaxed mb-3">
            Cuatro módulos sobre la misma base de datos, y un asistente que la consulta por ti:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CAPACIDADES.map(([titulo, texto]) => (
              <div key={titulo} className="border-l-2 border-white/30 pl-3 py-1">
                <p className="text-[12px] font-semibold text-white">{titulo}</p>
                <p className="text-[11px] text-white/70 leading-relaxed">{texto}</p>
              </div>
            ))}
          </div>
        </>
      ),
    },

    datos: {
      contenido: (
        <div className="flex flex-col sm:flex-row gap-5">
          <div className="shrink-0">
            <img src={muestra} alt="Muestra de datos KAI"
                 className="grayscale w-full sm:w-40 border border-white/15" />
            <button
              onClick={() => setMostrarCita(true)}
              className="mt-2 block text-left w-full sm:w-40 border-l-2 border-white pl-2 py-1 group"
            >
              <p className="font-headline text-[11px] italic text-white/80 leading-snug group-hover:text-white transition-colors">
                "Una piedra se esconde entre las piedras, y un hombre entre los hombres."
              </p>
              <span className="font-mono text-[8px] uppercase tracking-widest text-outlineSoft">
                Qué significa
              </span>
            </button>
          </div>
          <div className="flex flex-col gap-4 min-w-0">
            {FUNDAMENTOS.map(({ icono, titulo, texto, relleno }) => (
              <div key={titulo} className="flex gap-3">
                <div className={`h-9 w-9 flex items-center justify-center shrink-0 ${
                  relleno ? "bg-white text-black" : "border border-white/30 text-white"
                }`}>
                  {icono}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[13px] text-white mb-1">{titulo}</p>
                  <p className="text-[11.5px] text-white/75 leading-relaxed">{texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },

    precio: {
      ancha: true,
      contenido: (
        <div id="planes">
          <PlanesChat planes={planes} onElegir={entrar} />
        </div>
      ),
    },
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-[#0e0e0e] font-body">
      {/* La ilustración de la portada anterior, ahora como fondo del chat. */}
      <div
        className="fixed inset-0 bg-cover bg-center grayscale contrast-110 brightness-[0.8]"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      {/* El velo se mantiene bajo: la ilustración tiene que verse, y el contraste
          del texto lo aporta el propio recuadro, que va sobre fondo opaco. */}
      <div className="fixed inset-0 bg-black/25" />
      <div className="fixed inset-0 bg-gradient-to-b from-black/50 via-black/20 to-[#0e0e0e]" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />

        <main className="flex-1 flex items-center justify-center px-4 sm:px-8 py-8">
          <div className="w-full max-w-4xl flex flex-col border border-white/15 bg-black/60 backdrop-blur-md shadow-2xl"
               style={{ height: "min(78vh, 780px)" }}>

            {/* Barra del recuadro de chat */}
            <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <img src={logo} alt="KAI" style={{ height: "18px", filter: "invert(1)" }} />
                <div className="min-w-0">
                  <p className="font-label text-[11px] uppercase tracking-[0.2em] text-white truncate">
                    Inteligencia académica
                  </p>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-outlineSoft truncate">
                    Bibliometría digital de academia
                  </p>
                </div>
              </div>
              <span className="hidden sm:flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-outlineSoft shrink-0">
                <span className="w-1.5 h-1.5 bg-positive rounded-full" /> En línea
              </span>
            </div>

            {/* Hilo. data-lenis-prevent evita que el desplazamiento suave de la
                página se coma el de este panel. */}
            <div ref={hiloRef} data-lenis-prevent
                 className="flex-1 overflow-y-auto px-5 sm:px-7 py-6">
              {/* `min-h-full` + `justify-end` asientan la conversación abajo
                  mientras es corta —como en un chat recién abierto— y la dejan
                  crecer con normalidad cuando desborda. Poner `justify-end` en
                  el propio contenedor con scroll recortaría el principio del
                  contenido al desbordar. */}
              <div className="min-h-full flex flex-col justify-end gap-6">

              <Respuesta>
                <h1 className="font-headline text-4xl sm:text-5xl font-bold tracking-tighter text-white leading-[0.95] mb-3">
                  Evolución
                  <span className="block text-white/80">dato a dato</span>
                </h1>
                <p className="text-[13px] sm:text-sm text-white/85 leading-relaxed">
                  Accede a insights construidos a través de ciencia de datos y visualiza las tendencias y
                  patrones ocultos en la medición global de desempeño académico.
                </p>
              </Respuesta>

              {/* Los turnos se pintan recorriendo `turnos`, que guarda el orden
                  en que se pulsaron las preguntas. Pintarlos con tres bloques
                  fijos los dejaba siempre en el orden del código: pulsar la
                  tercera y luego la primera colocaba la primera por encima. */}
              {turnos.map((id) => {
                const pregunta = PREGUNTAS.find((p) => p.id === id);
                const respuesta = RESPUESTAS[id];
                if (!pregunta || !respuesta) return null;
                return (
                  <Fragment key={id}>
                    <Pregunta>{pregunta.texto}</Pregunta>
                    <Respuesta ancha={respuesta.ancha}>{respuesta.contenido}</Respuesta>
                  </Fragment>
                );
              })}

              {/* Sugerencias pendientes: son la navegación de la portada. */}
              {pendientes.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-end pt-1">
                  {pendientes.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => preguntar(p.id)}
                      className="px-4 py-2 border border-white/25 bg-black/30 text-[12px] text-white/85 hover:bg-white hover:text-black hover:border-white transition-colors"
                    >
                      {p.texto}
                    </button>
                  ))}
                </div>
              )}
              </div>
            </div>

            {/* Compositor: no envía nada, lleva al asistente de verdad. */}
            <div className="shrink-0 border-t border-white/10 px-5 sm:px-7 py-4">
              <button
                onClick={entrar}
                className="w-full flex items-center gap-3 bg-black/40 border border-white/20 px-4 py-3 text-left hover:border-white/50 transition-colors group"
              >
                <span className="font-mono text-[10px] text-outlineSoft shrink-0">KAI_PROMPT_</span>
                <span className="flex-1 text-[13px] text-white/50 truncate">
                  {usuario ? "Continuar al asistente…" : "Inicia sesión para empezar a consultar…"}
                </span>
                <span className="text-white/60 group-hover:text-white transition-colors shrink-0">
                  <SendIcon />
                </span>
              </button>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-outlineSoft">
                Consulta la base de datos real · No inventa cifras
              </p>
            </div>
          </div>
        </main>

        <footer className="shrink-0 border-t border-white/5 bg-black/40 backdrop-blur-sm flex flex-col md:flex-row justify-between items-center px-6 sm:px-12 py-5 gap-4">
          <p className="text-[10px] uppercase tracking-widest text-outline">
            © 2025 KAI. Todos los derechos reservados.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {["Privacidad", "Términos de uso", "Propiedad intelectual", "Contacto y soporte"].map((item) => (
              <a key={item} href="#" className="text-[10px] uppercase tracking-widest text-outline hover:text-white transition-colors">
                {item}
              </a>
            ))}
          </div>
        </footer>
      </div>

      {mostrarAuth && <AuthModal onClose={() => setMostrarAuth(false)} />}

      <AnimatePresence>
        {mostrarCita && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-y-auto"
            onClick={() => setMostrarCita(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-2xl p-10 text-white"
            >
              <motion.div
                initial={{ width: 0 }} animate={{ width: "100%" }} exit={{ width: 0 }}
                transition={{ duration: 0.8 }}
                className="h-[2px] bg-white mb-6"
              />

              <motion.h2
                initial={{ opacity: 0, letterSpacing: "0.2em" }}
                animate={{ opacity: 1, letterSpacing: "0.05em" }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="text-xl font-bold mb-6"
              >
                Significado
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 1 }}
                className="leading-relaxed text-sm md:text-base text-white/90"
              >
                La frase "Una piedra se esconde entre las piedras, y un hombre entre los hombres"
                constituye el principio estratégico central en <i>La fortaleza escondida</i>, donde el
                general Rokurota Makabe protege a la princesa Yuki no ocultándola, sino integrándola
                completamente en lo cotidiano: haciéndola pasar por una campesina muda y atravesando
                territorio enemigo a plena vista.
              </motion.p>

              <motion.ul
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 1 }}
                className="mt-6 space-y-3 text-white/80 text-sm md:text-base"
              >
                <li><b>Estrategia de camuflaje:</b> lo valioso no se esconde, se disuelve en lo común.</li>
                <li><b>Desmitificación de la realeza:</b> la princesa Yuki experimenta directamente la vida del pueblo, rompiendo la distancia simbólica del poder.</li>
                <li><b>Simbolismo del oro:</b> la riqueza se transporta oculta dentro de haces de leña, reforzando la lógica de invisibilidad.</li>
              </motion.ul>

              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 1.1, duration: 1 }}
                className="mt-8 text-white/80 text-sm md:text-base leading-relaxed italic"
              >
                Fiel a la frase, tanto este proyecto como la historia no se cuenta desde el punto de vista
                de los héroes épicos, sino a través de los ojos de dos campesinos comunes y codiciosos
                (Tahei y Matashichi, o F y G), quienes "esconden" la magnitud de la épica dentro de una
                comedia de aventuras.
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 0.4 }}
                transition={{ delay: 1.2, duration: 1 }}
                className="mt-10 text-xs tracking-widest text-white/40"
              >
                (click para cerrar)
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
