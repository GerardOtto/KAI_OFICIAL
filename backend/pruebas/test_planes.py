# -*- coding: utf-8 -*-
"""Reglas de los planes: qué motor puede usar cada uno, qué pasa al agotar la
cuota y qué distingue al administrador. Sobre HTTP real contra la base local,
con el proveedor sustituido: no hay gasto."""
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
# La raiz del backend se resuelve desde la ubicacion de este archivo, no desde
# una ruta de una maquina concreta: es lo que permite ejecutar la bateria en
# otro equipo y en integracion continua.
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

from dotenv import load_dotenv
load_dotenv(os.path.join(RAIZ, ".env"))
os.environ["GEMINI_API_KEY"] = "clave-de-prueba"

from fastapi.testclient import TestClient
from sqlalchemy import text

from app import auth, main, motores
from app.herramientas import resultado

fallos = []
usuarios = []


def comprobar(nombre, cond, detalle=""):
    print(f"  [{'OK ' if cond else 'FALLA'}] {nombre}" + (f" -> {detalle}" if detalle and not cond else ""))
    if not cond:
        fallos.append(nombre)


TOKENS_POR_TURNO = 1000


def responder_falso(motor, mensajes):
    return resultado(f"[{motor}]", "modelo-de-prueba", motor, TOKENS_POR_TURNO, 0, ok=True)


motores.responder = responder_falso
cliente = TestClient(main.app)


def crear_usuario(plan):
    db = main.SessionLocal()
    correo = f"plan_{plan}_{os.getpid()}_{len(usuarios)}@ejemplo.test"
    uid = db.execute(text("""
        INSERT INTO usuario (nombre_usuario, correo_usuario, clave_usuario, plan_usuario)
        VALUES ('Prueba planes', :c, 'x', :p) RETURNING id_usuario
    """), {"c": correo, "p": plan}).scalar()
    db.commit()
    db.close()
    usuarios.append(uid)
    token, _ = auth.crear_token(uid, correo)
    return uid, {"Authorization": f"Bearer {token}"}


def chat(cab, mensaje, motor=None, id_conv=None):
    cuerpo = {"mensaje": mensaje, "id_conversacion": id_conv}
    if motor:
        cuerpo["motor"] = motor
    return cliente.post("/chat", json=cuerpo, headers=cab)


print("=== 1. Catálogo público de planes ===")
r = cliente.get("/planes")
planes = r.json()
codigos = [p["codigo_plan"] for p in planes]
comprobar("responde 200 sin sesión", r.status_code == 200, r.status_code)
comprobar("cuatro planes públicos, en orden",
          codigos == ["free", "investigador", "departamento", "institucional"], codigos)
comprobar("no expone los planes internos",
          "admin" not in codigos and "ilimitado" not in codigos, codigos)
gratis = planes[0]
comprobar("el gratuito no incluye Claude", gratis["tokens_claude_mes"] == 0, gratis)
comprobar("el gratuito sí incluye Gemini", gratis["tokens_gemini_mes"] > 0, gratis)
comprobar("los de pago tienen precio",
          all(p["precio_mensual_usd"] > 0 for p in planes[1:]), [p["precio_mensual_usd"] for p in planes])

print("\n=== 2. El margen sobre el costo de los tokens ===")
# Costo por millón de tokens contabilizados, suponiendo 90% entrada / 10% salida.
COSTO = {"claude": 0.9 * 5.00 + 0.1 * 25.00, "gemini": 0.9 * 0.25 + 0.1 * 1.50}
for p in planes:
    if p["precio_mensual_usd"] == 0:
        continue
    costo = (p["tokens_claude_mes"] / 1e6) * COSTO["claude"] + (p["tokens_gemini_mes"] / 1e6) * COSTO["gemini"]
    margen = p["precio_mensual_usd"] / costo
    print(f"    {p['nombre_plan']:14} precio US$ {p['precio_mensual_usd']:>6.2f}"
          f"  costo máximo US$ {costo:>6.2f}  margen {margen:.1f}x")
    comprobar(f"{p['nombre_plan']}: el precio cubre el costo al menos 3 veces", margen >= 3.0, f"{margen:.2f}x")

print("\n=== 3. Plan gratuito: Gemini sí, Claude no ===")
_, libre = crear_usuario("free")
r = chat(libre, "Hola", motor="gemini")
comprobar("puede usar Gemini", r.status_code == 200, r.text[:160])
conv_gemini = r.json()["id_conversacion"]

r = chat(libre, "Hola", motor="claude")
comprobar("Claude le responde 403, no 429", r.status_code == 403, r.status_code)
comprobar("el mensaje dice que es cuestión de plan",
          "no incluye este motor" in r.json()["detail"], r.json()["detail"])
comprobar("y ofrece la alternativa gratuita",
          "gratuito" in r.json()["detail"], r.json()["detail"])

db = main.SessionLocal()
n = db.execute(text("SELECT count(*) FROM conversacion WHERE id_usuario = :u"), {"u": usuarios[-1]}).scalar()
db.close()
comprobar("el intento rechazado no dejó conversación creada", n == 1, n)

print("\n=== 4. /motores refleja el plan ===")
r = cliente.get("/motores", headers=libre).json()["motores"]
por_id = {m["id"]: m for m in r}
comprobar("Gemini incluido en el plan", por_id["gemini"]["incluido_en_plan"] is True)
comprobar("Claude no incluido en el plan", por_id["claude"]["incluido_en_plan"] is False)
comprobar("Claude sigue estando configurado en el servidor", por_id["claude"]["disponible"] is True)
comprobar("pero no disponible ahora", por_id["claude"]["disponible_ahora"] is False)

