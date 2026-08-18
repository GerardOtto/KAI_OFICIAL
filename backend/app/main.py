from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # 1. Importa el middleware
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

from .assistant import responder

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://kaioficial-production.up.railway.app" # Sin el "/" final
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/")
def root():
    return {"message": "API funcionando"}


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


@app.post("/chat")
def chat(req: ChatRequest):
    mensajes = [{"role": m.role, "content": m.content} for m in req.messages]
    return {"role": "assistant", "content": responder(mensajes)}

@app.get("/universidad")
def get_subrankings():
    db = SessionLocal()
    try:
        result = db.execute(text("SELECT * FROM universidad"))
        data = [dict(row._mapping) for row in result]
        return data
    finally:
        db.close()

@app.get("/trends")
def get_trends(ranking_id: int, metrica_id: int, universidades: str = None):
    db = SessionLocal()
    try:

        base_query = """
            SELECT 
                u.nombre_universidad AS universidad,
                mu.anio_metrica AS anio,
                mu.valor_metrica AS valor,
                u.id_universidad
            FROM metrica_universidad mu
            JOIN universidad u ON u.id_universidad = mu.id_universidad
            JOIN metrica m ON m.id_metrica = mu.id_metrica
            WHERE m.id_ranking = :ranking_id
              AND m.id_metrica = :metrica_id
        """

        params = {
            "ranking_id": ranking_id,
            "metrica_id": metrica_id
        }

        if universidades:
            ids = [int(x) for x in universidades.split(",")]
            base_query += " AND u.id_universidad = ANY(:ids)"
            params["ids"] = ids

        base_query += " ORDER BY u.nombre_universidad, mu.anio_metrica"

        result = db.execute(text(base_query), params)
        rows = [dict(row._mapping) for row in result]

        # 🔥 calcular min y max
        valores = [r["valor"] for r in rows if r["valor"] is not None]

        min_val = min(valores) if valores else 0
        max_val = max(valores) if valores else 1

        return {
            "data": rows,
            "min": min_val,
            "max": max_val
        }

    finally:
        db.close()

@app.get("/metricas")
def get_metricas(ranking_id: int):
    db = SessionLocal()
    try:
        query = text("""
            SELECT id_metrica, nombre_metrica, disciplina
            FROM metrica
            WHERE id_ranking = :ranking_id
        """)

        result = db.execute(query, {"ranking_id": ranking_id})
        return [dict(row._mapping) for row in result]

    finally:
        db.close()

@app.get("/universidades")
def get_universidades():
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT id_universidad, nombre_universidad
            FROM universidad
            ORDER BY nombre_universidad
        """))

        return [dict(row._mapping) for row in result]

    finally:
        db.close()

@app.get("/rankings")
def get_rankings():
    db = SessionLocal()
    try:
        result = db.execute(text("SELECT id_ranking, nombre_ranking FROM ranking ORDER BY id_ranking"))
        return [dict(row._mapping) for row in result]
    finally:
        db.close()

@app.get("/simulacion")
def get_simulacion(ranking_id: int, anio: int, universidades: str = None):
    db = SessionLocal()
    try:
        params = {"ranking_id": ranking_id, "anio": anio}
        uni_filter = ""
        if universidades:
            ids = [int(x) for x in universidades.split(",")]
            uni_filter = "AND u.id_universidad = ANY(:ids)"
            params["ids"] = ids

        query = text(f"""
            SELECT
                u.id_universidad,
                u.nombre_universidad,
                m.id_metrica,
                m.nombre_metrica,
                m.disciplina,
                m.peso_metrica,
                mu.valor_metrica,
                mu.anio_metrica
            FROM metrica m
            JOIN metrica_universidad mu ON mu.id_metrica = m.id_metrica
            JOIN universidad u ON u.id_universidad = mu.id_universidad
            WHERE m.id_ranking = :ranking_id
              AND mu.anio_metrica = :anio
              {uni_filter}
            ORDER BY u.nombre_universidad, m.id_metrica
        """)

        rows = [dict(row._mapping) for row in db.execute(query, params)]
        return rows
    finally:
        db.close()

@app.get("/anios")
def get_anios(ranking_id: int):
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT DISTINCT mu.anio_metrica
            FROM metrica_universidad mu
            JOIN metrica m ON m.id_metrica = mu.id_metrica
            WHERE m.id_ranking = :ranking_id
            ORDER BY mu.anio_metrica DESC
        """), {"ranking_id": ranking_id})
        return [row._mapping["anio_metrica"] for row in result]
    finally:
        db.close()

