"""Persistencia de conversaciones del asistente y contabilidad de tokens.

El consumo se registra por mensaje, no como un contador agregado en la fila del
usuario. Eso permite recalcular el gasto de cualquier período, auditar de dónde
salió cada cifra y borrar una conversación sin dejar el contador descuadrado.
"""
from sqlalchemy import text

LIMITE_TITULO = 60


def titulo_desde_mensaje(texto: str) -> str:
    """Título provisional de la conversación a partir del primer mensaje."""
    limpio = " ".join((texto or "").split())
    if not limpio:
        return "Nueva conversación"
    if len(limpio) <= LIMITE_TITULO:
        return limpio
    return limpio[:LIMITE_TITULO].rsplit(" ", 1)[0] + "…"


# --- Conversaciones --------------------------------------------------------

def listar_conversaciones(db, id_usuario: int) -> list[dict]:
    filas = db.execute(text("""
        SELECT c.id_conversacion, c.titulo, c.motor, c.fecha_creacion, c.fecha_actualizacion,
               (SELECT count(*) FROM mensaje m WHERE m.id_conversacion = c.id_conversacion) AS n_mensajes,
               (SELECT m.contenido FROM mensaje m
                 WHERE m.id_conversacion = c.id_conversacion
                 ORDER BY m.id_mensaje DESC LIMIT 1) AS ultimo_mensaje
        FROM conversacion c
        WHERE c.id_usuario = :u AND NOT c.archivada
        ORDER BY c.fecha_actualizacion DESC
    """), {"u": id_usuario})
    return [dict(f._mapping) for f in filas]


def crear_conversacion(db, id_usuario: int, titulo: str, motor: str) -> int:
    """Crea una conversación ligada a un motor. El motor se fija aquí y ya no
    cambia: ver la nota en `motores.py` sobre por qué no se puede alternar."""
    return db.execute(text("""
        INSERT INTO conversacion (id_usuario, titulo, motor)
        VALUES (:u, :t, :mo) RETURNING id_conversacion
    """), {"u": id_usuario, "t": titulo, "mo": motor}).scalar()


def obtener_conversacion(db, id_conversacion: int, id_usuario: int) -> dict | None:
    """Devuelve la conversación con sus mensajes, o None si no existe o no
    pertenece al usuario. La comprobación de propiedad va en el WHERE: así una
    conversación ajena es indistinguible de una inexistente."""
    cab = db.execute(text("""
        SELECT id_conversacion, titulo, motor, fecha_creacion, fecha_actualizacion
        FROM conversacion WHERE id_conversacion = :c AND id_usuario = :u
    """), {"c": id_conversacion, "u": id_usuario}).first()
    if cab is None:
        return None

    mensajes = db.execute(text("""
        SELECT id_mensaje, rol, contenido, tokens_entrada, tokens_salida, fecha_creacion
        FROM mensaje WHERE id_conversacion = :c ORDER BY id_mensaje
    """), {"c": id_conversacion})

    datos = dict(cab._mapping)
    datos["mensajes"] = [dict(m._mapping) for m in mensajes]
    return datos


def motor_de_conversacion(db, id_conversacion: int, id_usuario: int) -> str | None:
    """Motor de una conversación del usuario, o None si no existe o es ajena.

    Comprueba la propiedad y devuelve el motor en una sola consulta: es lo único
    que necesita `/chat`, que de otro modo cargaría todos los mensajes solo para
    validar el acceso.
    """
    return db.execute(text("""
        SELECT motor FROM conversacion WHERE id_conversacion = :c AND id_usuario = :u
    """), {"c": id_conversacion, "u": id_usuario}).scalar()


def eliminar_conversacion(db, id_conversacion: int, id_usuario: int) -> bool:
    resultado = db.execute(text("""
        DELETE FROM conversacion WHERE id_conversacion = :c AND id_usuario = :u
    """), {"c": id_conversacion, "u": id_usuario})
    return resultado.rowcount > 0


def renombrar_conversacion(db, id_conversacion: int, id_usuario: int, titulo: str) -> bool:
    resultado = db.execute(text("""
        UPDATE conversacion SET titulo = :t, fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id_conversacion = :c AND id_usuario = :u
    """), {"t": titulo[:200], "c": id_conversacion, "u": id_usuario})
    return resultado.rowcount > 0


# --- Mensajes --------------------------------------------------------------

def guardar_mensaje(db, id_conversacion: int, rol: str, contenido: str,
                    tokens_entrada: int = 0, tokens_salida: int = 0,
                    modelo: str | None = None) -> int:
    id_mensaje = db.execute(text("""
        INSERT INTO mensaje (id_conversacion, rol, contenido, tokens_entrada, tokens_salida, modelo)
        VALUES (:c, :r, :co, :te, :ts, :m) RETURNING id_mensaje
    """), {"c": id_conversacion, "r": rol, "co": contenido,
           "te": tokens_entrada, "ts": tokens_salida, "m": modelo}).scalar()

    db.execute(text("""
        UPDATE conversacion SET fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id_conversacion = :c
    """), {"c": id_conversacion})
    return id_mensaje


