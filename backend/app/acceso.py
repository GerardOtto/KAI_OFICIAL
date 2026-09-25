"""Qué puede hacer cada plan: única fuente de la que salen todas las respuestas.

Los límites del plan gratuito no son de una sola clase —hay datos que no puede
ver, cálculos que no puede pedir, informes que no puede volver a descargar y una
espera entre consultas al asistente—, y aparecen en sitios muy distintos: en el
endpoint que sirve los datos, en el que registra una descarga y en la interfaz,
que debe deshabilitar lo que no está permitido antes de que el usuario lo pulse.

Si cada uno de esos sitios decidiera por su cuenta, acabarían discrepando: la
interfaz ofrecería algo que el servidor rechaza, o al revés. Por eso todo se
deriva de aquí, y `capacidades()` es lo que viaja al cliente.

El servidor no confía en que la interfaz respete lo que se le dice: cada límite
se comprueba también donde se sirve el dato. Lo que el cliente recibe es para
poder mostrarlo, no para decidirlo.
"""
import os

from sqlalchemy import text

# --- Planes -----------------------------------------------------------------

PLAN_GRATUITO = "free"
PLAN_ADMIN = "admin"

# Las familias de ranking reservadas a los planes de pago. Se comparan contra el
# nombre del ranking y no contra una lista de identificadores, para que un THE o
# un QS que se cargue mañana quede restringido sin tocar el código.
FAMILIAS_RESERVADAS = ("THE", "QS")

# El asistente consume un servicio de pago por cada consulta, así que de momento
# se limita a la institución que financia el proyecto. Se comprueba por el
# dominio del correo: es lo que acredita la afiliación, mientras que la
# institución del perfil la elige el propio usuario.
DOMINIOS_DEL_ASISTENTE = tuple(
    d.strip().lower() for d in os.getenv("KAI_DOMINIOS_ASISTENTE", "pucv.cl,mail.pucv.cl").split(",")
    if d.strip()
)

# Módulos que generan informes y formatos en que los generan.
MODULOS_CON_INFORME = ("ranking", "tendencias", "simulacion", "metricas", "asistente")
FORMATOS = ("pdf", "xlsx")

# Cuántos informes de cada formato y módulo puede descargar el plan gratuito.
# Es un total histórico, no una cuota que se reponga.
DESCARGAS_GRATUITAS = 1


def es_admin(usuario: dict | None) -> bool:
    return bool(usuario) and usuario.get("plan_usuario") == PLAN_ADMIN


def es_gratuito(usuario: dict | None) -> bool:
    """Plan gratuito, o cuenta sin plan asignado.

    La ausencia de plan se trata como el plan más restrictivo y no como el más
    permisivo, por el mismo motivo que en el cálculo de cuota: un dato que falta
    no debe conceder privilegios.
    """
    if usuario is None:
        return True
    return usuario.get("plan_usuario") in (None, PLAN_GRATUITO)


# --- Rankings reservados ----------------------------------------------------

_restringidos: list[dict] | None = None


def rankings_restringidos(db) -> list[dict]:
    """Rankings que el plan gratuito puede nombrar pero no consultar.

    Se cachea por proceso: el catálogo de rankings solo cambia al cargar datos
    nuevos, y eso implica reiniciar el backend.
    """
    global _restringidos
    if _restringidos is not None:
        return _restringidos

    patron = "|".join(FAMILIAS_RESERVADAS)
    filas = db.execute(text("""
        SELECT id_ranking, nombre_ranking FROM ranking
         WHERE nombre_ranking ~* :patron
         ORDER BY id_ranking
    """), {"patron": f"^({patron})\\M"}).fetchall()
    _restringidos = [{"id_ranking": f.id_ranking, "nombre_ranking": f.nombre_ranking} for f in filas]
    return _restringidos


def ids_restringidos(db) -> set[int]:
    return {r["id_ranking"] for r in rankings_restringidos(db)}


def puede_ver_ranking(db, usuario: dict | None, ranking_id: int | None) -> bool:
    if ranking_id is None or not es_gratuito(usuario) or es_admin(usuario):
        return True
    return int(ranking_id) not in ids_restringidos(db)