@app.get("/ranking-resumen")
def get_ranking_resumen(ranking_id: int, anio: int):
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT
                r.id_ranking,
                r.nombre_ranking,
                r.descripcion_ranking,
                u.id_universidad,
                u.nombre_universidad,
                u.pais_universidad,
                COALESCE(SUM(mu.valor_metrica * (m.peso_metrica / 100.0)), 0) AS score_total
            FROM ranking r
            JOIN metrica m ON m.id_ranking = r.id_ranking
            JOIN metrica_universidad mu ON mu.id_metrica = m.id_metrica
            JOIN universidad u ON u.id_universidad = mu.id_universidad
            WHERE r.id_ranking = :ranking_id
              AND mu.anio_metrica = :anio
            GROUP BY r.id_ranking, r.nombre_ranking, r.descripcion_ranking,
                     u.id_universidad, u.nombre_universidad, u.pais_universidad
            ORDER BY score_total DESC
        """), {"ranking_id": ranking_id, "anio": anio})
        rows = [dict(row._mapping) for row in result]
        return rows
    finally:
        db.close()

@app.get("/tipos-metrica")
def get_tipos_metrica():
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT DISTINCT tipo_metrica
            FROM metrica
            WHERE tipo_metrica IS NOT NULL
            ORDER BY tipo_metrica
        """))
        return [row._mapping["tipo_metrica"] for row in result]
    finally:
        db.close()

@app.get("/metricas-por-tipo")
def get_metricas_por_tipo(tipo: str):
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT
                m.id_metrica,
                m.nombre_metrica,
                m.descripcion_metrica,
                m.peso_metrica,
                m.tipo_metrica,
                m.disciplina,
                r.id_ranking,
                r.nombre_ranking
            FROM metrica m
            JOIN ranking r ON r.id_ranking = m.id_ranking
            WHERE m.tipo_metrica = :tipo
            ORDER BY r.nombre_ranking, m.nombre_metrica
        """), {"tipo": tipo})
        return [dict(row._mapping) for row in result]
    finally:
        db.close()

@app.get("/valores-metrica-universidad")
def get_valores_metrica_universidad(tipo: str, universidad_id: int, anio: int):
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT
                m.id_metrica,
                m.nombre_metrica,
                m.tipo_metrica,
                m.disciplina,
                r.nombre_ranking,
                mu.valor_metrica,
                mu.anio_metrica
            FROM metrica m
            JOIN ranking r ON r.id_ranking = m.id_ranking
            JOIN metrica_universidad mu ON mu.id_metrica = m.id_metrica
            WHERE m.tipo_metrica = :tipo
              AND mu.id_universidad = :universidad_id
              AND mu.anio_metrica = :anio
            ORDER BY r.nombre_ranking, m.nombre_metrica
        """), {"tipo": tipo, "universidad_id": universidad_id, "anio": anio})
        return [dict(row._mapping) for row in result]
    finally:
        db.close()

FUENTE_TOP2 = "Stanford/Elsevier - World's Top 2% Scientists"
FUENTE_SCOPUS_PUCV = "Scopus - Censo institucional PUCV"

