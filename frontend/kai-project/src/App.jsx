import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import Tendencias from "./pages/Tendencias";
import Simulacion from "./pages/Simulacion";
import Ranking from "./pages/Ranking";

function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Navigate to="/tendencias" replace />} />
        <Route path="/tendencias" element={<Tendencias />} />
        <Route path="/simulacion" element={<Simulacion />} />
        <Route path="*" element={<h1>404 - Página no encontrada</h1>} />
        <Route path="/ranking" element={<Ranking />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;