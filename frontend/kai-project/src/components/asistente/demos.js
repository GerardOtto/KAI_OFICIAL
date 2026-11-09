/** Diagnósticos de muestra hechos con el motor Claude, que el chat vacío ofrece
 *  descargar. Son PDF estáticos de `public/demos/`: para actualizar uno basta
 *  reemplazar el archivo conservando el nombre. `estilo` es la clave del ranking
 *  en `estiloRankings.js`. */
export const DEMOS = [
  { id: "demo-pucv-qs", estilo: "brechas-qs", nombre: "PUCV · QS World 2027",
    bajada: "Sus cinco cifras clave y qué necesita para el top 10.",
    archivo: "kai-diagnostico-pucv-qs-world-2027.pdf" },
  { id: "demo-uv-qs", estilo: "brechas-qs", nombre: "UV · QS World 2027",
    bajada: "Sus cinco cifras clave y qué necesita para el top 10.",
    archivo: "kai-diagnostico-uv-qs-world-2027.pdf" },
  { id: "demo-pucv-scimago", estilo: "brechas-scimago", nombre: "PUCV · Scimago 2026",
    bajada: "Patentes, papers y acceso abierto: cuánto le falta.",
    archivo: "kai-diagnostico-pucv-scimago-2026.pdf" },
  { id: "demo-uv-scimago", estilo: "brechas-scimago", nombre: "UV · Scimago 2026",
    bajada: "Patentes, papers y acceso abierto: cuánto le falta.",
    archivo: "kai-diagnostico-uv-scimago-2026.pdf" },
];

/** Colores de cada motor para los recuadros del chat vacío. */
export const COLOR_MOTOR = {
  gemini: { acento: "#7B9DF4", degradado: "linear-gradient(90deg, #4285F4, #9B72CB, #D96570)", fondo: "rgba(66,133,244,0.07)" },
  claude: { acento: "#D97757", degradado: "linear-gradient(90deg, #D97757, #E8A07E)", fondo: "rgba(217,119,87,0.08)" },
};
