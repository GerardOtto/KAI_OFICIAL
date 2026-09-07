import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL;
const CLAVE_TOKEN = "kai_token";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

/** Lector del token para los hooks que llaman a la API fuera del contexto. */
export function tokenGuardado() {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

/** Cabeceras de autorización, o un objeto vacío si no hay sesión. */
export function cabeceraAuth() {
  const t = tokenGuardado();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function leerError(res, porDefecto) {
  try {
    const d = await res.json();
    return d?.detail || porDefecto;
  } catch {
    return porDefecto;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => tokenGuardado());
  const [usuario, setUsuario] = useState(null);
  const [cuota, setCuota] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [googleClientId, setGoogleClientId] = useState(null);

  // Saber si el servidor tiene configurado el acceso con Google: si no lo está,
  // el botón no se muestra en lugar de fallar al pulsarlo.
  useEffect(() => {
    fetch(`${API}/auth/config`)
      .then(r => r.json())
      .then(d => setGoogleClientId(d?.google_habilitado ? d.google_client_id : null))
      .catch(() => setGoogleClientId(null));
  }, []);

  const guardarToken = useCallback((t) => {
    try {
      if (t) localStorage.setItem(CLAVE_TOKEN, t);
      else localStorage.removeItem(CLAVE_TOKEN);
    } catch { /* modo privado o almacenamiento bloqueado */ }
    setToken(t);
  }, []);

  const cerrarSesion = useCallback(() => {
    guardarToken(null);
    setUsuario(null);
    setCuota(null);
  }, [guardarToken]);

  // Revalida la sesión contra el servidor al cargar y cada vez que cambia el token.
  const refrescar = useCallback(async () => {
    const t = tokenGuardado();
    if (!t) {
      setUsuario(null);
      setCuota(null);
      setCargando(false);
      return;
    }
    try {
      const res = await fetch(`${API}/auth/yo`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.status === 401) {
        // Token expirado o revocado: se descarta en silencio.
        cerrarSesion();
        return;
      }
      const d = await res.json();
      setUsuario(d.usuario);
      setCuota(d.cuota);
    } catch {
      // Sin red: se conserva el token para reintentar más tarde.
    } finally {
      setCargando(false);
    }
  }, [cerrarSesion]);

  useEffect(() => { refrescar(); }, [token, refrescar]);

  const aplicarSesion = useCallback((datos) => {
    guardarToken(datos.token);
    setUsuario(datos.usuario);
    setCargando(false);
  }, [guardarToken]);

  const entrar = useCallback(async (correo, clave) => {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo, clave }),
    });
    if (!res.ok) throw new Error(await leerError(res, "No se pudo iniciar sesión."));
    aplicarSesion(await res.json());
  }, [aplicarSesion]);

  const registrar = useCallback(async ({ nombre, correo, clave, institucion }) => {
    const res = await fetch(`${API}/auth/registro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, correo, clave, institucion }),
    });
    if (!res.ok) throw new Error(await leerError(res, "No se pudo crear la cuenta."));
    aplicarSesion(await res.json());
  }, [aplicarSesion]);

  const entrarConGoogle = useCallback(async (credential) => {
    const res = await fetch(`${API}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) throw new Error(await leerError(res, "No se pudo entrar con Google."));
    aplicarSesion(await res.json());
  }, [aplicarSesion]);

  const valor = useMemo(() => ({
    usuario, cuota, cargando, googleClientId,
    autenticado: !!usuario,
    entrar, registrar, entrarConGoogle, cerrarSesion, refrescar,
    setCuota,
  }), [usuario, cuota, cargando, googleClientId, entrar, registrar, entrarConGoogle, cerrarSesion, refrescar]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
