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
    """Tokens consumidos en el mes en curso, desglosados por motor.

    El desglose es por `conversacion.motor` y no por `mensaje.modelo`: el motor
    es el dato contra el que se cobra la cuota y no cambia dentro de una
    conversación, mientras que el identificador del modelo puede variar entre
    mensajes si se actualiza la versión configurada.
    """
    filas = db.execute(text("""
        SELECT c.motor,
               COALESCE(SUM(m.tokens_entrada), 0) AS entrada,
               COALESCE(SUM(m.tokens_salida), 0)  AS salida,
               count(*) FILTER (WHERE m.rol = 'assistant') AS respuestas
        FROM mensaje m
        JOIN conversacion c ON c.id_conversacion = m.id_conversacion
        WHERE c.id_usuario = :u
          AND m.fecha_creacion >= date_trunc('month', CURRENT_DATE)
        GROUP BY c.motor
    """), {"u": id_usuario})

    por_motor = {}
    for f in filas:
        por_motor[f.motor] = {
            "tokens_entrada": int(f.entrada),
            "tokens_salida": int(f.salida),
            "tokens_total": int(f.entrada) + int(f.salida),
            "respuestas": int(f.respuestas),
        }
    return por_motor


# Espacio de nombres de los cerrojos consultivos, para no colisionar con otros
# usos de `pg_advisory_lock` que pudieran añadirse más adelante.
ESPACIO_CUOTA = 4001


def bloquear_cuota(db, id_usuario: int) -> None:
    """Serializa por usuario la comprobación de cuota y la escritura del turno.

    Sin esto, la cuota se comprueba y se consume en dos pasos separados: varias
    peticiones simultáneas del mismo usuario leen el mismo recuento antes de que
    ninguna haya escrito, y todas se creen dentro del límite. Medido con un tope
    diario de cinco y doce peticiones a la vez, se aceptaban ocho.

    El cerrojo es de transacción: se libera solo, al confirmar el mensaje del
    usuario, de modo que no se retiene durante la llamada al proveedor —que es
    lenta— sino únicamente durante la ventana de comprobar y escribir. Y es por
    usuario, así que no serializa el tráfico de usuarios distintos.
    """
    db.execute(text("SELECT pg_advisory_xact_lock(:espacio, :u)"),
               {"espacio": ESPACIO_CUOTA, "u": id_usuario})


def mensajes_de_hoy(db, id_usuario: int) -> int:
    return int(db.execute(text("""
        SELECT count(*) FROM mensaje m
        JOIN conversacion c ON c.id_conversacion = m.id_conversacion
        WHERE c.id_usuario = :u AND m.rol = 'user'
          AND m.fecha_creacion >= CURRENT_DATE
    """), {"u": id_usuario}).scalar())


# Cada motor tiene su propia cuota mensual, en la columna que le corresponde del
# plan. Convenio de valores: None = sin límite, 0 = motor no incluido en el plan.
COLUMNA_DE_CUOTA = {"claude": "tokens_claude_mes", "gemini": "tokens_gemini_mes"}

VACIO = {"tokens_entrada": 0, "tokens_salida": 0, "tokens_total": 0, "respuestas": 0}


def estado_de_cuota(db, usuario: dict) -> dict:
    """Estado de consumo frente a los límites del plan del usuario.

    El límite diario de consultas es común a todos los motores; el de tokens es
    de cada uno. Un motor con tope 0 no está incluido en el plan, que es distinto
    de haberlo agotado: en el primer caso hay que cambiar de plan y en el segundo
    basta esperar al mes siguiente.
    """
    consumo = consumo_del_mes(db, usuario["id_usuario"])
    hoy = mensajes_de_hoy(db, usuario["id_usuario"])

    # Si el usuario no trae plan, la consulta lo dejó todo en NULL y NULL
    # significa «sin límite»: sin esta comprobación, una cuenta con el plan
    # borrado o sin asignar tendría acceso ilimitado a todo. Ante la duda, el
    # plan más restrictivo.
    sin_plan = usuario.get("nombre_plan") is None
    if sin_plan:
        usuario = {**usuario, "nombre_plan": "Sin plan", "mensajes_por_dia": 0,
                   "tokens_claude_mes": 0, "tokens_gemini_mes": 0,
                   "precio_mensual_usd": 0}

    tope_diario = usuario.get("mensajes_por_dia")
    mensajes_restantes = None if tope_diario is None else max(0, tope_diario - hoy)

    motores = {}
    for motor, columna in COLUMNA_DE_CUOTA.items():
        usado = consumo.get(motor, VACIO)
        tope = usuario.get(columna)
        incluido = tope is None or tope > 0
        restantes = None if tope is None else max(0, tope - usado["tokens_total"])
        motores[motor] = {
            **usado,
            "incluido": incluido,
            "tokens_mensuales": tope,
            "tokens_restantes": restantes,
            "disponible": incluido and restantes != 0 and mensajes_restantes != 0,
        }

    total = sum(m["tokens_total"] for m in motores.values())
    return {
        "plan": usuario.get("plan_usuario"),
        "nombre_plan": usuario.get("nombre_plan"),
        "precio_mensual_usd": float(usuario["precio_mensual_usd"] or 0)
                              if usuario.get("precio_mensual_usd") is not None else 0.0,
        "mensajes_hoy": hoy,
        "mensajes_por_dia": tope_diario,
        "mensajes_restantes": mensajes_restantes,
        "tokens_total": total,
        "motores": motores,
        # `excedido` significa que no queda ningún motor con el que consultar; es
        # lo que la interfaz usa para deshabilitar el campo de entrada.
        "excedido": not any(m["disponible"] for m in motores.values()),
    }


def _miles(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def motivo_de_bloqueo(cuota: dict, motor: str) -> tuple[int, str] | None:
    """Por qué no se puede consultar con ese motor, o None si sí se puede.

    Devuelve el código HTTP junto al mensaje, porque los dos motivos piden
    acciones distintas: 403 cuando el plan no incluye el motor —hay que
    contratar otro— y 429 cuando la cuota se agotó —hay que esperar—.
    """
    estado = cuota["motores"].get(motor)
    if estado is None:
        return 400, f"El motor '{motor}' no existe."

    if not estado["incluido"]:
        return 403, (f"Tu plan «{cuota.get('nombre_plan') or cuota.get('plan')}» no incluye este motor. "
                     "Puedes seguir consultando con el motor gratuito o cambiar de plan.")

    if cuota.get("mensajes_restantes") == 0:
        return 429, (f"Alcanzaste el límite diario de {cuota['mensajes_por_dia']} consultas de tu plan. "
                     "Se restablece mañana.")

    if estado["tokens_restantes"] == 0:
        return 429, (f"Agotaste los {_miles(estado['tokens_mensuales'])} tokens mensuales de este motor "
                     "en tu plan. Se restablecen el día 1 del próximo mes.")
    return None
