from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # 1. Importa el middleware
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

app = FastAPI()

# 2. Configura el middleware de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Permite todos los dominios. En producción, cámbialo por tu URL (ej: ["http://localhost:3000"])
    allow_credentials=True,
    allow_methods=["*"], # Permite todos los métodos (GET, POST, etc.)
    allow_headers=["*"], # Permite todos los encabezados
)

@app.get("/")
def root():
    return {"message": "API funcionando"}

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
            SELECT id_metrica, nombre_metrica
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