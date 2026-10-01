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
# Claude también tiene que figurar como configurado: sin esto la batería solo
# pasaba donde el .env local trae una clave real, y fallaba en integración
# continua. El proveedor se sustituye por un doble, así que nunca se usa.
os.environ["ANTHROPIC_API_KEY"] = "clave-de-prueba"

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
    correo = f"plan_{plan}_{os.getpid()}_{len(usuarios)}@pucv.cl"
    # Vinculada a Google, como exige el asistente.
    uid = db.execute(text("""
        INSERT INTO usuario (nombre_usuario, correo_usuario, google_sub,
                             institucion_usuario, plan_usuario)
        VALUES ('Prueba planes', :c, :g, 'Pontificia Universidad Catolica de Valparaiso', :p)
        RETURNING id_usuario
    """), {"c": correo, "g": f"prueba-{correo}", "p": plan}).scalar()
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
# Costo por millón de tokens contabilizados. Gemini 3.5 Flash-Lite con 90% de
# entrada y 10% de salida; Claude Opus 5 con 85% / 15%, porque el razonamiento
# se factura como salida. Ver docs/planes.md.
COSTO = {"claude": 0.85 * 5.00 + 0.15 * 25.00, "gemini": 0.9 * 0.30 + 0.1 * 2.50}
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
comprobar("el precio del plan viaja en la cuota", uso["precio_mensual_usd"] == 29.0, uso["precio_mensual_usd"])

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

print("\n=== 7. Plan gratuito: tres consultas por cuenta, para siempre ===")
# El gratuito no limita por frecuencia ni por día, sino por un total de por
# vida: se prueban tres consultas y, para seguir, hay que contratar.
db = main.SessionLocal()
tope, espera_dias, diario = db.execute(text(
    "SELECT mensajes_totales, dias_entre_mensajes, mensajes_por_dia FROM plan WHERE codigo_plan='free'")).one()
db.close()
comprobar("el plan gratuito trae 3 consultas de por vida", tope == 3, tope)
comprobar("sin espera entre consultas ni tope diario", espera_dias is None and diario is None,
          (espera_dias, diario))
comprobar("/planes lo informa para la portada", gratis["mensajes_totales"] == 3, gratis)
comprobar("los de pago no tienen tope de por vida",
          all(p["mensajes_totales"] is None for p in planes[1:]), [p["mensajes_totales"] for p in planes])

uid_g, prueba = crear_usuario("free")
seguidas = [chat(prueba, f"consulta {i}", motor="gemini") for i in range(tope)]
comprobar(f"las {tope} consultas pasan seguidas, sin esperar",
          all(r.status_code == 200 for r in seguidas), [r.status_code for r in seguidas])
cuarta = chat(prueba, "una más", motor="gemini")
comprobar("la siguiente responde 403: no se repone esperando", cuarta.status_code == 403, cuarta.status_code)
detalle = cuarta.json()["detail"]
comprobar("el mensaje dice cuántas eran y que hay que contratar",
          f"{tope} consultas" in detalle and "contrata" in detalle, detalle)
uso_prueba = cliente.get("/uso", headers=prueba).json()
comprobar("el estado de cuota lleva la cuenta",
          uso_prueba["consultas"] == {"total": tope, "hechas": tope, "restantes": 0}, uso_prueba.get("consultas"))
comprobar("y deja el asistente como excedido", uso_prueba["excedido"] is True, uso_prueba["excedido"])

# Borrar el historial no devuelve consultas: el contador es de la cuenta.
for r in seguidas:
    cliente.delete(f"/conversaciones/{r.json()['id_conversacion']}", headers=prueba)
db = main.SessionLocal()
quedan_conv = db.execute(text("SELECT count(*) FROM conversacion WHERE id_usuario = :u"), {"u": uid_g}).scalar()
db.close()
comprobar("se borraron sus conversaciones", quedan_conv == 0, quedan_conv)
tras_borrar = chat(prueba, "¿y ahora?", motor="gemini")
comprobar("y aun así sigue sin consultas", tras_borrar.status_code == 403, tras_borrar.status_code)

# Un turno fallido no gasta una consulta.
_, fallida = crear_usuario("free")
motores.responder = lambda motor, mensajes: resultado("falló", "modelo-de-prueba", motor, 0, 0, ok=False)
chat(fallida, "esta falla", motor="gemini")
motores.responder = responder_falso
hechas = cliente.get("/uso", headers=fallida).json()["consultas"]["hechas"]
comprobar("un fallo del proveedor no descuenta la consulta", hechas == 0, hechas)

# Al contratar rigen las cuotas del plan; si vuelve al gratuito, el tope sigue.
db = main.SessionLocal()
db.execute(text("UPDATE usuario SET plan_usuario = 'investigador' WHERE id_usuario = :u"), {"u": uid_g})
db.commit()
comprobar("con un plan de pago vuelve a consultar", chat(prueba, "ya contraté", motor="gemini").status_code == 200)
comprobar("y el estado de cuota ya no habla de tope de por vida",
          cliente.get("/uso", headers=prueba).json()["consultas"]["total"] is None)
db.execute(text("UPDATE usuario SET plan_usuario = 'free' WHERE id_usuario = :u"), {"u": uid_g})
db.commit()
db.close()
comprobar("si vuelve al gratuito, las consultas no se reponen",
          chat(prueba, "de vuelta", motor="gemini").status_code == 403)

# El tope diario sigue vigente en los planes que lo tienen. Se comprueba con un
# plan propio, porque ninguno del catálogo lo usa hoy.
TOPE_DIARIO = 2
codigo_diario = f"prueba-diario-{os.getpid()}"
db = main.SessionLocal()
db.execute(text("""
    INSERT INTO plan (codigo_plan, nombre_plan, precio_mensual_usd, tokens_claude_mes,
                      tokens_gemini_mes, mensajes_por_dia, dias_entre_mensajes, publico, orden)
    VALUES (:c, 'Prueba diario', 1, 0, 1000000, :t, NULL, FALSE, 97)
    ON CONFLICT (codigo_plan) DO UPDATE SET mensajes_por_dia = :t, dias_entre_mensajes = NULL
"""), {"c": codigo_diario, "t": TOPE_DIARIO})
db.commit()
db.close()
_, diario = crear_usuario(codigo_diario)
for i in range(TOPE_DIARIO):
    chat(diario, f"consulta {i}", motor="gemini")
r = chat(diario, "una más", motor="gemini")
comprobar(f"tras {TOPE_DIARIO} consultas del día responde 429", r.status_code == 429, r.status_code)
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
# El plan de prueba se borra después de sus usuarios: la clave ajena lo impide
# al revés, y dejarlo suelto ensuciaría el catálogo de la próxima ejecución.
db.execute(text("DELETE FROM plan WHERE codigo_plan = :c"), {"c": codigo_diario})
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
