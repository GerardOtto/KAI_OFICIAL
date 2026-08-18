import { useState } from "react";
import { getLogoUrl } from "../utils/logos";

export default function UniversidadLogo({ idUniversidad, nombre, size = 20, fallback, className = "" }) {
  const url = getLogoUrl(idUniversidad);
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    if (fallback) return fallback;
    return (
      <div
        className={`shrink-0 flex items-center justify-center bg-white/10 text-white/70 font-semibold rounded-sm ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        {nombre?.charAt(0)?.toUpperCase() || "?"}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={nombre}
      title={nombre}
      onError={() => setFailed(true)}
      className={`shrink-0 object-contain bg-white/5 rounded-sm ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
