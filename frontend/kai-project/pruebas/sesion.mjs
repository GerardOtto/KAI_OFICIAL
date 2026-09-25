// Sesión de prueba para las sondas que abren un módulo.
//
// Ningún módulo es accesible sin cuenta, así que una sonda que navegue a
// /tendencias o /metricas sin sesión mide la pantalla de acceso y no la vista.
// Aquí se crea una cuenta desechable contra el backend y se devuelve su testigo,
// que la sonda deja en `localStorage` antes de navegar, igual que hacían ya las
// dos sondas del asistente.
//
// La cuenta queda en el plan gratuito, que es el que más gente usará y el que
// más restricciones tiene. Las sondas actuales no lo necesitan de pago: miden
// disposición, el orden de las vistas y las cifras de Shanghai GRAS, que ese
// plan incluye. Una sonda que quisiera comprobar THE o QS tendría que subir el
// plan por SQL, y entonces conviene hacerlo desde la batería del backend.

const API = process.env.KAI_API_URL || process.env.VITE_API_URL || "http://localhost:8000";

export async function crearSesion({ institucion } = {}) {
  const sufijo = Math.random().toString(36).slice(2, 10);
  const correo = `sonda-${sufijo}@pucv.cl`;

  // La institución debe existir en el catálogo: se toma la primera que devuelva
  // el servidor, en vez de escribir un nombre a mano que mañana puede no estar.
  let elegida = institucion;
  if (!elegida) {
    const catalogo = await (await fetch(`${API}/instituciones`)).json();
    elegida = catalogo[0]?.nombre_universidad;
  }

  const res = await fetch(`${API}/auth/registro`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre: "Sonda de prueba",
      correo,
      clave: "Prueba12345!",
      institucion: elegida,
    }),
  });
  if (!res.ok) {
    throw new Error(`No se pudo crear la sesión de prueba (${res.status}): ${await res.text()}`);
  }
  const datos = await res.json();
  return { token: datos.token, correo, id: datos.usuario.id, capacidades: datos.capacidades };
}

/** Deja el testigo en el navegador y navega al módulo pedido. */
export async function entrar(cdp, evaluar, APP, ruta, token) {
  await cdp("Page.navigate", { url: APP });
  await new Promise((r) => setTimeout(r, 1200));
  await evaluar(`localStorage.setItem("kai_token", ${JSON.stringify(token)});`);
  await cdp("Page.navigate", { url: `${APP}${ruta}` });
  await new Promise((r) => setTimeout(r, 2500));
}
