/** Aviso de que el ranking ya publicó una edición más reciente que la cargada.
 *
 *  Lo dice la revisión mensual (tools/rankings, migración 023): `ultima_publicada`
 *  sale de la fuente cuando se puede consultar (THE, ShanghaiRanking) o de su
 *  calendario cuando no (QS, SCImago). Sin diferencia, no se muestra nada.
 */
export default function AvisoEdicion({ ranking }) {
  if (!ranking?.ultima_publicada || !ranking?.ultima_cargada) return null;
  if (ranking.ultima_publicada <= ranking.ultima_cargada) return null;
  const segun = ranking.ultima_publicada_como === "calendario" ? " según su calendario" : "";
  return (
    <div role="status" data-aviso-edicion
         className="mb-3 px-3.5 py-2.5 border text-[11.5px] leading-relaxed text-[#d8c79a]"
         style={{ borderColor: "oklch(0.78 0.13 75 / .4)", background: "oklch(0.78 0.13 75 / .06)" }}>
      <span className="font-semibold text-warn">{ranking.nombre_ranking} {ranking.ultima_publicada}</span>{" "}
      ya se publicó{segun}; aquí la edición más reciente es la {ranking.ultima_cargada}.
      {ranking.ultima_publicada_nota ? ` ${ranking.ultima_publicada_nota}` : " Se cargará en la próxima revisión."}
    </div>
  );
}
