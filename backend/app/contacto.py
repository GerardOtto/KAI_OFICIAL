"""Solicitudes de contratación: se guardan y se envían por correo al equipo.

El botón «Contratar ahora» de la portada abre un formulario de contacto, porque
todavía no hay cobro en línea y las universidades compran con contrato. Cada
solicitud se guarda primero en `solicitud_contacto` (migración 015) y después se
envía, en segundo plano, a la dirección de `CONTACTO_DESTINO`. Guardar antes de
enviar es lo que evita perder una solicitud si el correo falla o aún no está
configurado: la fila queda con `enviado = FALSE` y el motivo en `error_envio`.

Configuración, solo por variables de entorno —nunca en el repositorio—:

    SMTP_HOST         por defecto smtp.gmail.com
    SMTP_PORT         por defecto 587 (STARTTLS); con 465 se usa SSL directo
    SMTP_USUARIO      la cuenta que envía
    SMTP_CLAVE        su contraseña de aplicación (en Gmail: Cuenta de Google →
                      Seguridad → Contraseñas de aplicaciones)
    CONTACTO_DESTINO  a quién llegan las solicitudes

Sin `SMTP_USUARIO`, `SMTP_CLAVE` o `CONTACTO_DESTINO`, las solicitudes se
guardan igual y el motivo queda anotado.
"""
import logging
import os
import smtplib
import time
from collections import defaultdict, deque
from email.message import EmailMessage

from sqlalchemy import text

from .db import SessionLocal

logger = logging.getLogger(__name__)

# Tope por dirección IP: el formulario es público, y sin él cualquiera podría
# usarlo para llenar la bandeja del equipo. Vive en memoria —se reinicia con el
# proceso—, que basta para frenar un abuso sin guardar la IP de nadie.
MAX_POR_HORA = 5
_recientes: dict[str, deque] = defaultdict(deque)


def config() -> dict:
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    clave = os.getenv("SMTP_CLAVE", "")
    # Google muestra la contraseña de aplicación en cuatro grupos separados por
    # espacios, y así se suele copiar; los espacios no forman parte de ella.
    if host.endswith("gmail.com"):
        clave = clave.replace(" ", "")
    return {
        "host": host,
        "puerto": int(os.getenv("SMTP_PORT", "587")),
        "usuario": os.getenv("SMTP_USUARIO", "").strip(),
        "clave": clave,
        "destino": os.getenv("CONTACTO_DESTINO", "").strip(),
    }


def configurado() -> bool:
    c = config()
    return bool(c["usuario"] and c["clave"] and c["destino"])


def permitir(ip: str) -> bool:
    """Registra un intento de la IP y dice si aún está bajo el tope por hora."""
    ahora = time.monotonic()
    marcas = _recientes[ip]
    while marcas and ahora - marcas[0] > 3600:
        marcas.popleft()
    if len(marcas) >= MAX_POR_HORA:
        return False
    marcas.append(ahora)
    return True


def componer(s: dict, destino: str, remitente: str) -> EmailMessage:
    """El correo que recibe el equipo. Responder le escribe a quien lo pidió."""
    plan = s.get("nombre_plan") or "sin especificar"
    msg = EmailMessage()
    msg["Subject"] = f"KAI · Solicitud de contratación · {plan} · {s['institucion']}"
    msg["From"] = remitente
    msg["To"] = destino
    msg["Reply-To"] = s["correo"]
    filas = [
        ("Nombre", s["nombre"]),
        ("Correo", s["correo"]),
        ("Institución", s["institucion"]),
        ("Cargo", s.get("cargo") or "—"),
        ("Teléfono", s.get("telefono") or "—"),
        ("Plan de interés", plan),
    ]
    cuerpo = "\n".join(f"{k}: {v}" for k, v in filas)
    if s.get("mensaje"):
        cuerpo += f"\n\nMensaje:\n{s['mensaje']}"
    cuerpo += (f"\n\n—\nSolicitud n.º {s['id_solicitud']}, recibida desde la portada de KAI. "
               "Responde a este correo para escribirle directamente.")
    msg.set_content(cuerpo)
    return msg


def enviar_solicitud(id_solicitud: int) -> None:
    """Envía una solicitud ya guardada y anota el resultado en su fila.

    Corre en segundo plano, después de responder al formulario: quien lo llena
    no espera al servidor de correo, y un fallo aquí no le llega como error
    porque su solicitud ya quedó guardada.
    """
    db = SessionLocal()
    try:
        fila = db.execute(text("""
            SELECT s.*, p.nombre_plan FROM solicitud_contacto s
            LEFT JOIN plan p ON p.codigo_plan = s.codigo_plan
            WHERE s.id_solicitud = :i
        """), {"i": id_solicitud}).mappings().first()
        if fila is None:
            return
        c = config()
        error = None
        if not configurado():
            error = "Correo sin configurar (SMTP_USUARIO, SMTP_CLAVE o CONTACTO_DESTINO)."
        else:
            try:
                msg = componer(dict(fila), c["destino"], c["usuario"])
                clase = smtplib.SMTP_SSL if c["puerto"] == 465 else smtplib.SMTP
                with clase(c["host"], c["puerto"], timeout=20) as smtp:
                    if clase is smtplib.SMTP:
                        smtp.starttls()
                    smtp.login(c["usuario"], c["clave"])
                    smtp.send_message(msg)
            except Exception as e:  # noqa: BLE001 — se anota cualquier fallo
                error = f"{type(e).__name__}: {str(e)[:300]}"
        db.execute(text("""
            UPDATE solicitud_contacto SET enviado = :ok, error_envio = :e WHERE id_solicitud = :i
        """), {"ok": error is None, "e": error, "i": id_solicitud})
        db.commit()
        if error:
            logger.warning("Solicitud de contacto %s guardada sin enviar: %s", id_solicitud, error)
    finally:
        db.close()
