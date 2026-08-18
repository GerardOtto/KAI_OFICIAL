import logoMap from "../data/universidadLogos.json";

export function getLogoUrl(idUniversidad) {
  const ext = logoMap[String(idUniversidad)];
  return ext ? `/logos/${idUniversidad}.${ext}` : null;
}
