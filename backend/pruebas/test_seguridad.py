"""Seguridad de la API: sesiones, entradas, cabeceras y aislamiento entre cuentas.

  * Un token sin vencimiento, sin `sub`, con `sub` no numérico, sin firma o
    firmado con otra clave se rechaza con 401, nunca con 500.
  * La sesión de quien se registró con un correo ajeno deja de valer cuando el
    dueño real vincula la cuenta con Google (que borra la contraseña): el token
    lleva la huella de la forma de entrar y se compara en cada petición.
  * Los campos de texto tienen tope y las listas de identificadores se validan:
    un valor no numérico es un 400, no un 500.
  * Toda respuesta lleva las cabeceras de seguridad, y CORS no responde a un
    origen ajeno.
  * Una cuenta no ve ni toca los grupos ni las conversaciones de otra.

La consulta SQL libre del asistente se prueba en `test_herramientas.py`.
"""
import base64
import json
import os
import sys
import time
import uuid

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from dotenv import load_dotenv

load_dotenv(os.path.join(RAIZ, ".env"))
import jwt
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import auth, main

fallos = []
usuarios = []
cliente = TestClient(main.app)


def comprobar(nombre, cond, detalle=""):
    print(f"  [{'OK ' if cond else 'FALLA'}] {nombre}" + (f" -> {detalle}" if detalle and not cond else ""))
    if not cond:
        fallos.append(nombre)


def crear_usuario(clave="Prueba12345!"):
    correo = f"seguridad-{uuid.uuid4().hex[:8]}@ejemplo.cl"
    db = main.SessionLocal()
    uid = db.execute(text("""
        INSERT INTO usuario (nombre_usuario, correo_usuario, clave_usuario, institucion_usuario, plan_usuario)
        VALUES ('Prueba seguridad', :c, :k, 'Pontificia Universidad Catolica de Valparaiso', 'free')
        RETURNING id_usuario"""), {"c": correo, "k": auth.hashear_clave(clave)}).scalar()
    db.commit()
    db.close()
    usuarios.append(uid)
    return uid, correo


def cabecera(token):
    return {"Authorization": f"Bearer {token}"}


def b64(d):
    return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()


