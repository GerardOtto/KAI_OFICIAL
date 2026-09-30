import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import bgImage from "../assets/La_scuola_di_Atene.jpg";
import muestra from "../assets/muestra.jpg";
import AuthModal from "../components/AuthModal";
import Header from "../components/Header";
import Planes from "../components/landing/Planes";
import { usePlanes } from "../hooks/useConversaciones";
import { useAuth } from "../auth/AuthContext";

// La portada fue un chat interactivo, y en las pruebas con usuarios nuevos nadie
// sabía qué se podía pulsar. Ahora es una página que se lee de arriba abajo: qué
// es KAI, cuánto cuesta y cómo se empieza, con botones que parecen botones.

const icono = (d) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
       aria-hidden="true">{d}</svg>
);

const CAPACIDADES = [
  {
    titulo: "Rankings en un solo lugar",
    texto: "THE, QS, Scimago, Shanghai y el Ranking KAI, año a año.",
    icono: icono(<><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>),
  },
  {
    titulo: "Tendencias y comparaciones",
    texto: "Cómo evoluciona cada indicador y cómo te comparas con otras universidades.",
    icono: icono(<><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></>),
  },
  {
    titulo: "Simulación",
    texto: "Qué pasaría con tu puntaje si mejoras un indicador.",
    icono: icono(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>),
  },
  {
    titulo: "Asistente con IA",
    texto: "Pregunta en palabras simples y responde con los datos de la plataforma.",
    icono: icono(<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />),
  },
];

const PASOS = [
  ["Elige un plan", "Puedes empezar gratis y cambiar de plan cuando quieras."],
  ["Crea tu cuenta", "Con Google es un clic. Si usas tu correo universitario, reconocemos tu institución."],
  ["Pregunta al asistente", "Al entrar llegas directo al asistente: escríbele lo que necesitas saber."],
];

const FUNDAMENTOS = [
  {
    titulo: "Fuentes oficiales",
    texto: "Los rankings THE, QS, Scimago y Shanghai, y los datos que las universidades informan al " +
      "Estado (SIES y ANID). Cuando una cifra es una estimación, la plataforma lo indica.",
  },
  {
    titulo: "Análisis que cruza fuentes",
    texto: "Relaciona indicadores de distintos rankings para ver en qué es fuerte tu institución y " +
      "dónde tiene más margen de mejora.",
  },
];

/** Desplaza hasta una sección, con el desplazamiento suave de la página si está. */
function irA(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (window.lenis) window.lenis.scrollTo(el, { offset: -72 });
  else el.scrollIntoView({ behavior: "smooth" });
}

