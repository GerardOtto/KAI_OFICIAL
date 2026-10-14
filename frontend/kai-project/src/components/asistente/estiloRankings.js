import iconoKai from "../../assets/rankings/iconos/kai.png";
import iconoQs from "../../assets/rankings/iconos/qs.png";
import iconoScimago from "../../assets/rankings/iconos/scimago.png";
import iconoThe from "../../assets/rankings/iconos/the.png";

/** Color e ícono de cada consulta guiada, sacados del logotipo de su ranking.
 *
 *  THE es negro sobre blanco, así que su botón es negro con borde; KAI usa el
 *  azul de acento de la plataforma. La tinta es oscura sobre los fondos claros:
 *  el blanco sobre el naranjo de QS no llega al contraste mínimo de lectura.
 *  Los íconos son el cuadrado de cada logotipo, recortado a 96 px.
 */
export const ESTILO_RANKING = {
  "brechas-qs": { icono: iconoQs, fondo: "#F7A70D", tinta: "#1b1405", borde: "#F7A70D" },
  "brechas-the": { icono: iconoThe, fondo: "#000000", tinta: "#ffffff", borde: "rgba(255,255,255,0.32)" },
  "brechas-scimago": { icono: iconoScimago, fondo: "#F73E59", tinta: "#1e0408", borde: "#F73E59" },
  "brechas-kai": { icono: iconoKai, fondo: "#60AAF3", tinta: "#06131f", borde: "#60AAF3" },
};
