import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import SelectorInstitucion from "./SelectorInstitucion";

/** Reclama la institución a quien entró sin elegirla.
 *
 * El acceso con Google no pregunta nada: crea la cuenta con lo que Google
 * entrega. Como la institución es obligatoria desde ahora, se pide en la primera
 * sesión y no se puede posponer —de ahí que no haya botón de cerrar—, porque es
 * el dato con el que la plataforma agrupa a las personas por institución.
 *
 * No se cierra la sesión mientras tanto: la cuenta ya existe y es válida; lo que
 * falta es completarla.
 */
export default function InstitucionPendiente() {
  const { usuario, fijarInstitucion, cerrarSesion } = useAuth();
  const [institucion, setInstitucion] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (enviando || !institucion) return;
    setError("");
    setEnviando(true);
    try {
      await fijarInstitucion(institucion);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-[#0e0e0e] border border-outline/30">
        <div className="px-8 pt-8">
          <h2 className="font-headline text-[22px] font-semibold text-white mb-2">
            Falta tu institución
          </h2>
          <p className="font-body text-[12.5px] text-[#8a8a8a] leading-relaxed">
            {usuario?.nombre ? `${usuario.nombre.split(" ")[0]}, ` : ""}
            entraste con Google y no llegamos a preguntarte a qué institución perteneces.
            Es un dato obligatorio para usar la plataforma.
          </p>
        </div>

        <form onSubmit={enviar} className="p-8 space-y-5">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-outlineSoft mb-2 block"
                   htmlFor="institucion-pendiente">
              Institución
            </label>
            <SelectorInstitucion
              id="institucion-pendiente"
              valor={institucion}
              onChange={setInstitucion}
              disabled={enviando}
            />
          </div>

          {error && (
            <p role="alert" className="text-[11.5px] text-negative border-l-2 border-negative pl-3 leading-relaxed">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando || !institucion}
            className="w-full py-3 bg-white text-black text-[11px] uppercase tracking-widest font-bold hover:bg-white/85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enviando ? "Guardando…" : "Continuar"}
          </button>

          <button
            type="button"
            onClick={cerrarSesion}
            className="w-full text-[10.5px] uppercase tracking-widest text-outlineSoft hover:text-white transition-colors"
          >
            Salir de la cuenta
          </button>
        </form>
      </div>
    </div>
  );
}
