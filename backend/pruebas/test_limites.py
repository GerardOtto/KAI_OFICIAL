# -*- coding: utf-8 -*-
"""Topes de las rutas públicas de autenticación y del asistente.

Contra la app real y la base local, por HTTP con TestClient. Los topes se
bajan con sus variables de entorno, las mismas que en producción, para no tener
que crear cincuenta cuentas: lo que se verifica es la regla, no su valor.
Cada grupo usa su propia IP —en X-Forwarded-For— para que los topes de uno no
contaminen al siguiente."""
import io
import os
import sys
import uuid
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Antes de importar la app: los topes se leen al cargar `app.limites`.
os.environ["KAI_REGISTROS_POR_IP"] = "3"
os.environ["KAI_LOGIN_FALLOS_POR_CUENTA"] = "4"
os.environ["KAI_LOGIN_FALLOS_POR_IP"] = "20"
os.environ.setdefault("JWT_SECRET", "secreto-solo-para-pruebas")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)
from dotenv import load_dotenv
load_dotenv(os.path.join(RAIZ, ".env"))

from fastapi.testclient import TestClient
from sqlalchemy import text

from app import main

fallos = []
MARCA = f"limites-{uuid.uuid4().hex[:8]}"
CLAVE = "Prueba12345!"


def comprobar(nombre, cond, detalle=""):
    print(f"  [{'OK ' if cond else 'FALLA'}] {nombre}" + (f" -> {detalle}" if detalle and not cond else ""))
    if not cond:
        fallos.append(nombre)


cliente = TestClient(main.app)
INSTITUCION = cliente.get("/instituciones").json()[0]["nombre_universidad"]


def registrar(etiqueta, ip, clave=CLAVE):
    return cliente.post("/auth/registro", headers={"X-Forwarded-For": ip}, json={
        "nombre": f"Prueba {etiqueta}", "correo": f"{MARCA}-{etiqueta}@ejemplo.cl",
        "clave": clave, "institucion": INSTITUCION})


def entrar(etiqueta, ip, clave=CLAVE):
    return cliente.post("/auth/login", headers={"X-Forwarded-For": ip},
                        json={"correo": f"{MARCA}-{etiqueta}@ejemplo.cl", "clave": clave})


