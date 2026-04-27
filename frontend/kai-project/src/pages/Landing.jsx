import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import AuthModal from "../components/AuthModal";
import { motion, AnimatePresence } from "framer-motion";
import bgImage from "../assets/La_scuola_di_Atene.jpg";
import muestra from "../assets/muestra.jpg";
import Header from "../components/Header";



export default function Landing() {
  const [showAuth, setShowAuth] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">

      {/* Nav — sin links funcionales */}
      <Header />

      <main>
        <section className="relative min-h-screen flex items-center justify-center px-12 overflow-hidden bg-[#0e0e0e]">
          {/* Imagen de fondo */}
          <div
            className="absolute inset-0 bg-cover bg-center grayscale contrast-125 brightness-75"
            style={{
              backgroundImage: `url(${bgImage})`
            }}
          />
          {/* Sombra */}
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          {/* Fondo decorativo */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#131313]" />
          </div>
            <div className="relative z-10 max-w-5xl text-center">
            <div className="mb-10 inline-flex items-center gap-4 bg-black/20 px-4 py-1.5 border-l-2 border-white">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <span className="inline-block font-label text-[10px] uppercase tracking-[0.3em] text-white px-4 py-1.5 backdrop-blur-sm border border-white/10">
                Bibliometría digital de academia
              </span>
            </div>

            <h1 className="font-headline text-7xl md:text-8xl lg:text-9xl font-bold tracking-tighter text-white/90 leading-[0.9] mb-6 [text-shadow:0_2px_8px_rgba(0,0,0,0.5)]">
              Evolución
              <div className="text-white/80 [text-shadow:0_2px_6px_rgba(0,0,0,0.4)]">
                dato a dato
              </div>
            </h1>

            <p className="font-body text-lg md:text-xl text-white max-w-2xl mx-auto leading-relaxed opacity-80 mb-14">
              Accede a insights construidos a través de ciencia de datos y visualiza las tendencias y patrones ocultos en la medición global de desempeño académico.
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center active:scale-95 transition-transform">
              <button
                onClick={() => {
                  const el = document.getElementById("planes");
                
                  if (!el) return;
                
                  if (window.lenis) {
                    window.lenis.scrollTo(el);
                  } else {
                    el.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="bg-white text-black px-10 py-5 font-bold uppercase tracking-widest text-sm hover:bg-white/90 transition-all active:scale-95"
              >
                Obtén acceso
              </button>
              <button
                onClick={() => document.getElementById("sobre").scrollIntoView({ behavior: "smooth" })}
                className="border border-outline/40 text-white px-10 py-5 font-bold uppercase tracking-widest text-sm hover:bg-white/5 transition-colors"
              >
                Sobre nosotros
              </button>
            </div>
          </div>
        </section>

        {/* Planes */}
        <section id="planes" className="py-32 px-12 bg-background">
          <div className="max-w-7xl mx-auto">
            <div className="mb-20 flex flex-col md:flex-row justify-between items-end gap-8">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-outlineSoft mb-4">Acceso</p>
                <h2 className="font-headline text-5xl font-bold text-white mb-4">Suscripción a tu medida</h2>
                <p className="text-white text-lg max-w-md">
                Selecciona tu nivel de acceso a las diferentes herramientas y servicios de la plataforma.
                </p>
              </div>
              <div className="bg-surfaceHigh p-1 inline-flex shrink-0">
                <button className="bg-white text-black px-6 py-2 text-[11px] uppercase tracking-widest font-bold">Mensual</button>
                <button className="text-outlineSoft px-6 py-2 text-[11px] uppercase tracking-widest hover:text-white transition-colors">Anual</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {[
                {
                  tier: "Básico",
                  desc: "Acceso individual a rankings generales y métricas de desempeño institucional.",
                  highlight: false,
                  badge: null,
                  plans: [
                    { label: "Única institución", price: "$49", accent: false },
                    { label: "Nacional", price: "$89", accent: true },
                    { label: "Internacional", price: "$149", accent: false },
                  ]
                },
                {
                  tier: "Académico",
                  desc: "Acceso privilegiado a rankings por disciplina y métricas de desempeño.",
                  highlight: true,
                  badge: "Más popular",
                  plans: [
                    { label: "Única institución", price: "$129", accent: false },
                    { label: "Nacional", price: "$219", accent: true },
                    { label: "Internacional", price: "$389", accent: false },
                  ]
                },
                {
                  tier: "Institucional",
                  desc: "Acceso absoluto a rankings, proyecciones, bibliometría, dashboards y más.",
                  highlight: false,
                  badge: null,
                  plans: [
                    { label: "Única institución", price: "$899", accent: false },
                    { label: "Nacional", price: "$1,499", accent: false },
                    { label: "Internacional", price: "$4,999", accent: true },
                  ]
                }
              ].map(({ tier, desc, highlight, badge, plans }) => (
                <div key={tier} className="group flex flex-col">
                  <div className={`flex flex-col flex-1 p-10 border-t-2 transition-all duration-500 relative ${
                    highlight ? "bg-white/5 border-white" : "bg-surfaceHigh border-transparent group-hover:border-white"
                  }`}>
                    {badge && (
                      <div className="absolute -top-4 right-8 bg-white text-black px-3 py-1 text-[10px] font-bold uppercase tracking-tight">
                        {badge}
                      </div>
                    )}
                    <h3 className="font-headline text-3xl text-white mb-2">{tier}</h3>
                    <p className="text-outlineSoft text-[10px] uppercase tracking-widest mb-8 leading-relaxed">{desc}</p>
                    <div className="space-y-3">
                      {plans.map(({ label, price, accent }) => (
                        <div
                          key={label}
                          className={`p-5 flex items-center justify-between transition-colors cursor-pointer ${
                            accent
                              ? "bg-white/10 border-l-2 border-white"
                              : "bg-background/60 hover:bg-white/5"
                          }`}
                        >
                          <span className="text-white text-sm font-semibold">{label}</span>
                          <span className="font-headline text-xl text-white">
                            {price}<span className="text-[10px] uppercase font-label text-outlineSoft">/mo</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowAuth(true)}
                      className={`mt-8 w-full py-3 text-[11px] uppercase tracking-widest font-bold transition-all ${
                        highlight
                          ? "bg-white text-black hover:bg-white/80"
                          : "border border-outline/40 text-white hover:bg-white hover:text-black"
                      }`}
                    >
                      Comenzar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sobre nosotros */}
        <section id="sobre" className="py-32 px-12 bg-[#0e0e0e] grid grid-cols-1 lg:grid-cols-2 gap-24 items-center max-w-7xl mx-auto">
          <div className="relative">
            <div className="aspect-square bg-surfaceHigh flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src={muestra}
                  alt="KAI"
                  className="grayscale"
                  style={{ opacity: 1 }}
                />
              </div>
            </div>
            <div
            onClick={() => setShowQuote(true)}
            className="absolute -bottom-8 -right-8 bg-background p-8 border-l-4 border-white max-w-xs cursor-pointer"
            >
            <p className="font-headline text-lg italic text-white leading-snug">
                "Una piedra se esconde entre las piedras, y un hombre entre los hombres."
            </p>
            </div>
          </div>

          <div className="space-y-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-outlineSoft mb-4">Nuestra misión</p>
              <h2 className="font-headline text-5xl font-bold leading-tight text-white">
                La herramienta definitiva de desarrollo académico
              </h2>
            </div>
            <div className="space-y-8">
                {[
                    {
                    icon: (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                    ),
                    title: "Datos confiables y metodología de vanguardia",
                    desc: "Todas las fuentes del repositorio KAI son oficiales o investigadas de primera mano, asegurando una fidelidad a los datos públicos del 99.9%.",
                    filled: true
                    },
                    {
                    icon: (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
                        <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
                        <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
                        <line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>
                        </svg>
                    ),
                    title: "Muestreo y análisis avanzado",
                    desc: "Descubre conexiones entre distintos campos de estudio para que puedas trabajar en tus puntos fuertes y débiles de manera transversal.",
                    filled: false
                    }
                ].map(({ icon, title, desc, filled }) => (
                    <div key={title} className="flex gap-6">
                    <div className={`h-12 w-12 flex items-center justify-center shrink-0 ${filled ? "bg-white text-black" : "border border-outline/40 text-white"}`}>
                        {icon}
                    </div>
                    <div>
                        <h4 className="font-bold text-lg text-white mb-2">{title}</h4>
                        <p className="text-white leading-relaxed text-sm">
                        {desc}
                        </p>
                    </div>
                    </div>
                ))}
                </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-[#0e0e0e] border-t border-white/5 flex flex-col md:flex-row justify-between items-center px-12 py-10 gap-6">
        <div>
          <img src={logo} alt="KAI" style={{ height: "24px", filter: "invert(1)", marginBottom: "8px" }} />
          <p className="text-[10px] uppercase tracking-widest text-outline">
            © 2025 KAI. Todos los derechos reservados.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-8">
          {["Privacidad", "Términos de uso", "Propiedad intelectual", "Contacto y soporte"].map(item => (
            <a key={item} href="#" className="text-[10px] uppercase tracking-widest text-outline hover:text-white transition-colors">
              {item}
            </a>
          ))}
        </div>
      </footer>

      {/* Modal auth */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <AnimatePresence>
  {showQuote && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      onClick={() => setShowQuote(false)}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="max-w-2xl p-10 text-white"
      >
        {/* Línea Kurosawa */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          exit={{ width: 0 }}
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 1 }}
        className="leading-relaxed text-sm md:text-base text-white/90"
        >
        La frase "Una piedra se esconde entre las piedras, y un hombre entre los hombres" 
        constituye el principio estratégico central en <i>La fortaleza escondida</i>, donde el general Rokurota Makabe protege a la princesa Yuki no ocultándola, sino integrándola completamente en lo cotidiano: haciéndola pasar por una campesina muda y atravesando territorio enemigo a plena vista.
        </motion.p>

        <motion.ul
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 1 }}
        className="mt-6 space-y-3 text-white/80 text-sm md:text-base"
        >
        <li>
            <b>Estrategia de camuflaje:</b> lo valioso no se esconde, se disuelve en lo común.
        </li>
        <li>
            <b>Desmitificación de la realeza:</b> la princesa Yuki experimenta directamente la vida del pueblo, rompiendo la distancia simbólica del poder.
        </li>
        <li>
            <b>Simbolismo del oro:</b> la riqueza se transporta oculta dentro de haces de leña, reforzando la lógica de invisibilidad.
        </li>
        </motion.ul>

        <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 1 }}
        className="mt-8 text-white/80 text-sm md:text-base leading-relaxed italic"
        >
        Fiel a la frase, tanto este proyecto como la historia no se cuenta desde el punto de vista de los héroes épicos, sino a través de los ojos de dos campesinos comunes y codiciosos (Tahei y Matashichi, o F y G), quienes "esconden" la magnitud de la épica dentro de una comedia de aventuras.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
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