import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Lenis from "@studio-freight/lenis";

import Header from "./components/Header";
import Landing from "./pages/Landing";
import Ranking from "./pages/Ranking";
import Tendencias from "./pages/Tendencias";
import Simulacion from "./pages/Simulacion";
import Metricas from "./pages/Metricas";

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
        <Route path="/simulacion" element={<Simulacion />} />
        <Route path="/metricas" element={<Metricas />} />
        <Route path="*" element={<h1>404</h1>} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;