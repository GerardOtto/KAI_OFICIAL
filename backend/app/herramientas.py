"""Lo que comparten los motores del asistente: las herramientas de consulta a la
base de datos, la instrucción de sistema y el formato de respuesta.

Las herramientas se definen una sola vez, como funciones normales de Python. El
decorador `beta_tool` de Anthropic deriva de la firma y el docstring un esquema
JSON, que es también el que se traduce al formato de declaración de funciones de
Gemini (ver `assistant_gemini.py`). Así ambos motores ejecutan exactamente el
mismo código contra la base y ven exactamente la misma descripción de cada
herramienta: si una consulta cambia, cambia para los dos.
"""
from anthropic import beta_tool
from sqlalchemy import text

from .db import SessionLocal

SYSTEM_PROMPT = """Eres el asistente de inteligencia académica de KAI, una plataforma de análisis de rankings universitarios (THE, QS Latam, Scimago, Shanghai GRAS).

Tienes herramientas para consultar la base de datos real de rankings, métricas, universidades y series históricas. Úsalas siempre que la pregunta dependa de datos concretos — nunca inventes cifras ni nombres de universidades.

Responde en español, de forma clara y concisa. Cita universidades y años cuando corresponda. Si una pregunta requiere datos que no puedes consultar con tus herramientas, dilo explícitamente en vez de adivinar.

Formato: la interfaz renderiza Markdown (GitHub Flavored Markdown).
- Usa **negrita** para las cifras y los nombres que importan. Los asteriscos van pegados al texto: `**así**`, nunca `** así **`.
- Presenta en una tabla cualquier comparación de dos o más universidades, métricas o años. Alinea a la derecha las columnas numéricas con `---:` en la fila de separación.
- Usa listas para enumeraciones y `código` para nombres exactos de métricas o identificadores.
- No abras la respuesta con un encabezado ni la cierres con un resumen de lo que acabas de decir."""


# --- Herramientas de consulta ----------------------------------------------

def listar_rankings() -> str:
    """Lista todos los rankings disponibles (id y nombre)."""
    db = SessionLocal()
    try:
        rows = db.execute(text("SELECT id_ranking, nombre_ranking FROM ranking ORDER BY id_ranking")).fetchall()
        return "\n".join(f"{r.id_ranking}: {r.nombre_ranking}" for r in rows)
    finally:
        db.close()


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


FUNCIONES = [
    listar_rankings,
    listar_universidades,
    listar_metricas,
    consultar_tendencia,
    consultar_ranking_resumen,
]

# `beta_tool` no es solo un decorador: aplicado aquí deja intactas las funciones
# originales, que el motor de Gemini invoca directamente. Cada objeto expone
# `name`, `description` e `input_schema` (esquema JSON derivado de la firma y del
# docstring), que es la fuente única de la que se traducen ambos formatos.
TOOLS = [beta_tool(f) for f in FUNCIONES]

POR_NOMBRE = {f.__name__: f for f in FUNCIONES}


# --- Contrato de respuesta de los motores ----------------------------------

def resultado(texto: str, modelo: str, motor: str,
              entrada: int = 0, salida: int = 0, ok: bool = True) -> dict:
    """Forma única de respuesta de cualquier motor del asistente.

    Los mensajes de error también viajan por aquí, con `ok=False`, para que la
    capa superior no tenga que distinguir entre respuesta y fallo al mostrar, ni
    conocer qué motor la produjo.
    """
    return {"texto": texto, "tokens_entrada": entrada, "tokens_salida": salida,
            "modelo": modelo, "motor": motor, "ok": ok}
