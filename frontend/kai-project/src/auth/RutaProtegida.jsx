import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

/**
 * Envuelve una vista que exige sesión iniciada. Sin sesión no hay pantalla de
 * bloqueo: se vuelve a la portada con el módulo pedido en el estado de la
 * navegación, y el encabezado abre allí el aviso para entrar
 * (components/SesionRequerida.jsx), que al iniciar sesión lleva al módulo.
 *
 * Lo normal es no llegar aquí sin sesión, porque los enlaces del encabezado ya
 * abren el aviso sin navegar; esto cubre la dirección escrita o guardada.
 */
export default function RutaProtegida({ children }) {
  const { autenticado, cargando } = useAuth();
  const location = useLocation();

  if (cargando) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-outlineSoft text-sm">
        Verificando sesión…
      </div>
    );
  }

  if (autenticado) return children;

  return <Navigate to="/" replace state={{ requiere: location.pathname + location.search }} />;
}
