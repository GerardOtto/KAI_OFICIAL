import { useEffect, useRef, useState } from "react";
import { useInstituciones } from "../../hooks/useInstituciones";

const API = import.meta.env.VITE_API_URL;

const campo =
  "w-full bg-surfaceHigh border border-outline/40 text-white py-3 px-4 text-[15px] placeholder:text-outlineSoft focus:outline-none focus:border-white transition-colors disabled:opacity-50";
const etiqueta = "text-[12px] font-semibold text-white/80 mb-1.5 block";

/** Formulario de «Contratar ahora». Todavía no hay cobro en línea —las
 *  universidades compran con contrato—, así que contratar es pedir que el
 *  equipo se comunique. La solicitud la guarda y la envía por correo el
 *  backend (`POST /contacto`, ver backend/app/contacto.py). */
export default function ContactoModal({ planes, planInicial, onClose }) {
  const [form, setForm] = useState({
    nombre: "", correo: "", institucion: "", cargo: "", telefono: "",
    plan: planInicial || "", mensaje: "", sitio_web: "",
  });
  const [estado, setEstado] = useState("editando"); // editando | enviando | enviado
  const [error, setError] = useState("");
  const ref = useRef(null);
  const { instituciones } = useInstituciones();

  useEffect(() => {
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const cambiar = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const dePago = planes.filter((p) => p.precio_mensual_usd > 0);

  const enviar = async (e) => {
    e.preventDefault();
    if (estado === "enviando") return;
    setError("");
    setEstado("enviando");
    try {
      const res = await fetch(`${API}/contacto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, plan: form.plan || null }),
      });
      if (!res.ok) {
        let detalle = "No pudimos enviar tu solicitud. Inténtalo de nuevo en unos minutos.";
        try { detalle = (await res.json())?.detail || detalle; } catch { /* sin JSON */ }
        throw new Error(typeof detalle === "string" ? detalle : "Revisa los datos del formulario.");
      }
      setEstado("enviado");
    } catch (err) {
      setError(err.message);
      setEstado("editando");
    }
  };

  const enviando = estado === "enviando";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm px-4 py-6">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="contacto-titulo"
           data-lenis-prevent
           className="relative w-full max-w-lg max-h-full overflow-y-auto bg-[#0e0e0e] border border-outline/30">
        <button onClick={onClose} aria-label="Cerrar"
                className="absolute top-4 right-4 text-outlineSoft hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {estado === "enviado" ? (
          <div className="p-8 sm:p-10">
            <p className="w-11 h-11 flex items-center justify-center bg-white text-black mb-5" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </p>
            <h2 id="contacto-titulo" className="font-headline text-2xl text-white">¡Solicitud enviada!</h2>
            <p className="mt-3 text-[15px] text-white/75 leading-relaxed">
              Gracias, {form.nombre.trim().split(/\s+/)[0]}. Te escribiremos a <b className="text-white">{form.correo}</b> para
              coordinar la contratación.
            </p>
            <button onClick={onClose}
                    className="mt-8 w-full py-3.5 bg-white text-black font-boton text-[14px] font-semibold uppercase tracking-wider hover:bg-white/85 transition-colors">
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={enviar} className="p-6 sm:p-8 space-y-4">
            <div className="pr-6">
              <h2 id="contacto-titulo" className="font-headline text-2xl text-white">Contratar KAI</h2>
              <p className="mt-2 text-[14px] text-white/70 leading-relaxed">
                Déjanos tus datos y te contactaremos para coordinar la contratación y la factura.
              </p>
            </div>

            <div>
              <label className={etiqueta} htmlFor="c-nombre">Nombre y apellido *</label>
              <input id="c-nombre" required autoComplete="name" maxLength={120} className={campo}
                     value={form.nombre} onChange={cambiar("nombre")} disabled={enviando} />
            </div>
            <div>
              <label className={etiqueta} htmlFor="c-correo">Correo electrónico *</label>
              <input id="c-correo" type="email" required autoComplete="email" maxLength={200} className={campo}
                     placeholder="nombre@universidad.cl"
                     value={form.correo} onChange={cambiar("correo")} disabled={enviando} />
            </div>
            <div>
              <label className={etiqueta} htmlFor="c-institucion">Institución *</label>
              {/* Texto libre con sugerencias: quien contrata puede venir de una
                  institución que no está en el catálogo de rankings. */}
              <input id="c-institucion" required list="c-instituciones" autoComplete="organization"
                     maxLength={200} className={campo} placeholder="Escribe o elige de la lista"
                     value={form.institucion} onChange={cambiar("institucion")} disabled={enviando} />
              <datalist id="c-instituciones">
                {instituciones.map((i) => <option key={i.id_universidad} value={i.nombre_universidad} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={etiqueta} htmlFor="c-cargo">Cargo</label>
                <input id="c-cargo" autoComplete="organization-title" maxLength={120} className={campo}
                       value={form.cargo} onChange={cambiar("cargo")} disabled={enviando} />
              </div>
              <div>
                <label className={etiqueta} htmlFor="c-telefono">Teléfono</label>
                <input id="c-telefono" type="tel" autoComplete="tel" maxLength={40} className={campo}
                       placeholder="+56 9 …"
                       value={form.telefono} onChange={cambiar("telefono")} disabled={enviando} />
              </div>
            </div>
            <div>
              <label className={etiqueta} htmlFor="c-plan">Plan de interés</label>
              <select id="c-plan" className={`${campo} appearance-none`} value={form.plan}
                      onChange={cambiar("plan")} disabled={enviando}>
                <option value="">Aún no lo sé</option>
                {dePago.map((p) => <option key={p.codigo_plan} value={p.codigo_plan}>{p.nombre_plan}</option>)}
              </select>
            </div>
            <div>
              <label className={etiqueta} htmlFor="c-mensaje">Mensaje</label>
              <textarea id="c-mensaje" rows={3} maxLength={2000} className={`${campo} resize-y`}
                        placeholder="¿Cuántas personas lo usarían? ¿Alguna duda?"
                        value={form.mensaje} onChange={cambiar("mensaje")} disabled={enviando} />
            </div>

            {/* Trampa para robots: invisible y fuera del orden de tabulación. */}
            <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
              <label htmlFor="c-sitio">Sitio web</label>
              <input id="c-sitio" tabIndex={-1} autoComplete="off" value={form.sitio_web} onChange={cambiar("sitio_web")} />
            </div>

            {error && (
              <p role="alert" className="text-[13px] text-negative border-l-2 border-negative pl-3 leading-relaxed">
                {error}
              </p>
            )}

            <button type="submit" disabled={enviando}
                    className="w-full py-4 bg-white text-black font-boton text-[14px] font-semibold uppercase tracking-wider hover:bg-white/85 transition-colors disabled:opacity-50 disabled:cursor-wait">
              {enviando ? "Enviando…" : "Enviar solicitud"}
            </button>
            <p className="text-[12px] text-outlineSoft leading-relaxed">
              Usaremos estos datos solo para responder tu solicitud.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
