import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import Lenis from "@studio-freight/lenis";

import Header from "./components/Header";
import { AuthProvider } from "./auth/AuthContext";
import { ModoValoresProvider } from "./estado/ModoValores";
import RutaProtegida from "./auth/RutaProtegida";
import Landing from "./pages/Landing";
import NoEncontrada from "./pages/NoEncontrada";

// La portada es pública y la primera que se ve: va en el paquete inicial. Los
// módulos, que exigen sesión, se descargan al entrar a cada uno; antes todo
// viajaba en un único archivo de 1,5 MB que también pagaba quien solo miraba la
// portada.
const Ranking = lazy(() => import("./pages/Ranking"));
const Tendencias = lazy(() => import("./pages/Tendencias"));
const Simulacion = lazy(() => import("./pages/Simulacion"));
const Metricas = lazy(() => import("./pages/Metricas"));
const Asistente = lazy(() => import("./pages/Asistente"));

const CargandoModulo = () => (
  <div className="min-h-[60vh] flex items-center justify-center text-outlineSoft text-sm" role="status">
    Cargando…
  </div>
);
import InstitucionPendiente from "./components/InstitucionPendiente";
import { useAuth } from "./auth/AuthContext";



// Título de la pestaña por sección: con uno solo para todas, el historial del
// navegador y los lectores de pantalla no distinguían dónde se estaba.
const TITULOS = [
  ["/ranking", "Resumen"],
  ["/tendencias", "Tendencias"],
  ["/simulacion", "Simulación"],
  ["/metricas", "Glosario"],
  ["/asistente", "Asistente"],
];

function AppContent() {
  const location = useLocation();
  const isLanding = location.pathname === "/";

  useEffect(() => {
    const seccion = isLanding ? null
      : TITULOS.find(([ruta]) => location.pathname.startsWith(ruta))?.[1] ?? "Página no encontrada";
    document.title = seccion ? `${seccion} · KAI` : "KAI · Key Academic Indicator";
  }, [location.pathname, isLanding]);
  // La institución es obligatoria y el acceso con Google no la pregunta: se
  // reclama sobre cualquier vista salvo la portada, que es pública.
  const { institucionPendiente } = useAuth();

  useEffect(() => {
    if (!isLanding) {
      if (window.lenis) {
        window.lenis.destroy();
        window.lenis = null;
      }
      return;
    }

    const lenis = new Lenis({
      duration: 1.3,
      easing: (t) => 1 - Math.pow(1 - t, 5),
      smoothWheel: true,
      smoothTouch: false
    });

    window.lenis = lenis;

    let rafId;
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      cancelAnimationFrame(rafId);
      window.lenis = null;
    };
  }, [isLanding]);

  return (
    <>

      {!isLanding && <Header />}
      {institucionPendiente && !isLanding && <InstitucionPendiente />}
      {/* Todos los módulos exigen sesión: la portada es lo único abierto, y sin
          sesión un módulo se pide con un aviso sobre ella. Las
          rutas antiguas del módulo de investigadores se redirigen en vez de
          devolver un 404, porque hay enlaces repartidos que aún apuntan a ellas. */}
      <Suspense fallback={<CargandoModulo />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/ranking" element={<RutaProtegida><Ranking /></RutaProtegida>} />
          <Route path="/tendencias" element={<RutaProtegida><Tendencias /></RutaProtegida>} />
          <Route path="/simulacion" element={<Navigate to="/simulacion/comparada" replace />} />
          <Route path="/simulacion/:modo" element={<RutaProtegida><Simulacion /></RutaProtegida>} />
          <Route path="/metricas" element={<RutaProtegida><Metricas /></RutaProtegida>} />
          <Route path="/cientificos" element={<Navigate to="/" replace />} />
          <Route path="/investigadores-pucv" element={<Navigate to="/" replace />} />
          <Route path="/asistente" element={<RutaProtegida><Asistente /></RutaProtegida>} />
          <Route path="*" element={<NoEncontrada />} />
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ModoValoresProvider>
          <AppContent />
        </ModoValoresProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;