sin_sesion = {m["id"]: m for m in cliente.get("/motores").json()["motores"]}
comprobar("sin sesión no se afirma nada sobre el plan",
          sin_sesion["claude"]["incluido_en_plan"] is None, sin_sesion["claude"])

print("\n=== 5. Plan de pago: ambos motores ===")
_, pago = crear_usuario("investigador")
comprobar("puede usar Gemini", chat(pago, "Hola", motor="gemini").status_code == 200)
comprobar("puede usar Claude", chat(pago, "Hola", motor="claude").status_code == 200)
uso = cliente.get("/uso", headers=pago).json()
comprobar("la cuota se lleva por motor separado",
          uso["motores"]["claude"]["tokens_total"] == TOKENS_POR_TURNO
          and uso["motores"]["gemini"]["tokens_total"] == TOKENS_POR_TURNO,
          {k: v["tokens_total"] for k, v in uso["motores"].items()})
comprobar("el precio del plan viaja en la cuota", uso["precio_mensual_usd"] == 12.0, uso["precio_mensual_usd"])

print("\n=== 6. Agotar la cuota de un motor no afecta al otro ===")
uid_p = usuarios[-1]
db = main.SessionLocal()
# Se marca el consumo de Claude como agotado escribiendo el gasto, no tocando el
# plan: así se ejercita el mismo camino que en producción.
db.execute(text("""
    UPDATE mensaje SET tokens_entrada = 999999999
     WHERE id_mensaje IN (
        SELECT m.id_mensaje FROM mensaje m
        JOIN conversacion c ON c.id_conversacion = m.id_conversacion
        WHERE c.id_usuario = :u AND c.motor = 'claude' AND m.rol = 'assistant')
"""), {"u": uid_p})
db.commit()
db.close()

r = chat(pago, "Otra", motor="claude")
comprobar("Claude agotado responde 429", r.status_code == 429, r.status_code)
comprobar("el mensaje habla de tokens mensuales",
          "tokens mensuales" in r.json()["detail"], r.json()["detail"])
comprobar("Gemini sigue funcionando", chat(pago, "Otra", motor="gemini").status_code == 200)
uso = cliente.get("/uso", headers=pago).json()
comprobar("no queda marcado como excedido del todo", uso["excedido"] is False, uso["excedido"])

print("\n=== 7. Límite diario de consultas ===")
_, diario = crear_usuario("free")
db = main.SessionLocal()
tope = db.execute(text("SELECT mensajes_por_dia FROM plan WHERE codigo_plan='free'")).scalar()
db.close()
for i in range(tope):
    chat(diario, f"consulta {i}", motor="gemini")
r = chat(diario, "una más", motor="gemini")
comprobar(f"tras {tope} consultas del día responde 429", r.status_code == 429, r.status_code)
comprobar("el mensaje habla del límite diario", "límite diario" in r.json()["detail"], r.json()["detail"])
comprobar("y ahora sí queda excedido",
          cliente.get("/uso", headers=diario).json()["excedido"] is True)

print("\n=== 8. Administrador: acceso completo ===")
_, admin = crear_usuario("admin")
comprobar("usa Claude", chat(admin, "Hola", motor="claude").status_code == 200)
comprobar("usa Gemini", chat(admin, "Hola", motor="gemini").status_code == 200)
uso = cliente.get("/uso", headers=admin).json()
comprobar("sin tope de tokens en Claude", uso["motores"]["claude"]["tokens_mensuales"] is None, uso["motores"]["claude"])
comprobar("sin tope de tokens en Gemini", uso["motores"]["gemini"]["tokens_mensuales"] is None, uso["motores"]["gemini"])
comprobar("sin tope diario", uso["mensajes_por_dia"] is None, uso["mensajes_por_dia"])
comprobar("nunca excedido", uso["excedido"] is False)
m_admin = {m["id"]: m for m in cliente.get("/motores", headers=admin).json()["motores"]}
comprobar("todos los motores incluidos",
          all(m["incluido_en_plan"] for m in m_admin.values()), m_admin)

print("\n=== 9. Una cuenta sin plan no obtiene barra libre ===")
uid_sp, sin_plan = crear_usuario("free")
db = main.SessionLocal()
db.execute(text("UPDATE usuario SET plan_usuario = NULL WHERE id_usuario = :u"), {"u": uid_sp})
db.commit()
db.close()
uso = cliente.get("/uso", headers=sin_plan).json()
comprobar("no se interpreta como ilimitado",
          uso["motores"]["claude"]["incluido"] is False and uso["motores"]["gemini"]["incluido"] is False, uso["motores"])
comprobar("queda bloqueada", uso["excedido"] is True, uso["excedido"])
comprobar("y /chat la rechaza", chat(sin_plan, "Hola", motor="gemini").status_code == 403)

# --- Limpieza ---------------------------------------------------------------
db = main.SessionLocal()
db.execute(text("DELETE FROM usuario WHERE id_usuario = ANY(:ids)"), {"ids": usuarios})
db.commit()
quedan = db.execute(text("SELECT count(*) FROM usuario WHERE id_usuario = ANY(:ids)"), {"ids": usuarios}).scalar()
huerfanas = db.execute(text("""
    SELECT count(*) FROM conversacion c LEFT JOIN usuario u ON u.id_usuario = c.id_usuario
    WHERE u.id_usuario IS NULL""")).scalar()
db.close()
print(f"\nUsuarios de prueba eliminados: {len(usuarios)} (quedan {quedan}, conversaciones huérfanas {huerfanas})")

print("=" * 62)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