def motivo_ranking(db, ranking_id: int) -> str:
    nombre = next((r["nombre_ranking"] for r in rankings_restringidos(db)
                   if r["id_ranking"] == int(ranking_id)), "Este ranking")
    return (f"«{nombre}» está reservado a los planes de pago. Tu plan incluye el resto de "
            "los rankings cargados; para consultar THE y QS hay que cambiar de plan.")


# --- Asistente --------------------------------------------------------------

def dominio(correo: str | None) -> str:
    return (correo or "").strip().lower().rpartition("@")[2]


def puede_usar_asistente(usuario: dict | None) -> tuple[bool, str | None]:
    """Si la cuenta tiene acceso al asistente, y por qué no si no lo tiene."""
    if es_admin(usuario):
        return True, None
    if usuario is None:
        return False, "El asistente exige una sesión iniciada."
    if dominio(usuario.get("correo_usuario")) in DOMINIOS_DEL_ASISTENTE:
        return True, None
    return False, (
        "El asistente está disponible por ahora solo para cuentas de la PUCV "
        f"({', '.join('@' + d for d in DOMINIOS_DEL_ASISTENTE)}). El resto de los módulos "
        "no tiene esa restricción."
    )


# --- Descargas de informes --------------------------------------------------

def descargas_usadas(db, id_usuario: int) -> dict:
    """Cuántos informes lleva descargados el usuario, por módulo y formato."""
    filas = db.execute(text("""
        SELECT modulo, formato, count(*) AS n
          FROM descarga WHERE id_usuario = :u
         GROUP BY modulo, formato
    """), {"u": id_usuario}).fetchall()
    usadas = {m: {f: 0 for f in FORMATOS} for m in MODULOS_CON_INFORME}
    for f in filas:
        usadas.setdefault(f.modulo, {f_: 0 for f_ in FORMATOS})[f.formato] = int(f.n)
    return usadas


def puede_descargar(db, usuario: dict, modulo: str, formato: str) -> tuple[bool, str | None]:
    if modulo not in MODULOS_CON_INFORME:
        return False, f"El módulo «{modulo}» no genera informes."
    if formato not in FORMATOS:
        return False, f"Formato no admitido: «{formato}»."
    if not es_gratuito(usuario) or es_admin(usuario):
        return True, None

    usadas = descargas_usadas(db, usuario["id_usuario"]).get(modulo, {}).get(formato, 0)
    if usadas < DESCARGAS_GRATUITAS:
        return True, None
    return False, (
        f"El plan gratuito incluye un informe {formato.upper()} de este módulo, y ya lo "
        "descargaste. Los planes de pago no tienen límite de descargas."
    )


def registrar_descarga(db, id_usuario: int, modulo: str, formato: str) -> None:
    db.execute(text("""
        INSERT INTO descarga (id_usuario, modulo, formato) VALUES (:u, :m, :f)
    """), {"u": id_usuario, "m": modulo, "f": formato})


# --- Lo que se le cuenta al cliente -----------------------------------------

def capacidades(db, usuario: dict) -> dict:
    """Todo lo que la interfaz necesita para mostrar lo que este plan permite.

    Incluye los rankings restringidos con su nombre, y no solo sus
    identificadores, porque la interfaz los muestra: el plan gratuito ve que THE
    y QS existen —y no puede seleccionarlos—, en vez de encontrarse una lista
    corta sin explicación.
    """
    admin = es_admin(usuario)
    gratuito = es_gratuito(usuario) and not admin
    permitido_asistente, motivo_asistente = puede_usar_asistente(usuario)

    return {
        "plan": usuario.get("plan_usuario"),
        "nombre_plan": usuario.get("nombre_plan"),
        "administrador": admin,
        "gratuito": gratuito,
        "rankings_restringidos": rankings_restringidos(db) if gratuito else [],
        "predicciones": not gratuito,
        "asistente": {"permitido": permitido_asistente, "motivo": motivo_asistente},
        "descargas": {
            "limite": None if not gratuito else DESCARGAS_GRATUITAS,
            "modulos": MODULOS_CON_INFORME,
            "usadas": descargas_usadas(db, usuario["id_usuario"]),
        },
        "institucion_pendiente": not (usuario.get("institucion_usuario") or "").strip(),
    }
