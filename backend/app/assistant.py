import logging

import anthropic
from anthropic import Anthropic, beta_tool
from sqlalchemy import text

from .db import SessionLocal

logger = logging.getLogger(__name__)

MODEL = "claude-opus-5"

SYSTEM_PROMPT = """Eres el asistente de inteligencia académica de KAI, una plataforma de análisis de rankings universitarios (THE, QS Latam, Scimago, Shanghai GRAS).

Tienes herramientas para consultar la base de datos real de rankings, métricas, universidades y series históricas. Úsalas siempre que la pregunta dependa de datos concretos — nunca inventes cifras ni nombres de universidades.

Responde en español, de forma clara y concisa. Cita universidades y años cuando corresponda. Si una pregunta requiere datos que no puedes consultar con tus herramientas, dilo explícitamente en vez de adivinar."""

client = Anthropic()


@beta_tool
def listar_rankings() -> str:
    """Lista todos los rankings disponibles (id y nombre)."""
    db = SessionLocal()
    try:
        rows = db.execute(text("SELECT id_ranking, nombre_ranking FROM ranking ORDER BY id_ranking")).fetchall()
        return "\n".join(f"{r.id_ranking}: {r.nombre_ranking}" for r in rows)
    finally:
        db.close()


@beta_tool
def listar_universidades(pais: str = "") -> str:
    """Lista universidades registradas, opcionalmente filtradas por país.

    Args:
        pais: País a filtrar (ej. "Chile"). Vacío para listar todas.
    """
    db = SessionLocal()
    try:
        query = "SELECT id_universidad, nombre_universidad, pais_universidad FROM universidad"
        params = {}
        if pais:
            query += " WHERE pais_universidad ILIKE :pais"
            params["pais"] = pais
        query += " ORDER BY nombre_universidad"
        rows = db.execute(text(query), params).fetchall()
        return "\n".join(f"{r.id_universidad}: {r.nombre_universidad} ({r.pais_universidad})" for r in rows)
    finally:
        db.close()


@beta_tool
def listar_metricas(ranking_id: int) -> str:
    """Lista las métricas de un ranking, con su disciplina y peso porcentual.

    Args:
        ranking_id: ID del ranking (ver listar_rankings).
    """
    db = SessionLocal()
    try:
        rows = db.execute(
            text("SELECT id_metrica, nombre_metrica, disciplina, peso_metrica FROM metrica WHERE id_ranking = :rid ORDER BY nombre_metrica"),
            {"rid": ranking_id},
        ).fetchall()
        if not rows:
            return "No hay métricas registradas para ese ranking."
        return "\n".join(f"{r.id_metrica}: {r.nombre_metrica} ({r.disciplina}, peso {r.peso_metrica}%)" for r in rows)
    finally:
        db.close()


@beta_tool
def consultar_tendencia(ranking_id: int, metrica_id: int, universidad_ids: str = "") -> str:
    """Obtiene la serie histórica (año, valor) de una métrica de un ranking para una o más universidades.

    Args:
        ranking_id: ID del ranking.
        metrica_id: ID de la métrica (ver listar_metricas).
        universidad_ids: IDs de universidades separados por coma (ej. "1,22"). Vacío = todas las que tengan datos.
    """
    db = SessionLocal()
    try:
        params = {"rid": ranking_id, "mid": metrica_id}
        filtro = ""
        if universidad_ids:
            filtro = "AND u.id_universidad = ANY(:ids)"
            params["ids"] = [int(x) for x in universidad_ids.split(",")]
        rows = db.execute(
            text(f"""
                SELECT u.nombre_universidad, mu.anio_metrica, mu.valor_metrica
                FROM metrica_universidad mu
                JOIN metrica m ON m.id_metrica = mu.id_metrica
                JOIN universidad u ON u.id_universidad = mu.id_universidad
                WHERE m.id_ranking = :rid AND m.id_metrica = :mid {filtro}
                ORDER BY u.nombre_universidad, mu.anio_metrica
            """),
            params,
        ).fetchall()
        if not rows:
            return "No hay datos para esa combinación de ranking, métrica y universidades."
        return "\n".join(f"{r.nombre_universidad} | {r.anio_metrica}: {r.valor_metrica}" for r in rows)
    finally:
        db.close()


