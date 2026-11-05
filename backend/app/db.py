"""Conexión a PostgreSQL: un solo motor y una sola fábrica de sesiones para todo el backend.

Antes `main.py` creaba un segundo motor sobre la misma base, con su propio pool:
el doble de conexiones abiertas sin necesidad.

`pool_pre_ping` comprueba cada conexión antes de entregarla. En Railway, el proxy
de la base corta las conexiones inactivas; sin la comprobación, la primera
petición después de un rato sin uso fallaba con «server closed the connection
unexpectedly». `pool_recycle` las renueva cada media hora por la misma razón.

La consulta SQL libre del asistente usa además su propio motor, con un usuario
de base restringido, cuando se configura DATABASE_URL_ASISTENTE (ver
herramientas.py).
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=1800)
SessionLocal = sessionmaker(bind=engine)
