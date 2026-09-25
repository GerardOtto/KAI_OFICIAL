import { useInstituciones } from "../hooks/useInstituciones";

/** Desplegable de institución. Es obligatorio en el registro, así que se
 *  declara `required` y no ofrece una opción vacía seleccionable. */
export default function SelectorInstitucion({ valor, onChange, disabled, id = "institucion" }) {
  const { instituciones, error } = useInstituciones();

  return (
    <>
      <select
        id={id}
        required
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || instituciones.length === 0}
        className="w-full bg-surfaceHigh border border-outline/40 text-white py-3 px-4 text-sm focus:outline-none focus:border-white transition-colors disabled:opacity-50 appearance-none"
      >
        <option value="" disabled>
          {instituciones.length ? "Selecciona tu institución" : "Cargando instituciones…"}
        </option>
        {instituciones.map((i) => (
          <option key={i.id_universidad} value={i.nombre_universidad}>
            {i.nombre_universidad}
          </option>
        ))}
      </select>
      {error && <p className="mt-2 text-[10.5px] text-negative">{error}</p>}
    </>
  );
}
