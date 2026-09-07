"""Autenticación de usuarios: contraseñas, JWT propio y acceso con Google.

El sistema emite siempre su propio JWT, tanto si el usuario entró con correo y
contraseña como si lo hizo con Google. De ese modo el resto de la aplicación
tiene un único mecanismo de sesión y no necesita saber cómo se autenticó nadie.
"""
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text

from .db import SessionLocal

# --- Configuración ---------------------------------------------------------

JWT_SECRETO = os.getenv("JWT_SECRET")
JWT_ALGORITMO = "HS256"
JWT_HORAS_VALIDEZ = int(os.getenv("JWT_HORAS_VALIDEZ", "12"))

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

PLAN_POR_DEFECTO = "free"

# El esquema Bearer se declara con auto_error=False para poder distinguir
# "no envió credencial" de "envió una credencial inválida".
_bearer = HTTPBearer(auto_error=False)


def _secreto() -> str:
    if not JWT_SECRETO:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El servidor no tiene configurada JWT_SECRET; la autenticación está deshabilitada.",
        )
    return JWT_SECRETO


def google_configurado() -> bool:
    return bool(GOOGLE_CLIENT_ID)


# --- Contraseñas -----------------------------------------------------------

def hashear_clave(clave: str) -> str:
    return bcrypt.hashpw(clave.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verificar_clave(clave: str, hash_guardado: Optional[str]) -> bool:
    if not hash_guardado:
        return False
    try:
        return bcrypt.checkpw(clave.encode("utf-8"), hash_guardado.encode("ascii"))
    except (ValueError, UnicodeEncodeError):
        # Hash con formato inesperado (por ejemplo, texto plano heredado).
        return False


CORREO_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validar_registro(correo: str, clave: str, nombre: str) -> None:
    if not CORREO_RE.match(correo or ""):
        raise HTTPException(status_code=400, detail="El correo electrónico no tiene un formato válido.")
    if len(clave or "") < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres.")
    if not (nombre or "").strip():
        raise HTTPException(status_code=400, detail="El nombre es obligatorio.")


# --- JWT -------------------------------------------------------------------

def crear_token(id_usuario: int, correo: str) -> tuple[str, int]:
    """Devuelve (token, segundos_de_validez)."""
    ahora = datetime.now(timezone.utc)
    expira = ahora + timedelta(hours=JWT_HORAS_VALIDEZ)
    carga = {
        "sub": str(id_usuario),
        "correo": correo,
        "iat": int(ahora.timestamp()),
        "exp": int(expira.timestamp()),
    }
    token = jwt.encode(carga, _secreto(), algorithm=JWT_ALGORITMO)
    return token, JWT_HORAS_VALIDEZ * 3600


def _leer_token(token: str) -> dict:
    try:
        return jwt.decode(token, _secreto(), algorithms=[JWT_ALGORITMO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="La sesión expiró. Vuelve a iniciar sesión.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Credencial de sesión inválida.")


# --- Consulta del usuario --------------------------------------------------

CAMPOS_USUARIO = """
    u.id_usuario, u.nombre_usuario, u.correo_usuario, u.institucion_usuario,
    u.plan_usuario, u.avatar_url, u.correo_verificado, u.fecha_creacion,
    (u.google_sub IS NOT NULL) AS con_google,
    (u.clave_usuario IS NOT NULL) AS con_clave,
    p.nombre_plan, p.tokens_mensuales, p.mensajes_por_dia
"""


def buscar_usuario_por_id(db, id_usuario: int) -> Optional[dict]:
    fila = db.execute(
        text(f"SELECT {CAMPOS_USUARIO} FROM usuario u "
             "LEFT JOIN plan p ON p.codigo_plan = u.plan_usuario "
             "WHERE u.id_usuario = :i"),
        {"i": id_usuario},
    ).first()
    return dict(fila._mapping) if fila else None


def usuario_actual(
    credencial: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """Dependencia para endpoints que exigen sesión iniciada."""
    if credencial is None:
        raise HTTPException(
            status_code=401,
            detail="Esta operación requiere iniciar sesión.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    carga = _leer_token(credencial.credentials)
    db = SessionLocal()
    try:
        usuario = buscar_usuario_por_id(db, int(carga["sub"]))
    finally:
        db.close()
    if usuario is None:
        raise HTTPException(status_code=401, detail="La cuenta asociada a esta sesión ya no existe.")
    return usuario


def usuario_opcional(
    credencial: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[dict]:
    """Igual que `usuario_actual`, pero devuelve None si no hay sesión.

    Se usa en endpoints públicos que cambian de comportamiento cuando hay
    usuario, sin llegar a exigirlo.
    """
    if credencial is None:
        return None
    try:
        return usuario_actual(credencial)
    except HTTPException:
        return None


# --- Google ----------------------------------------------------------------

def verificar_token_google(token_google: str) -> dict:
    """Valida el ID token emitido por Google y devuelve sus datos.

    La verificación la hace la biblioteca oficial: comprueba la firma contra las
    claves públicas de Google, el emisor, la caducidad y que el token haya sido
    emitido para ESTA aplicación (audiencia). Sin la comprobación de audiencia,
    un token válido obtenido para otra aplicación serviría para entrar aquí.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="El acceso con Google no está configurado en el servidor (falta GOOGLE_CLIENT_ID).",
        )

    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    try:
        datos = google_id_token.verify_oauth2_token(
            token_google, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"El token de Google no es válido: {e}")

    if not datos.get("email"):
        raise HTTPException(status_code=400, detail="La cuenta de Google no expone un correo electrónico.")
    if not datos.get("email_verified", False):
        raise HTTPException(status_code=400, detail="La cuenta de Google no tiene el correo verificado.")

    return {
        "sub": datos["sub"],
        "correo": datos["email"].lower(),
        "nombre": datos.get("name") or datos["email"].split("@")[0],
        "avatar": datos.get("picture"),
    }
