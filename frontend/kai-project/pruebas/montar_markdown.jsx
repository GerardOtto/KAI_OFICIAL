// Auxiliar de las sondas del asistente: monta piezas del chat —el renderizador
// de Markdown y el indicador de espera— en una caja suelta, para comprobar en el
// DOM cómo se dibujan.
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
import Cargando from "../src/components/asistente/Cargando";

function caja(id) {
  document.getElementById(id)?.remove();
  const nueva = document.createElement("div");
  nueva.id = id;
  document.body.appendChild(nueva);
  return nueva;
}

export function montar(texto, id = "prueba-markdown") {
  createRoot(caja(id)).render(createElement(Markdown, null, texto));
  return id;
}

/** El mismo renderizador, con la aparición progresiva encendida. */
export function montarRevelado(texto, id = "prueba-revelado") {
  createRoot(caja(id)).render(createElement(Markdown, { revelar: true }, texto));
  return id;
}

/** El indicador que se muestra mientras el asistente responde. */
export function montarCargando(id = "prueba-cargando") {
  createRoot(caja(id)).render(createElement(Cargando, null));
  return id;
}
