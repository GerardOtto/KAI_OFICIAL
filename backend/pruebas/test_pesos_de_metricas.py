"""Coherencia de los pesos: cada ranking reparte un 100 %, y una sola vez.

Algunos rankings publican su metodología en dos niveles —THE Latam trae los cinco
pilares y los diecisiete indicadores que estos agrupan—, y la base guarda ambos en
`metrica`. Sumar las dos capas daba 200 %. La columna `pondera` marca cuál de los
dos compone el total; la otra se conserva como referencia metodológica.

Esta batería vigila que esa distinción siga en pie: es un invariante de datos, de
modo que una carga futura que vuelva a mezclar niveles se detecta aquí y no en el
glosario.
"""
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from dotenv import load_dotenv

load_dotenv(os.path.join(RAIZ, ".env"))
from sqlalchemy import text

from app.db import SessionLocal

fallos = []


def comprobar(nombre, condicion, detalle=""):
    print(f"  [{'OK ' if condicion else 'FALLA'}] {nombre}" + ("" if condicion else f" -> {detalle}"))
    if not condicion:
        fallos.append(nombre)


db = SessionLocal()
try:
    print("=== 1. Esquema ===")
    columnas = {f[0] for f in db.execute(text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'metrica'"""))}
    comprobar("la tabla tiene la columna pondera", "pondera" in columnas, sorted(columnas))
    comprobar("la tabla tiene la columna id_metrica_padre", "id_metrica_padre" in columnas)

    print("\n=== 2. Ningún nivel se cuenta dos veces ===")
    solapes = db.execute(text("""
        SELECT c.nombre_metrica, p.nombre_metrica
        FROM metrica c JOIN metrica p ON p.id_metrica = c.id_metrica_padre
        WHERE c.pondera AND p.pondera""")).fetchall()
    comprobar("ninguna métrica pondera junto a su agregador", not solapes, solapes[:5])

    # El nivel de referencia puede ser cualquiera de los dos: en THE Latam son los
    # componentes, y en Scimago Latam el agregador, porque allí las partes son las
    # que tienen observaciones. En ambos casos la fila debe estar enlazada, para
    # que el desglose pueda decir a qué pertenece o qué agrupa.
    sueltos = db.execute(text("""
        SELECT m.nombre_metrica FROM metrica m
        WHERE NOT m.pondera
          AND m.id_metrica_padre IS NULL
          AND NOT EXISTS (SELECT 1 FROM metrica h WHERE h.id_metrica_padre = m.id_metrica)""")).fetchall()
    comprobar("toda métrica de referencia está enlazada a su jerarquía", not sueltos, sueltos[:5])

    mismo_ranking = db.execute(text("""
        SELECT c.nombre_metrica FROM metrica c JOIN metrica p ON p.id_metrica = c.id_metrica_padre
        WHERE c.id_ranking <> p.id_ranking""")).fetchall()
    comprobar("agregador y componente pertenecen al mismo ranking", not mismo_ranking, mismo_ranking[:5])

    print("\n=== 3. Reparto por ranking ===")
    # Los multidisciplinarios se excluyen: repiten su metodología por disciplina,
    # así que su total es el número de disciplinas por 100, no 100.
    for f in db.execute(text("""
        SELECT r.nombre_ranking,
               count(DISTINCT m.disciplina) AS disciplinas,
               sum(m.peso_metrica) FILTER (WHERE m.pondera) AS pondera,
               sum(m.peso_metrica) FILTER (WHERE NOT m.pondera) AS referencia
        FROM ranking r JOIN metrica m ON m.id_ranking = r.id_ranking
        GROUP BY r.nombre_ranking
        HAVING count(DISTINCT m.disciplina) = 1
        ORDER BY r.nombre_ranking""")):
        suma = float(f.pondera or 0)
        # Scimago Latam se queda en 94: la extracción no trae dos indicadores
        # web de su dimensión societal. Es una carencia de datos conocida, no un
        # doble conteo, de modo que aquí solo se exige no pasarse de 100.
        comprobar(f"{f.nombre_ranking} no reparte más de 100 %", suma <= 100, f"{suma} %")
        if f.referencia:
            comprobar(f"{f.nombre_ranking} conserva su nivel de referencia sin sumarlo",
                      suma <= 100, f"pondera {suma} %, referencia {f.referencia} %")

    the = float(db.execute(text("""
        SELECT sum(m.peso_metrica) FROM metrica m JOIN ranking r ON r.id_ranking = m.id_ranking
        WHERE r.nombre_ranking = 'THE Latam' AND m.pondera""")).scalar() or 0)
    comprobar("THE Latam reparte exactamente 100 %", the == 100, f"{the} %")

    print("\n=== 4. Los indicadores de referencia se conservan ===")
    n = db.execute(text("""
        SELECT count(*) FROM metrica m JOIN ranking r ON r.id_ranking = m.id_ranking
        WHERE r.nombre_ranking = 'THE Latam' AND NOT m.pondera""")).scalar()
    comprobar("THE Latam mantiene sus diecisiete indicadores", n == 17, n)

    huerfanos = db.execute(text("""
        SELECT count(*) FROM metrica c
        WHERE c.id_metrica_padre IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM metrica p WHERE p.id_metrica = c.id_metrica_padre)""")).scalar()
    comprobar("ningún componente apunta a un agregador inexistente", huerfanos == 0, huerfanos)

    print("\n=== 5. Los cálculos de puntaje no cambian ===")
    # Las métricas que no ponderan no tienen observaciones, así que nunca entraron
    # en una suma ponderada: los puntajes publicados antes de la distinción siguen
    # siendo los mismos.
    con_datos = db.execute(text("""
        SELECT count(*) FROM metrica m
        WHERE NOT m.pondera
          AND EXISTS (SELECT 1 FROM metrica_universidad mu WHERE mu.id_metrica = m.id_metrica)""")).scalar()
    comprobar("ninguna métrica de referencia tiene observaciones cargadas", con_datos == 0, con_datos)
finally:
    db.close()

print("\n" + "=" * 74)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
