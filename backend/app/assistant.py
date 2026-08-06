import anthropic
from anthropic import Anthropic, beta_tool
from sqlalchemy import text

from .db import SessionLocal

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


def responder(mensajes: list[dict]) -> str:
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
    except anthropic.AuthenticationError:
        return "La clave de la API de Claude no es válida o falta en el backend. Revisa ANTHROPIC_API_KEY en backend/.env."
    except anthropic.RateLimitError:
        return "El asistente recibió demasiadas solicitudes en poco tiempo. Espera unos segundos y vuelve a intentar."
    except anthropic.BadRequestError as e:
        if "credit balance" in str(e).lower():
            return "La cuenta de Anthropic no tiene créditos disponibles. Ve a console.anthropic.com/settings/billing para recargar saldo."
        return "El asistente rechazó la solicitud (parámetros inválidos). Intenta reformular tu consulta."
    except anthropic.APIConnectionError:
        return "No se pudo conectar con la API de Claude. Verifica la conexión a internet del servidor."
    except anthropic.APIStatusError as e:
        return f"El servicio de IA respondió con un error (código {e.status_code}). Intenta de nuevo más tarde."

    if final is None:
        return "No se obtuvo respuesta del modelo."

    texto = next((b.text for b in final.content if b.type == "text"), "")
    return texto or "El modelo no devolvió una respuesta de texto."