def descartar_turno_fallido(db, id_conversacion: int, id_mensaje_usuario: int,
                            era_nueva: bool) -> None:
    """Deshace un turno que no llegó a completarse.

    Borra el mensaje del usuario y, si la conversación se había creado para este
    turno y queda vacía, también la conversación: así un fallo del proveedor no
    deja conversaciones en blanco en el historial del usuario.
    """
    db.execute(text("DELETE FROM mensaje WHERE id_mensaje = :m"), {"m": id_mensaje_usuario})
    if era_nueva:
        db.execute(text("""
            DELETE FROM conversacion
             WHERE id_conversacion = :c
               AND NOT EXISTS (SELECT 1 FROM mensaje WHERE id_conversacion = :c)
        """), {"c": id_conversacion})


def historial_para_modelo(db, id_conversacion: int, max_mensajes: int = 20) -> list[dict]:
    """Últimos mensajes en el formato que espera la API del modelo.

    Se acota la ventana porque la API es sin estado y reenvía todo el historial
    en cada llamada: sin tope, una conversación larga encarece cada turno.
    """
    filas = db.execute(text("""
        SELECT rol, contenido FROM (
            SELECT rol, contenido, id_mensaje FROM mensaje
            WHERE id_conversacion = :c ORDER BY id_mensaje DESC LIMIT :n
        ) ultimos ORDER BY id_mensaje
    """), {"c": id_conversacion, "n": max_mensajes})
    return [{"role": f.rol, "content": f.contenido} for f in filas]


# --- Consumo y cuota -------------------------------------------------------

def consumo_del_mes(db, id_usuario: int) -> dict:
    """Tokens consumidos por el usuario en el mes calendario en curso."""
    fila = db.execute(text("""
        SELECT COALESCE(SUM(m.tokens_entrada), 0) AS entrada,
               COALESCE(SUM(m.tokens_salida), 0)  AS salida,
               count(*) FILTER (WHERE m.rol = 'assistant') AS respuestas
        FROM mensaje m
        JOIN conversacion c ON c.id_conversacion = m.id_conversacion
        WHERE c.id_usuario = :u
          AND m.fecha_creacion >= date_trunc('month', CURRENT_DATE)
    """), {"u": id_usuario}).first()
    return {
        "tokens_entrada": int(fila.entrada),
        "tokens_salida": int(fila.salida),
        "tokens_total": int(fila.entrada) + int(fila.salida),
        "respuestas": int(fila.respuestas),
    }


def mensajes_de_hoy(db, id_usuario: int) -> int:
    return int(db.execute(text("""
        SELECT count(*) FROM mensaje m
        JOIN conversacion c ON c.id_conversacion = m.id_conversacion
        WHERE c.id_usuario = :u AND m.rol = 'user'
          AND m.fecha_creacion >= CURRENT_DATE
    """), {"u": id_usuario}).scalar())


def estado_de_cuota(db, usuario: dict) -> dict:
    """Estado de consumo frente a los límites del plan del usuario."""
    consumo = consumo_del_mes(db, usuario["id_usuario"])
    hoy = mensajes_de_hoy(db, usuario["id_usuario"])

    tope_tokens = usuario.get("tokens_mensuales")
    tope_diario = usuario.get("mensajes_por_dia")

    tokens_restantes = None if tope_tokens is None else max(0, tope_tokens - consumo["tokens_total"])
    mensajes_restantes = None if tope_diario is None else max(0, tope_diario - hoy)

    return {
        **consumo,
        "mensajes_hoy": hoy,
        "plan": usuario.get("plan_usuario"),
        "nombre_plan": usuario.get("nombre_plan"),
        "tokens_mensuales": tope_tokens,
        "tokens_restantes": tokens_restantes,
        "mensajes_por_dia": tope_diario,
        "mensajes_restantes": mensajes_restantes,
        "excedido": (tokens_restantes == 0) or (mensajes_restantes == 0),
    }


def motivo_de_bloqueo(cuota: dict) -> str | None:
    """Mensaje explicativo si el usuario no puede seguir consultando, o None."""
    if cuota.get("tokens_restantes") == 0:
        return ("Alcanzaste el límite mensual de tokens de tu plan "
                f"({cuota['tokens_mensuales']:,} tokens). Se restablece el día 1 del próximo mes."
                .replace(",", "."))
    if cuota.get("mensajes_restantes") == 0:
        return (f"Alcanzaste el límite diario de {cuota['mensajes_por_dia']} consultas de tu plan. "
                "Se restablece mañana.")
    return None
