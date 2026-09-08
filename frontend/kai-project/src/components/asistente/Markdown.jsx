import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

/** Corrige el Markdown que los modelos escriben mal antes de renderizarlo.
 *
 * `** texto **` no es negrita para ningún analizador de Markdown: la
 * especificación exige que los asteriscos peguen al texto, y con espacios se
 * muestran literales. Los modelos lo escriben así de vez en cuando, así que se
 * normaliza. La expresión exige contenido no vacío que no empiece ni termine en
 * asterisco, para no tocar separadores como `***` ni listas con viñeta `*`.
 */
function normalizar(texto) {
  return (texto || "").replace(/\*\*[ \t]+([^*\n](?:[^*\n]*[^*\s])?)[ \t]+\*\*/g, "**$1**");
}

/** Envoltorio con desplazamiento propio para el contenido ancho.
 *
 * Una tabla de comparación entre universidades desborda el ancho del mensaje.
 * Sin esto, empuja el resto de la conversación y aparece una barra horizontal en
 * la página entera; con esto, se desplaza solo la tabla.
 */
const Desbordable = ({ children }) => (
  <div className="my-3 overflow-x-auto">{children}</div>
);

const COMPONENTES = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,

  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-white/90">{children}</em>,
  del: ({ children }) => <del className="opacity-60">{children}</del>,

  // Los encabezados de un mensaje de chat no compiten con los de la página: se
  // distinguen por peso y espaciado, no por tamaño.
  h1: ({ children }) => <h3 className="mt-5 mb-2 first:mt-0 text-[15px] font-bold text-white">{children}</h3>,
  h2: ({ children }) => <h4 className="mt-5 mb-2 first:mt-0 text-[14px] font-bold text-white">{children}</h4>,
  h3: ({ children }) => <h5 className="mt-4 mb-1.5 first:mt-0 text-[13px] font-semibold text-white">{children}</h5>,
  h4: ({ children }) => (
    <h6 className="mt-4 mb-1.5 first:mt-0 font-mono text-[10px] uppercase tracking-widest text-outlineSoft">
      {children}
    </h6>
  ),

  ul: ({ children }) => <ul className="my-2 pl-5 list-disc marker:text-outlineSoft space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 pl-5 list-decimal marker:text-outlineSoft space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,

  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline underline-offset-2 hover:text-white transition-colors"
    >
      {children}
    </a>
  ),

  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-outline pl-4 text-white/70 italic">{children}</blockquote>
  ),

  hr: () => <hr className="my-4 border-0 border-t border-hairline" />,

  // react-markdown v10 ya no pasa `inline`: un bloque de código llega envuelto
  // en <pre>, y es ese envoltorio el que decide la presentación.
  code: ({ children, className }) => (
    <code className={`font-mono text-[12px] bg-surfaceHigh border border-outline/40 px-1.5 py-0.5 ${className || ""}`}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto bg-surfaceHigh border border-outline/40 p-3 font-mono text-[12px] leading-relaxed [&_code]:bg-transparent [&_code]:border-0 [&_code]:p-0">
      {children}
    </pre>
  ),

  table: ({ children }) => (
    <Desbordable>
      <table className="w-full min-w-max border-collapse text-[12.5px]">{children}</table>
    </Desbordable>
  ),
  thead: ({ children }) => <thead className="bg-surfaceHigh">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-outline/30 last:border-b-0">{children}</tr>,
  th: ({ children, style }) => (
    <th
      style={style}
      className="border border-outline/40 px-3 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-outlineSoft whitespace-nowrap"
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    // `tabular-nums` alinea verticalmente las cifras de una columna aunque la
    // fuente sea proporcional: sin ello, una tabla de puntajes se ve torcida.
    <td style={style} className="border border-outline/40 px-3 py-2 align-top tabular-nums">
      {children}
    </td>
  ),
};

/** Renderiza la respuesta del asistente como Markdown.
 *
 * Solo se aplica a los mensajes del modelo. Lo que escribe el usuario se muestra
 * literal: interpretarlo cambiaría su texto delante de sus ojos.
 */
export default function Markdown({ children, className = "" }) {
  return (
    <div className={`text-white/80 ${className}`}>
      <ReactMarkdown
        // gfm añade tablas, tachado y listas de tareas. breaks respeta el salto
        // de línea suelto: sin él, Markdown une dos renglones en un mismo
        // párrafo y las enumeraciones que el modelo escribe sin viñeta salen
        // amontonadas en un bloque de texto.
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={COMPONENTES}
        // El HTML crudo que venga en la respuesta se ignora en vez de
        // renderizarse. Es contenido generado por un modelo a partir, en parte,
        // de lo que escribe el usuario: no debe poder inyectar marcado.
        skipHtml
      >
        {normalizar(children)}
      </ReactMarkdown>
    </div>
  );
}