@app.get("/cientificos-fuentes")
def get_cientificos_fuentes():
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT fuente, count(*) AS total
            FROM cientifico_metrica
            GROUP BY fuente
            ORDER BY fuente
        """))
        return [dict(row._mapping) for row in result]
    finally:
        db.close()

@app.get("/cientificos")
def get_cientificos(
    fuente: str = FUENTE_TOP2,
    campo: str = None,
    universidad_id: int = None,
    q: str = None,
    topico: str = None,
):
    db = SessionLocal()
    try:
        params = {"fuente": fuente}
        filtros = ["cm.fuente = :fuente"]
        if campo:
            filtros.append("c.campo_principal = :campo")
            params["campo"] = campo
        if universidad_id:
            filtros.append("c.id_universidad = :universidad_id")
            params["universidad_id"] = universidad_id
        if q:
            filtros.append("c.nombre_cientifico ILIKE :q")
            params["q"] = f"%{q}%"
        if topico:
            filtros.append("""
                EXISTS (
                    SELECT 1 FROM cientifico_topico ct
                    WHERE ct.id_cientifico = c.id_cientifico
                      AND ct.topico ILIKE :topico
                )
            """)
            params["topico"] = f"%{topico}%"
        where_clause = "WHERE " + " AND ".join(filtros)

        query = text(f"""
            SELECT
                c.id_cientifico,
                c.nombre_cientifico,
                c.id_universidad,
                u.nombre_universidad,
                c.institucion_original,
                c.pais_cientifico,
                c.orcid,
                c.campo_principal,
                c.subcampo_principal,
                c.anio_primera_publicacion,
                c.anio_ultima_publicacion,
                cm.fuente,
                cm.anio_datos,
                cm.rank_global,
                cm.rank_global_ns,
                cm.h_index,
                cm.hm_index,
                cm.citas_totales,
                cm.num_articulos,
                cm.composite_score,
                cm.self_citation_pct,
                COALESCE(tt.topics_top3, '[]'::json) AS topics_top3,
                COALESCE(tt.topics_total, 0) AS topics_total
            FROM cientifico c
            JOIN cientifico_metrica cm ON cm.id_cientifico = c.id_cientifico
            LEFT JOIN universidad u ON u.id_universidad = c.id_universidad
            LEFT JOIN LATERAL (
                SELECT
                    (SELECT json_agg(row_to_json(top))
                     FROM (
                        SELECT ct.topico, ct.autor_documentos
                        FROM cientifico_topico ct
                        WHERE ct.id_cientifico = c.id_cientifico AND ct.fuente = cm.fuente
                        ORDER BY ct.autor_documentos DESC NULLS LAST, ct.topico
                        LIMIT 3
                     ) top) AS topics_top3,
                    (SELECT count(*) FROM cientifico_topico ct2
                     WHERE ct2.id_cientifico = c.id_cientifico AND ct2.fuente = cm.fuente) AS topics_total
            ) tt ON true
            {where_clause}
            ORDER BY cm.rank_global ASC NULLS LAST, cm.h_index DESC NULLS LAST
        """)
        result = db.execute(query, params)
        return [dict(row._mapping) for row in result]
    finally:
        db.close()

@app.get("/cientificos/{id_cientifico}/topicos")
def get_cientifico_topicos(id_cientifico: int, fuente: str = None):
    db = SessionLocal()
    try:
        params = {"id_cientifico": id_cientifico}
        fuente_clause = ""
        if fuente:
            fuente_clause = "AND fuente = :fuente"
            params["fuente"] = fuente
        result = db.execute(text(f"""
            SELECT topico, fuente, anio_datos, autor_documentos, topico_fwci
            FROM cientifico_topico
            WHERE id_cientifico = :id_cientifico
            {fuente_clause}
            ORDER BY autor_documentos DESC NULLS LAST, topico
        """), params)
        return [dict(row._mapping) for row in result]
    finally:
        db.close()

@app.get("/cientificos-campos")
def get_cientificos_campos():
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT DISTINCT campo_principal
            FROM cientifico
            WHERE campo_principal IS NOT NULL
            ORDER BY campo_principal
        """))
        return [row._mapping["campo_principal"] for row in result]
    finally:
        db.close()

@app.get("/metricas-con-datos")
def get_metricas_con_datos(ranking_id: int):
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT m.id_metrica, m.nombre_metrica, m.disciplina,
                   MIN(mu.anio_metrica) AS anio_min, MAX(mu.anio_metrica) AS anio_max
            FROM metrica m
            JOIN metrica_universidad mu ON mu.id_metrica = m.id_metrica
            WHERE m.id_ranking = :ranking_id
            GROUP BY m.id_metrica, m.nombre_metrica, m.disciplina
            ORDER BY m.nombre_metrica, m.disciplina
        """), {"ranking_id": ranking_id})
        return [dict(row._mapping) for row in result]
    finally:
        db.close()