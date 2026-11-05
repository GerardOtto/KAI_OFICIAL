import { Link, useLocation } from "react-router-dom";

/** Ruta desconocida. Antes era un «404» suelto, sin salida ni navegación. */
export default function NoEncontrada() {
  const { pathname } = useLocation();
  return (
    <main className="min-h-[calc(100dvh-64px)] bg-background text-white flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[.16em] text-outlineSoft mb-3">Error 404</p>
        <h1 className="font-headline text-[28px] font-semibold mb-3">Esta página no existe</h1>
        <p className="text-sm text-[#a8a8a8] leading-relaxed mb-7">
          No encontramos <span className="font-mono text-[#d0d0d0] break-all">{pathname}</span>. Puede que el enlace
          esté incompleto o que la sección haya cambiado de lugar.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link to="/ranking" className="px-4 py-2.5 bg-white text-[#111] text-[12px] font-semibold hover:bg-white/85">
            Ir al Resumen
          </Link>
          <Link to="/" className="px-4 py-2.5 border border-white/20 text-[12px] text-[#dcdcdc] hover:text-white hover:border-white/40">
            Volver a la portada
          </Link>
        </div>
      </div>
    </main>
  );
}