try:
    print("=== 1. Tokens manipulados ===")
    uid, correo = crear_usuario()
    token, _ = auth.crear_token(uid, correo)
    carga = jwt.decode(token, options={"verify_signature": False})
    comprobar("el token lleva la huella de la forma de entrar", bool(carga.get("sv")), carga)
    comprobar("un token legítimo entra", cliente.get("/auth/yo", headers=cabecera(token)).status_code == 200)
    secreto = auth._secreto()
    otro = auth.crear_token(crear_usuario()[0], "x@ejemplo.cl")[0]
    manipulados = {
        "sin firma (alg none)": b64({"alg": "none", "typ": "JWT"}) + "." + b64(carga) + ".",
        "firmado con otra clave": jwt.encode(carga, "otra-clave-cualquiera-de-al-menos-32-bytes", algorithm="HS256"),
        "vencido": jwt.encode({**carga, "exp": int(time.time()) - 10}, secreto, algorithm="HS256"),
        "sin exp (no vencería nunca)": jwt.encode({k: v for k, v in carga.items() if k != "exp"}, secreto, algorithm="HS256"),
        "sin sub": jwt.encode({k: v for k, v in carga.items() if k != "sub"}, secreto, algorithm="HS256"),
        "sub no numérico": jwt.encode({**carga, "sub": "1 OR 1=1"}, secreto, algorithm="HS256"),
        "huella de otra cuenta": jwt.encode({**carga, "sv": jwt.decode(otro, options={"verify_signature": False})["sv"]},
                                            secreto, algorithm="HS256"),
        "sin huella": jwt.encode({k: v for k, v in carga.items() if k != "sv"}, secreto, algorithm="HS256"),
        "basura": "abc.def.ghi",
    }
    for nombre, falso in manipulados.items():
        r = cliente.get("/auth/yo", headers=cabecera(falso))
        comprobar(f"token {nombre} → 401", r.status_code == 401, f"{r.status_code} {r.text[:120]}")

    print("\n=== 2. La vinculación con Google cierra la sesión del que usurpó el correo ===")
    # Alguien se registró con un correo ajeno y tiene su sesión. El dueño real
    # entra con Google: /auth/google pone google_sub y borra la contraseña (aquí,
    # por SQL, porque Google no está configurado en las pruebas).
    usurpador, correo_ajeno = crear_usuario()
    sesion_usurpada = auth.crear_token(usurpador, correo_ajeno)[0]
    comprobar("antes de vincular, la sesión vale", cliente.get("/auth/yo", headers=cabecera(sesion_usurpada)).status_code == 200)
    db = main.SessionLocal()
    db.execute(text("UPDATE usuario SET google_sub = :g, clave_usuario = NULL WHERE id_usuario = :i"),
               {"g": f"google-{uuid.uuid4().hex}", "i": usurpador})
    db.commit()
    db.close()
    r = cliente.get("/auth/yo", headers=cabecera(sesion_usurpada))
    comprobar("después, esa sesión ya no vale", r.status_code == 401, f"{r.status_code} {r.text[:120]}")
    comprobar("y la del dueño, emitida después, sí",
              cliente.get("/auth/yo", headers=cabecera(auth.crear_token(usurpador, correo_ajeno)[0])).status_code == 200)

    print("\n=== 3. Entradas con tope y validadas ===")
    largos = {
        "registro con nombre de 200 kB": ("/auth/registro", {"nombre": "x" * 200_000, "correo": "a@b.cl",
                                                            "clave": "Prueba12345!", "institucion": "x"}),
        "login con correo de 100 kB": ("/auth/login", {"correo": "a" * 100_000 + "@b.cl", "clave": "x"}),
        "token de Google de 100 kB": ("/auth/google", {"credential": "x" * 100_000}),
        "contacto con mensaje de 1 MB": ("/contacto", {"nombre": "x", "correo": "a@b.cl", "institucion": "x",
                                                       "mensaje": "x" * 1_000_000}),
    }
    for nombre, (ruta, cuerpo) in largos.items():
        r = cliente.post(ruta, json=cuerpo)
        comprobar(f"{nombre} → 422", r.status_code == 422, f"{r.status_code} {r.text[:120]}")
    sesion = cabecera(token)
    db = main.SessionLocal()
    ranking = db.execute(text("SELECT id_ranking FROM ranking WHERE nombre_ranking = 'Scimago Latam'")).scalar()
    metrica = db.execute(text("SELECT min(id_metrica) FROM metrica WHERE id_ranking = :r"), {"r": ranking}).scalar()
    db.close()
    for ruta, params in (("/trends", {"ranking_id": ranking, "metrica_id": metrica, "universidades": "1,abc"}),
                         ("/simulacion", {"ranking_id": ranking, "anio": 2025, "universidades": "1;DROP"}),
                         ("/tendencias-comparacion", {"ranking_id": ranking, "anio": 2025, "metricas": "x"}),
                         ("/tendencias-comparacion", {"ranking_id": ranking, "anio": 2025,
                                                      "universidades": ",".join(["1"] * 600)})):
        r = cliente.get(ruta, params=params, headers=sesion)
        comprobar(f"{ruta} con {list(params)[-1]} inválido → 400", r.status_code == 400, f"{r.status_code} {r.text[:120]}")
    r = cliente.get("/simulacion", params={"ranking_id": "1 OR 1=1", "anio": 2025}, headers=sesion)
    comprobar("un entero con SQL → 422", r.status_code == 422, r.status_code)

    print("\n=== 4. Cabeceras y CORS ===")
    r = cliente.get("/rankings", headers=sesion)
    esperadas = {"x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "no-referrer",
                 "cache-control": "no-store"}
    for clave, valor in esperadas.items():
        comprobar(f"{clave}: {valor}", r.headers.get(clave) == valor, r.headers.get(clave))
    comprobar("política de contenido cerrada", "default-src 'none'" in (r.headers.get("content-security-policy") or ""))
    r = cliente.get("/no-existe-esta-ruta")
    comprobar("también en un 404", r.headers.get("x-content-type-options") == "nosniff")
    r = cliente.get("/", headers={"Origin": "https://evil.example"})
    comprobar("CORS no responde a un origen ajeno", r.headers.get("access-control-allow-origin") is None,
              r.headers.get("access-control-allow-origin"))
    r = cliente.get("/", headers={"Origin": main.ORIGENES_PRODUCCION[0]})
    comprobar("y sí al de producción", r.headers.get("access-control-allow-origin") == main.ORIGENES_PRODUCCION[0])

    print("\n=== 5. Una cuenta no toca lo de otra ===")
    otra = cabecera(auth.crear_token(crear_usuario()[0], "y@ejemplo.cl")[0])
    g = cliente.post("/grupos", headers=sesion, json={"nombre": f"privado-{uuid.uuid4().hex[:6]}", "universidades": [1, 2]})
    if g.status_code == 200:
        gid = g.json()["id_grupo"]
        comprobar("otra cuenta no ve el grupo", all(x["id_grupo"] != gid for x in cliente.get("/grupos", headers=otra).json()))
        comprobar("ni lo borra", cliente.delete(f"/grupos/{gid}", headers=otra).status_code in (403, 404))
        comprobar("el dueño sí", cliente.delete(f"/grupos/{gid}", headers=sesion).status_code == 204)
    else:
        print(f"  (sin la migración 022: {g.status_code})")
    db = main.SessionLocal()
    ajena = db.execute(text("SELECT id_conversacion FROM conversacion ORDER BY id_conversacion LIMIT 1")).scalar()
    db.close()
    if ajena:
        comprobar("otra cuenta no lee una conversación ajena",
                  cliente.get(f"/conversaciones/{ajena}", headers=otra).status_code == 404)
        comprobar("ni la renombra",
                  cliente.patch(f"/conversaciones/{ajena}", headers=otra, json={"titulo": "x"}).status_code == 404)
        comprobar("ni la borra", cliente.delete(f"/conversaciones/{ajena}", headers=otra).status_code == 404)
finally:
    db = main.SessionLocal()
    db.execute(text("DELETE FROM usuario WHERE id_usuario = ANY(:ids)"), {"ids": usuarios})
    db.commit()
    db.close()

print("\n" + "=" * 74)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
