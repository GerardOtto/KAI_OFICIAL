import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Landing from "./pages/Landing";
import Ranking from "./pages/Ranking";
import Tendencias from "./pages/Tendencias";
import Simulacion from "./pages/Simulacion";
import Metricas from "./pages/Metricas";

function AppContent() {
  const location = useLocation();
  const isLanding = location.pathname === "/";

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