try:
    print("=== 1. Contraseña larga: un 400 claro, no un 500 ===")
    larga = registrar("larga", "10.4.4.4", "a" * 73)
    comprobar("73 caracteres se rechazan con 400", larga.status_code == 400, larga.status_code)
    comprobar("el aviso dice el máximo", "72" in larga.json().get("detail", ""), larga.json())
    tildes = registrar("tildes", "10.4.4.4", "ñ" * 37)  # 74 bytes en UTF-8
    comprobar("37 eñes (74 bytes) también: el tope es de bytes", tildes.status_code == 400, tildes.status_code)

    print("\n=== 2. Registro: tope por conexión ===")
    a = registrar("a", "10.4.4.4", "b" * 72)
    comprobar("72 caracteres sí se aceptan", a.status_code == 200, a.status_code)
    codigos = [a.status_code] + [registrar(e, "10.4.4.4").status_code for e in ("b", "c", "d")]
    comprobar("las contraseñas rechazadas no gastaron el tope: entran 3 cuentas",
              codigos[:3] == [200, 200, 200], codigos)
    comprobar("la cuarta desde la misma IP se frena con 429", codigos[3] == 429, codigos)

    print("\n=== 3. X-Forwarded-For: lo que escribe el cliente no cuenta ===")
    # El proxy agrega la IP real por la derecha. Cambiar la de la izquierda en cada
    # envío ya no estrena un tope nuevo.
    disfrazadas = [registrar(f"x{n}", f"1.2.3.{n}, 10.4.4.4").status_code for n in range(3)]
    comprobar("con la IP real agotada, cambiar la de la izquierda no sirve",
              disfrazadas == [429, 429, 429], disfrazadas)
    otra = registrar("e", "10.4.4.5")
    comprobar("otra conexión real sí puede registrarse", otra.status_code == 200, otra.status_code)

    print("\n=== 4. Inicio de sesión: tope de fallos por cuenta ===")
    fallidos = [entrar("a", "10.3.3.3", "mala").status_code for _ in range(4)]
    comprobar("los cuatro primeros fallos responden 401", fallidos == [401] * 4, fallidos)
    bloqueada = entrar("a", "10.3.3.3", "b" * 72)
    comprobar("con el tope agotado ni la clave correcta entra: 429", bloqueada.status_code == 429,
              bloqueada.status_code)
    b = entrar("b", "10.3.3.3")
    comprobar("otra cuenta desde la misma IP sigue entrando", b.status_code == 200, b.status_code)

    print("\n=== 5. Acertar limpia los fallos de la cuenta ===")
    for _ in range(3):
        entrar("b", "10.3.3.3", "mala")
    comprobar("tras 3 fallos, la clave correcta entra", entrar("b", "10.3.3.3").status_code == 200)
    for _ in range(3):
        entrar("b", "10.3.3.3", "mala")
    sigue = entrar("b", "10.3.3.3")
    comprobar("y la cuenta vuelve a empezar: 3 fallos más no la bloquean", sigue.status_code == 200,
              sigue.status_code)

    print("\n=== 6. El tope no revela qué cuentas existen ===")
    respuestas = [entrar("nadie", "10.3.3.3", "mala") for _ in range(5)]
    inexistente = [r.status_code for r in respuestas]
    comprobar("una cuenta inexistente se frena igual que una real", inexistente == [401] * 4 + [429],
              inexistente)
    comprobar("y con el mismo aviso, palabra por palabra",
              respuestas[-1].json() == bloqueada.json(), (respuestas[-1].json(), bloqueada.json()))

    print("\n=== 7. Inicio de sesión: tope de fallos por conexión ===")
    rociado = [entrar(f"rociado{n}", "10.2.2.2", "mala").status_code for n in range(20)]
    comprobar("20 cuentas distintas, una contraseña cada una: 401", rociado == [401] * 20)
    tras = entrar("c", "10.2.2.2")
    comprobar("desde esa IP ya no entra nadie, ni con su clave: 429", tras.status_code == 429,
              tras.status_code)
    comprobar("desde otra IP la misma cuenta entra", entrar("c", "10.2.2.3").status_code == 200)

    print("\n=== 8. Largo máximo de un mensaje al asistente ===")
    token = entrar("c", "10.2.2.3").json()["token"]
    cabecera = {"Authorization": f"Bearer {token}"}
    largo = cliente.post("/chat", headers=cabecera, json={"mensaje": "x" * (main.MAX_MENSAJE + 1)})
    comprobar("un carácter de más: 400 con el máximo en el aviso",
              largo.status_code == 400 and "20.000" in largo.json().get("detail", ""),
              (largo.status_code, largo.json()))
    justo = cliente.post("/chat", headers=cabecera, json={"mensaje": "x" * main.MAX_MENSAJE})
    comprobar("justo el máximo pasa ese control (se frena después, por la cuenta)",
              justo.status_code != 400, (justo.status_code, justo.json()))
    comprobar("el tope deja pasar la consulta guiada más larga (11.111 caracteres)",
              main.MAX_MENSAJE > 11111 * 1.5, main.MAX_MENSAJE)

finally:
    # --- Limpieza -----------------------------------------------------------
    db = main.SessionLocal()
    db.execute(text("DELETE FROM usuario WHERE correo_usuario LIKE :m"), {"m": f"{MARCA}%"})
    db.commit()
    quedan = db.execute(text("SELECT count(*) FROM usuario WHERE correo_usuario LIKE :m"),
                        {"m": f"{MARCA}%"}).scalar()
    db.close()
    print(f"\nCuentas de prueba eliminadas (quedan {quedan})")
    if quedan:
        fallos.append("limpieza incompleta")

print("=" * 62)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