function Seccion({ id, eyebrow, titulo, bajada, children, className = "" }) {
  return (
    <section id={id} className={`px-4 sm:px-8 py-16 sm:py-24 ${className}`}>
      <div className="max-w-6xl mx-auto">
        <p className="text-[12px] uppercase tracking-[0.2em] text-outlineSoft mb-3">{eyebrow}</p>
        <h2 className="font-headline text-3xl sm:text-4xl font-bold text-white">{titulo}</h2>
        {bajada && <p className="mt-3 text-[16px] text-white/70 max-w-2xl leading-relaxed">{bajada}</p>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

export default function Landing() {
  const [auth, setAuth] = useState(null); // null | "login" | "register"
  const [mostrarCita, setMostrarCita] = useState(false);
  const planes = usePlanes();
  const { usuario } = useAuth();
  const navigate = useNavigate();

  // Quien llega desde «Ver planes» (por ejemplo, desde el selector de motor del
  // asistente) espera encontrarlos, no la parte de arriba de la página.
  useEffect(() => {
    if (window.location.hash === "#planes" && planes.length) irA("planes");
  }, [planes.length]);

  /** Con sesión se va directo al asistente; sin ella, se pide y después se va. */
  const entrar = (pestana = "login") => (usuario ? navigate("/asistente") : setAuth(pestana));

  return (
    <div className="min-h-screen flex flex-col bg-[#0e0e0e] font-body text-white">
      <Header />

      <main className="flex-1">
        {/* Presentación: qué es KAI en una frase, y los dos caminos posibles. */}
        <section className="relative overflow-hidden px-4 sm:px-8 pt-14 pb-10 sm:pt-20 sm:pb-12">
          <div className="absolute inset-0 bg-cover bg-center grayscale contrast-110 brightness-[0.55]"
               style={{ backgroundImage: `url(${bgImage})` }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-[#0e0e0e]" />

          <div className="relative max-w-6xl mx-auto">
            <p className="text-[12px] uppercase tracking-[0.25em] text-white/70 mb-5">
              Evolución dato a dato
            </p>
            <h1 className="font-headline text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] max-w-3xl">
              Entiende y mejora la posición de tu universidad en los rankings
            </h1>
            <p className="mt-6 text-[17px] sm:text-lg text-white/85 max-w-2xl leading-relaxed">
              KAI reúne los principales rankings universitarios y los datos oficiales de las
              universidades chilenas en una sola plataforma. Consulta, compara, simula y pregúntale
              a un asistente con inteligencia artificial.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => irA("planes")}
                className="px-7 py-4 bg-white text-black text-[15px] font-bold hover:bg-white/85 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                Ver planes y precios
              </button>
              <button
                onClick={() => entrar("login")}
                className="px-7 py-4 border-2 border-white/60 text-white text-[15px] font-bold hover:bg-white hover:text-black transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {usuario ? "Ir al asistente" : "Ya tengo cuenta"}
              </button>
            </div>

            <ul className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {CAPACIDADES.map(({ titulo, texto, icono: ic }) => (
                <li key={titulo} className="flex gap-3 bg-black/45 border border-white/10 backdrop-blur-sm p-4">
                  <span className="text-accent shrink-0 mt-0.5">{ic}</span>
                  <span>
                    <span className="block text-[15px] font-semibold">{titulo}</span>
                    <span className="block mt-1 text-[13.5px] text-white/70 leading-snug">{texto}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <Seccion
          id="planes"
          eyebrow="Planes"
          titulo="Elige tu plan"
          bajada="Precios mensuales en pesos chilenos, más IVA. Puedes empezar gratis y cambiar de plan cuando quieras."
          className="pt-8 sm:pt-12"
        >
          <Planes planes={planes} onElegir={() => entrar("register")} />
          <p className="mt-6 text-[13px] text-outlineSoft max-w-3xl leading-relaxed">
            Las consultas al asistente son aproximadas: cada plan trae una cuota mensual y se descuenta
            lo que realmente se usa. Por ahora, el asistente está disponible para cuentas de la PUCV.
          </p>
        </Seccion>

        <Seccion id="empezar" eyebrow="Cómo empezar" titulo="Tres pasos" className="bg-panel">
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PASOS.map(([titulo, texto], i) => (
              <li key={titulo} className="flex gap-4">
                <span className="shrink-0 w-10 h-10 flex items-center justify-center border-2 border-white/60 font-headline text-lg">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-[16px] font-semibold">{titulo}</span>
                  <span className="block mt-1 text-[14px] text-white/70 leading-relaxed">{texto}</span>
                </span>
              </li>
            ))}
          </ol>
          <button
            onClick={() => (usuario ? navigate("/asistente") : irA("planes"))}
            className="mt-10 px-7 py-4 bg-white text-black text-[15px] font-bold hover:bg-white/85 transition-colors"
          >
            {usuario ? "Ir al asistente" : "Elegir un plan"}
          </button>
        </Seccion>

        <Seccion id="datos" eyebrow="Los datos" titulo="¿De dónde salen los datos?">
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8 items-start">
            <div>
              <img src={muestra} alt="Muestra de datos KAI" className="grayscale w-full border border-white/15" />
              <button onClick={() => setMostrarCita(true)} className="mt-3 text-left border-l-2 border-white pl-3 group">
                <span className="block font-headline text-[14px] italic text-white/80 leading-snug group-hover:text-white">
                  "Una piedra se esconde entre las piedras, y un hombre entre los hombres."
                </span>
                <span className="block mt-1 text-[12px] text-outlineSoft underline underline-offset-2">
                  Leer qué significa
                </span>
              </button>
            </div>
            <div className="flex flex-col gap-7">
              {FUNDAMENTOS.map(({ titulo, texto }) => (
                <div key={titulo}>
                  <h3 className="text-[17px] font-bold">{titulo}</h3>
                  <p className="mt-2 text-[15px] text-white/75 leading-relaxed max-w-2xl">{texto}</p>
                </div>
              ))}
            </div>
          </div>
        </Seccion>
      </main>

      <footer className="border-t border-white/10 flex flex-col md:flex-row justify-between items-center px-6 sm:px-12 py-6 gap-4">
        <p className="text-[12px] text-outlineSoft">© 2026 KAI. Todos los derechos reservados.</p>
        <div className="flex flex-wrap justify-center gap-6">
          {["Privacidad", "Términos de uso", "Propiedad intelectual", "Contacto y soporte"].map((item) => (
            <a key={item} href="#" className="text-[12px] text-outlineSoft hover:text-white transition-colors">
              {item}
            </a>
          ))}
        </div>
      </footer>

      {auth && (
        <AuthModal inicial={auth} onClose={() => setAuth(null)} onExito={() => navigate("/asistente")} />
      )}

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
