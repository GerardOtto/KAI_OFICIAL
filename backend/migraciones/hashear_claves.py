# -*- coding: utf-8 -*-
"""Convierte a bcrypt las contraseñas que quedaron guardadas en texto plano.
No imprime ninguna contraseña. Reconoce un hash bcrypt por su prefijo, de modo
que ejecutarlo dos veces no vuelve a hashear lo ya hasheado."""
import os
import bcrypt
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Usa DATABASE_URL del entorno si ya está definida (caso producción); si no, la
# lee del .env local. Así el mismo guion sirve para ambas bases.
if not os.getenv("DATABASE_URL"):
    raiz_backend = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(raiz_backend, ".env"))

url = os.getenv("DATABASE_URL")
if not url:
    raise SystemExit("Falta DATABASE_URL: defínela en el entorno o en backend/.env")
print(f"Base de datos: {url.split('@')[-1]}\n")

engine = create_engine(url)
PREFIJOS_BCRYPT = ("$2a$", "$2b$", "$2y$")

with engine.begin() as cx:
    filas = cx.execute(text(
        "SELECT id_usuario, correo_usuario, clave_usuario FROM usuario "
        "WHERE clave_usuario IS NOT NULL"
    )).fetchall()

    convertidas = 0
    for f in filas:
        if f.clave_usuario.startswith(PREFIJOS_BCRYPT):
            print(f"  usuario {f.id_usuario} ({f.correo_usuario}): ya estaba hasheada")
            continue
        h = bcrypt.hashpw(f.clave_usuario.encode("utf-8"), bcrypt.gensalt()).decode("ascii")
        cx.execute(
            text("UPDATE usuario SET clave_usuario = :h WHERE id_usuario = :i"),
            {"h": h, "i": f.id_usuario},
        )
        convertidas += 1
        print(f"  usuario {f.id_usuario} ({f.correo_usuario}): convertida a bcrypt")

print(f"\nContraseñas convertidas: {convertidas}")

# Verificación: el hash resultante debe validar contra la contraseña original.
with engine.connect() as cx:
    for f in filas:
        if f.clave_usuario.startswith(PREFIJOS_BCRYPT):
            continue
        nuevo = cx.execute(
            text("SELECT clave_usuario FROM usuario WHERE id_usuario = :i"),
            {"i": f.id_usuario},
        ).scalar()
        ok = bcrypt.checkpw(f.clave_usuario.encode("utf-8"), nuevo.encode("ascii"))
        print(f"  verificación usuario {f.id_usuario}: {'CORRECTA' if ok else 'FALLIDA'}")
