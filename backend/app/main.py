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