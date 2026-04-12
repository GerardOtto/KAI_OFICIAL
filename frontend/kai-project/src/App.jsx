import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Tendencias from "./pages/Tendencias";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Ruta principal */}
        <Route path="/" element={<Navigate to="/tendencias" replace />} />

        {/* Página Tendencias */}
        <Route path="/tendencias" element={<Tendencias />} />

        {/* Fallback (opcional) */}
        <Route path="*" element={<h1>404 - Página no encontrada</h1>} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;