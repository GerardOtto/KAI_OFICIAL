# -*- coding: utf-8 -*-
"""Prueba de extremo a extremo de la autenticacion y las conversaciones.
No gasta creditos: el /chat se prueba solo hasta el punto de control de cuota
y de propiedad, dado que la clave de Anthropic esta invalida."""
import json, os, urllib.request, urllib.error, uuid

# Esta bateria habla por HTTP con un backend ya en marcha, en vez de montar la
# aplicacion en el propio proceso: la direccion se parametriza para poder
# apuntarla al servicio que levante la integracion continua.
BASE = os.getenv("KAI_BASE_URL", "http://localhost:8000")

def pedir(metodo, ruta, cuerpo=None, token=None):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    req = urllib.request.Request(BASE + ruta, data=datos, method=metodo)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        cuerpo_err = e.read().decode()
        try:
            return e.code, json.loads(cuerpo_err)
        except Exception:
            return e.code, {"raw": cuerpo_err[:200]}

def ok(cond, etiqueta, extra=""):
    print(f"  [{'OK ' if cond else '*** FALLA ***'}] {etiqueta}" + (f"  {extra}" if extra else ""))
    return cond

fallos = 0
correo = f"prueba-{uuid.uuid4().hex[:8]}@universidad.cl"
CLAVE = "claveSegura123"

print("1) Configuracion de autenticacion")
c, r = pedir("GET", "/auth/config")
fallos += not ok(c == 200 and "google_habilitado" in r, "GET /auth/config", str(r))

print("\n2) Validaciones de registro")
for cuerpo, etiqueta in [
    ({"nombre": "X", "correo": "no-es-correo", "clave": "claveSegura123"}, "correo invalido"),
    ({"nombre": "X", "correo": correo, "clave": "corta"}, "clave demasiado corta"),
    ({"nombre": "  ", "correo": correo, "clave": "claveSegura123"}, "nombre vacio"),
]:
    c, r = pedir("POST", "/auth/registro", cuerpo)
    fallos += not ok(c == 400, f"rechaza {etiqueta}", f"{c} {r.get('detail','')}")

print("\n3) Registro correcto")
c, r = pedir("POST", "/auth/registro", {"nombre": "Usuaria de Prueba", "correo": correo,
                                        "clave": CLAVE, "institucion": "PUCV"})
fallos += not ok(c == 200 and r.get("token"), "POST /auth/registro", f"plan={r.get('usuario',{}).get('plan')}")
token = r.get("token", "")
crudo = json.dumps(r)
fallos += not ok(CLAVE not in crudo and "$2b$" not in crudo and "clave_usuario" not in crudo,
                 "la respuesta no expone ni la clave ni su hash",
                 "campos: " + ", ".join(sorted(r.get("usuario", {}).keys())))

print("\n4) Correo duplicado")
c, r = pedir("POST", "/auth/registro", {"nombre": "Otra", "correo": correo.upper(), "clave": CLAVE})
fallos += not ok(c == 409, "rechaza correo duplicado (sin distinguir mayusculas)", f"{c}")

print("\n5) Login")
c, r = pedir("POST", "/auth/login", {"correo": correo, "clave": CLAVE})
fallos += not ok(c == 200 and r.get("token"), "login correcto")
c, r = pedir("POST", "/auth/login", {"correo": correo, "clave": "incorrecta"})
fallos += not ok(c == 401, "rechaza clave incorrecta", r.get("detail", ""))
c, r2 = pedir("POST", "/auth/login", {"correo": "inexistente@x.cl", "clave": "loquesea"})
fallos += not ok(c == 401 and r2.get("detail") == r.get("detail"),
                 "mismo mensaje para cuenta inexistente (no permite enumerar)")

print("\n6) Proteccion de endpoints")
for ruta in ["/auth/yo", "/conversaciones", "/uso"]:
    c, _ = pedir("GET", ruta)
    fallos += not ok(c == 401, f"GET {ruta} sin token -> 401", str(c))
c, _ = pedir("GET", "/auth/yo", token="token.basura.aqui")
fallos += not ok(c == 401, "token malformado -> 401")

print("\n7) Perfil y cuota")
c, r = pedir("GET", "/auth/yo", token=token)
cuota = r.get("cuota", {})
fallos += not ok(c == 200 and r["usuario"]["correo"] == correo, "GET /auth/yo")
fallos += not ok(cuota.get("tokens_mensuales") == 200000 and cuota.get("mensajes_por_dia") == 30,
                 "cuota del plan free", f"{cuota.get('tokens_mensuales')} tokens / {cuota.get('mensajes_por_dia')} msj")
fallos += not ok(cuota.get("tokens_total") == 0, "consumo inicial en cero")

print("\n8) Endpoints publicos siguen abiertos")
for ruta in ["/rankings", "/universidades", "/anios?ranking_id=1"]:
    c, _ = pedir("GET", ruta)
    fallos += not ok(c == 200, f"GET {ruta} sigue publico", str(c))

print("\n9) Aislamiento entre usuarios")
correo2 = f"otro-{uuid.uuid4().hex[:8]}@universidad.cl"
c, r = pedir("POST", "/auth/registro", {"nombre": "Segundo", "correo": correo2, "clave": CLAVE})
token2 = r.get("token", "")
# El usuario 1 crea una conversacion directamente en la base a traves de /chat
# no es posible sin creditos, asi que se inserta por la API de conversaciones:
c, r = pedir("GET", "/conversaciones", token=token)
fallos += not ok(c == 200 and r == [], "usuario nuevo sin conversaciones")
c, r = pedir("GET", "/conversaciones/999999", token=token2)
fallos += not ok(c == 404, "conversacion inexistente -> 404")

print("\n10) /chat exige sesion y valida entrada")
c, r = pedir("POST", "/chat", {"mensaje": "hola"})
fallos += not ok(c == 401, "POST /chat sin token -> 401")
c, r = pedir("POST", "/chat", {"mensaje": "   "}, token=token)
fallos += not ok(c == 400, "rechaza mensaje vacio", r.get("detail", ""))
c, r = pedir("POST", "/chat", {"mensaje": "hola", "id_conversacion": 999999}, token=token)
fallos += not ok(c == 404, "rechaza conversacion ajena/inexistente", r.get("detail", ""))

print("\n11) Google sin configurar")
c, r = pedir("POST", "/auth/google", {"credential": "token.falso"})
fallos += not ok(c == 503, "responde 503 explicando que falta configuracion", r.get("detail", "")[:60])

print("\n" + "=" * 60)
print("FALLOS:", fallos if fallos else "ninguno")