@beta_tool
def consultar_ranking_resumen(ranking_id: int, anio: int) -> str:
    """Calcula el score total (suma ponderada de métricas) por universidad para un ranking y año, de mayor a menor.

    Args:
        ranking_id: ID del ranking.
        anio: Año a consultar.
    """
    db = SessionLocal()
    try:
        rows = db.execute(
            text("""
                SELECT u.nombre_universidad,
                       COALESCE(SUM(mu.valor_metrica * (m.peso_metrica / 100.0)), 0) AS score_total
                FROM ranking r
                JOIN metrica m ON m.id_ranking = r.id_ranking
                JOIN metrica_universidad mu ON mu.id_metrica = m.id_metrica
                JOIN universidad u ON u.id_universidad = mu.id_universidad
                WHERE r.id_ranking = :rid AND mu.anio_metrica = :anio
                GROUP BY u.nombre_universidad
                ORDER BY score_total DESC
            """),
            {"rid": ranking_id, "anio": anio},
        ).fetchall()
        if not rows:
            return "No hay datos para ese ranking en ese año."
        return "\n".join(f"{i + 1}. {r.nombre_universidad}: {r.score_total:.2f}" for i, r in enumerate(rows))
    finally:
        db.close()


TOOLS = [
    listar_rankings,
    listar_universidades,
    listar_metricas,
    consultar_tendencia,
    consultar_ranking_resumen,
]


CONSOLA_BILLING = "platform.claude.com/settings/billing"

# El saldo agotado llega como 400 invalid_request_error; el texto exacto lo fija
# Anthropic, así que se comprueban varias señales. Ver docs/asistente-creditos.md.
SENALES_SIN_CREDITO = ("credit balance", "insufficient credit", "purchase credits", "plans & billing")

# Distinto del anterior: aquí hay saldo, pero se alcanzó un tope de gasto que
# alguien configuró en la consola. También llega como 400.
SENALES_TOPE_PROPIO = ("you have reached your specified api usage limits",
                       "you have reached your specified workspace api usage limits")


def _detalle_error(e) -> str:
    """Texto del error en minúsculas, para buscar señales sin reventar si falta."""
    try:
        return str(e).lower()
    except Exception:
        return ""


def _es_tope_de_gasto_mensual(e) -> bool:
    """Un 429 puede ser rate limit (se reintenta en segundos) o el tope mensual de
    gasto de la organización (no se recupera hasta el día 1 del mes siguiente).
    La API los distingue con error.details.error_code."""
    cuerpo = getattr(e, "body", None)
    if isinstance(cuerpo, dict):
        detalles = (cuerpo.get("error") or {}).get("details") or {}
        if detalles.get("error_code") == "enforced_spend_limit_reached":
            return True
    return "enforced_spend_limit_reached" in _detalle_error(e)


def _resultado(texto: str, entrada: int = 0, salida: int = 0, ok: bool = True) -> dict:
    """Forma única de respuesta del asistente: texto, consumo y si fue exitosa.

    Los mensajes de error también viajan por aquí, con consumo cero, para que
    la capa superior no tenga que distinguir entre respuesta y fallo al mostrar.
    """
    return {"texto": texto, "tokens_entrada": entrada, "tokens_salida": salida,
            "modelo": MODEL, "ok": ok}


