import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Lenis from "@studio-freight/lenis";

import Header from "./components/Header";
import { AuthProvider } from "./auth/AuthContext";
import RutaProtegida from "./auth/RutaProtegida";
import Landing from "./pages/Landing";
import Ranking from "./pages/Ranking";
import Tendencias from "./pages/Tendencias";
import Simulacion from "./pages/Simulacion";
import Metricas from "./pages/Metricas";
import Asistente from "./pages/Asistente";
import Cientificos from "./pages/Cientificos";
import InvestigadoresPUCV from "./pages/InvestigadoresPUCV";



function AppContent() {
  const location = useLocation();
  const isLanding = location.pathname === "/";

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
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/tendencias" element={<Tendencias />} />
        <Route path="/simulacion" element={<Navigate to="/simulacion/comparada" replace />} />
        <Route path="/simulacion/:modo" element={<Simulacion />} />
        <Route path="/metricas" element={<Metricas />} />
        <Route path="/cientificos" element={<Cientificos />} />
        <Route path="/investigadores-pucv" element={<InvestigadoresPUCV />} />
        <Route
          path="/asistente"
          element={
            <RutaProtegida motivo="El asistente consume tokens de un servicio de IA de pago, por lo que su uso se controla por cuenta. Al iniciar sesión también se guardan tus conversaciones.">
              <Asistente />
            </RutaProtegida>
          }
        />
        <Route path="*" element={<h1>404</h1>} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;