// Auxiliar de la sonda del reporte: monta el renderizador de Markdown del chat
// en una caja suelta, para comprobar en el DOM cómo se dibuja un bloque.
//
// Vive fuera de `src` a propósito: el servidor de desarrollo lo sirve y lo
// transforma igual que cualquier módulo del proyecto, pero como nada de la
// aplicación lo importa, no entra en la compilación de producción.
//
// La sonda no puede importar React por su nombre desde la consola —el navegador
// no resuelve especificadores desnudos—, así que lo hace este módulo, que sí
// pasa por la resolución de Vite.
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import Markdown from "../src/components/asistente/Markdown";

export function montar(texto, id = "prueba-markdown") {
  document.getElementById(id)?.remove();
  const caja = document.createElement("div");
  caja.id = id;
  document.body.appendChild(caja);
  createRoot(caja).render(createElement(Markdown, null, texto));
  return id;
}