def responder(mensajes: list[dict]) -> dict:
    entrada = salida = 0
    try:
        runner = client.beta.messages.tool_runner(
            model=MODEL,
            max_tokens=4096,
            output_config={"effort": "medium"},
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=mensajes,
        )
        final = None
        for message in runner:
            final = message
            # El ciclo de herramientas hace varias llamadas a la API; el consumo
            # es la suma de todas, no solo el de la última.
            uso = getattr(message, "usage", None)
            if uso is not None:
                entrada += (getattr(uso, "input_tokens", 0) or 0)
                entrada += (getattr(uso, "cache_read_input_tokens", 0) or 0)
                entrada += (getattr(uso, "cache_creation_input_tokens", 0) or 0)
                salida += (getattr(uso, "output_tokens", 0) or 0)

    # El orden importa: las tres primeras son subclases de APIStatusError y deben
    # ir antes que ella, de lo más específico a lo más general.
    except anthropic.AuthenticationError:
        return _resultado(("La clave de la API de Claude no es válida, fue revocada o expiró. "
                "Hay que generar una nueva y ponerla en ANTHROPIC_API_KEY (backend/.env). "
                "Ver docs/asistente-creditos.md."), ok=False)
    except anthropic.PermissionDeniedError:
        return _resultado(("La clave de la API no tiene permiso para usar este modelo o su workspace está "
                f"deshabilitado. Revisa los permisos de la clave en {CONSOLA_BILLING.split('/')[0]}."), ok=False)
    except anthropic.NotFoundError:
        return _resultado((f"El modelo '{MODEL}' no existe o no está habilitado para esta cuenta. "
                "Revisa el identificador del modelo en backend/app/assistant.py."), ok=False)
    except anthropic.RateLimitError as e:
        # Un 429 no siempre es un pico de tráfico: también es el tope de gasto
        # mensual de la organización, que no se recupera reintentando.
        if _es_tope_de_gasto_mensual(e):
            return _resultado(("La organización alcanzó su tope de gasto mensual en la API. El acceso se "
                    "restablece el día 1 del mes siguiente, o antes si se sube el límite en "
                    f"{CONSOLA_BILLING} (ver docs/asistente-creditos.md)."), ok=False)
        return _resultado("El asistente recibió demasiadas solicitudes en poco tiempo. Espera unos segundos y vuelve a intentar.", ok=False)
    except anthropic.BadRequestError as e:
        detalle = _detalle_error(e)
        if any(s in detalle for s in SENALES_SIN_CREDITO):
            return _resultado(("La cuenta de Anthropic se quedó sin créditos. Hay que recargar saldo en "
                    f"{CONSOLA_BILLING} (ver docs/asistente-creditos.md)."), ok=False)
        if any(s in detalle for s in SENALES_TOPE_PROPIO):
            return _resultado(("Se alcanzó el límite de gasto configurado manualmente para esta cuenta o "
                    f"workspace. Súbelo o quítalo en {CONSOLA_BILLING} (ver docs/asistente-creditos.md)."), ok=False)
        return _resultado("El asistente rechazó la solicitud (parámetros inválidos). Intenta reformular tu consulta.", ok=False)
    except anthropic.APITimeoutError:
        return _resultado("El asistente tardó demasiado en responder. Vuelve a intentarlo con una consulta más acotada.", ok=False)
    except anthropic.APIConnectionError:
        return _resultado("No se pudo conectar con la API de Claude. Verifica la conexión a internet del servidor.", ok=False)
    except anthropic.APIStatusError as e:
        # 402 billing_error: el SDK de Python no tiene clase propia para este
        # código, así que se distingue aquí. Es un problema de medio de pago,
        # no de saldo consumido.
        if e.status_code == 402:
            return _resultado(("Hay un problema con la facturación o el medio de pago de la cuenta de "
                    f"Anthropic. Revisa los datos de pago en {CONSOLA_BILLING} "
                    "(ver docs/asistente-creditos.md)."), ok=False)
        if e.status_code >= 500:
            return _resultado((f"El servicio de IA está caído o sobrecargado (código {e.status_code}). "
                    "Intenta de nuevo en unos minutos."), ok=False)
        return _resultado(f"El servicio de IA respondió con un error (código {e.status_code}): {e.message}", ok=False)
    except Exception as e:
        # Red de seguridad: si falla una herramienta (por ejemplo, la base de datos
        # caída) la excepción no debe propagarse y convertirse en un 500 opaco,
        # porque el frontend lo mostraría como "no se pudo contactar al asistente".
        logger.exception("Fallo inesperado en el asistente")
        return _resultado(
            f"El asistente falló al procesar la consulta ({type(e).__name__}). "
            "Revisa los logs del backend; puede ser un problema con la base de datos.",
            entrada, salida, ok=False)

    if final is None:
        return _resultado("No se obtuvo respuesta del modelo.", entrada, salida, ok=False)

    if getattr(final, "stop_reason", None) == "refusal":
        return _resultado("El modelo declinó responder a esa consulta por sus políticas de uso. Reformúlala.", entrada, salida, ok=False)

    texto = next((b.text for b in final.content if b.type == "text"), "")
    if not texto:
        return _resultado("El modelo no devolvió una respuesta de texto.", entrada, salida, ok=False)
    return _resultado(texto, entrada, salida, ok=True)
