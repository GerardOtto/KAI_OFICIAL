"""Comprueba las herramientas nuevas contra la base real y, sobre todo, que la
consulta SQL libre no pueda alcanzar las tablas de usuarios ni escribir nada."""
import os
import sys

import os
import sys

# La raíz del backend se resuelve desde la ubicación de este archivo, no desde una
# ruta de una máquina concreta: es lo que permite ejecutar la batería en otro
# equipo y en integración continua.
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from dotenv import load_dotenv

load_dotenv(os.path.join(RAIZ, ".env"))
from app import herramientas as h

fallos = []


def comprobar(nombre, condicion, detalle=""):
    print(f"  [{'OK ' if condicion else 'FALLA'}] {nombre}" + ("" if condicion else f" -> {detalle}"))
    if not condicion:
        fallos.append(nombre)


print("=== 1. El guardián rechaza lo que debe rechazar ===")
PROHIBIDAS = [
    ("tabla de usuarios", "SELECT * FROM usuario"),
    ("usuarios con alias", "SELECT u.correo_usuario FROM usuario u LIMIT 5"),
    ("mensajes de conversaciones", "SELECT contenido FROM mensaje LIMIT 10"),
    ("conversaciones", "SELECT titulo FROM conversacion"),
    ("notificaciones", "SELECT mensaje FROM notificacion"),
    ("planes", "SELECT * FROM plan"),
    ("subconsulta a usuario", "SELECT nombre_ranking FROM ranking WHERE id_ranking IN (SELECT id_usuario FROM usuario)"),
    ("join oculto a usuario", "SELECT r.nombre_ranking FROM ranking r JOIN usuario u ON true"),
    ("catálogo del sistema", "SELECT tablename FROM pg_tables"),
    ("information_schema", "SELECT table_name FROM information_schema.tables"),
    ("escritura", "INSERT INTO ranking (nombre_ranking) VALUES ('x')"),
    ("borrado", "DELETE FROM metrica WHERE id_metrica = 1"),
    ("actualización", "UPDATE universidad SET nombre_universidad = 'x'"),
    ("DDL", "DROP TABLE universidad"),
    ("dos sentencias", "SELECT 1 FROM ranking; DROP TABLE ranking"),
    ("sentencia oculta tras comentario", "SELECT 1 FROM ranking -- \nUNION SELECT id_usuario FROM usuario"),
    ("comentario de bloque", "SELECT /* truco */ correo_usuario FROM usuario"),
    ("esquema explícito", "SELECT * FROM public.usuario"),
    ("función de archivo", "SELECT pg_read_file('/etc/passwd')"),
    ("dormir la base", "SELECT pg_sleep(30)"),
    # Formas de nombrar la tabla que se saltaban el análisis de relaciones.
    ("identificador entre comillas", 'SELECT correo_usuario FROM "usuario" LIMIT 2'),
    ("esquema y tabla entre comillas", 'SELECT contenido FROM "public"."mensaje" LIMIT 2'),
    ("comillas con espacios", 'SELECT * FROM   "usuario"'),
    ("mayúsculas y comillas", 'SELECT * FROM "USUARIO"'),
    ("usuario en un CTE", "WITH x AS (SELECT id_usuario FROM usuario) SELECT * FROM x"),
    ("union con usuario", "SELECT nombre_ranking FROM ranking UNION ALL SELECT correo_usuario FROM usuario"),
    ("plan de suscripción", "SELECT codigo_plan, precio_mensual_usd FROM plan"),
    ("en plural", "SELECT * FROM usuarios"),
]
for nombre, sql in PROHIBIDAS:
    salida = h.consulta_sql(sql)
    comprobar(f"rechaza: {nombre}", salida.startswith("ERROR"), salida[:120])

print("\n=== 2. El guardián deja pasar lo legítimo ===")
PERMITIDAS = [
    ("consulta simple", "SELECT nombre_ranking FROM ranking ORDER BY id_ranking LIMIT 3"),
    ("join de tres tablas",
     "SELECT u.nombre_universidad, m.nombre_metrica, mu.valor_metrica "
     "FROM metrica_universidad mu JOIN metrica m ON m.id_metrica = mu.id_metrica "
     "JOIN universidad u ON u.id_universidad = mu.id_universidad WHERE mu.anio_metrica = 2024 LIMIT 5"),
    ("agregación", "SELECT disciplina, count(*) FROM metrica GROUP BY disciplina ORDER BY 2 DESC LIMIT 5"),
    ("CTE", "WITH top AS (SELECT id_universidad, count(*) n FROM metrica_universidad GROUP BY 1) "
            "SELECT u.nombre_universidad, top.n FROM top JOIN universidad u USING (id_universidad) "
            "ORDER BY top.n DESC LIMIT 5"),
    ("científicos", "SELECT nombre_cientifico, campo_principal FROM cientifico LIMIT 3"),
    ("punto y coma final", "SELECT count(*) FROM ranking;"),
]
for nombre, sql in PERMITIDAS:
    salida = h.consulta_sql(sql)
    comprobar(f"ejecuta: {nombre}", not salida.startswith("ERROR"), salida[:160])

print("\n=== 3. La transacción es de solo lectura de verdad ===")
# Se salta el filtro de texto llamando directo a la ejecución, para comprobar que
# la garantía la da PostgreSQL y no la expresión regular.
import app.herramientas as _h
from sqlalchemy import text as _text

db = _h.SessionLocal()
try:
    db.execute(_text("SET TRANSACTION READ ONLY"))
    try:
        db.execute(_text("CREATE TEMP TABLE colado (x int)"))
        comprobar("PostgreSQL bloquea la escritura pese al filtro", False, "la escritura pasó")
    except Exception as e:
        # El servidor responde en el idioma de su configuración regional, así que
        # se comprueba la clase del error de psycopg2, no el texto del mensaje.
        comprobar("PostgreSQL bloquea la escritura pese al filtro",
                  type(e.orig).__name__ == "ReadOnlySqlTransaction" if hasattr(e, "orig")
                  else "read" in str(e).lower(), f"{type(e).__name__}: {str(e)[:120]}")
finally:
    db.rollback()
    db.close()

print("\n=== 4. Las herramientas devuelven datos ===")
casos = [
    ("listar_rankings", lambda: h.listar_rankings()),
    ("detalle_ranking(2)", lambda: h.detalle_ranking(2)),
    ("buscar_metricas(2)", lambda: h.buscar_metricas(2)),
    ("buscar_metricas GRAS por disciplina", lambda: h.buscar_metricas(4, disciplina="Physics")),
    # La base guarda "Catolica" sin tilde: la búsqueda debe encontrarla igual.
    ("buscar_universidades('Católica') con tilde", lambda: h.buscar_universidades("Católica")),
    ("buscar_universidades('catolica') sin tilde", lambda: h.buscar_universidades("catolica")),
    ("buscar_universidades('VALPARAÍSO') en mayúsculas", lambda: h.buscar_universidades("VALPARAÍSO")),
    # Los campos están en inglés; lo que se comprueba aquí es el filtro por campo
    # y que el nombre acentuado de un científico se encuentre escrito sin tildes.
    ("buscar_cientificos por campo", lambda: h.buscar_cientificos(campo="Clinical Medicine", limite=3)),
    ("buscar_cientificos nombre sin tildes", lambda: h.buscar_cientificos(texto="Rodriguez", limite=3)),
    ("buscar_cientificos nombre con tildes", lambda: h.buscar_cientificos(texto="Rodríguez", limite=3)),
    ("consultar_valores(2, 2025)", lambda: h.consultar_valores(2, 2025)),
    ("consultar_tendencia(2, 18)", lambda: h.consultar_tendencia(2, 18)),
    ("consultar_ranking_resumen(2, 2025)", lambda: h.consultar_ranking_resumen(2, 2025)),
    ("buscar_cientificos", lambda: h.buscar_cientificos(ordenar_por="h_index", limite=3)),
]
for nombre, fn in casos:
    try:
        salida = fn()
    except Exception as e:
        comprobar(nombre, False, f"{type(e).__name__}: {e}")
        continue
    util = bool(salida) and not salida.lower().startswith(("no hay", "ninguna", "ningún", "no existe"))
    comprobar(nombre, util, salida[:150])
    if util:
        print(f"         {salida.splitlines()[0][:130]}")
        print(f"         {salida.splitlines()[1][:130] if len(salida.splitlines()) > 1 else ''}")

# El perfil necesita un id que exista.
primero = h.buscar_cientificos(ordenar_por="h_index", limite=1)
try:
    cid = int(primero.splitlines()[1].split("|")[0].strip())
    salida = h.perfil_cientifico(cid)
    comprobar(f"perfil_cientifico({cid})", "Indicadores por año" in salida, salida[:150])
    print("         " + salida.splitlines()[0][:130])
except Exception as e:
    comprobar("perfil_cientifico", False, f"{type(e).__name__}: {e}")

print("\n=== 5. Esquemas de herramienta válidos para ambos motores ===")
comprobar("hay 10 herramientas", len(h.TOOLS) == 10, str(len(h.TOOLS)))
for t in h.TOOLS:
    comprobar(f"esquema de {t.name}", bool(t.description) and isinstance(t.input_schema, dict))

from app import assistant_gemini as g
comprobar("Gemini traduce las 10 declaraciones", len(g.DECLARACIONES) == len(h.TOOLS),
          str(len(g.DECLARACIONES)))

print("\n=== 6. El contexto de datos se calcula desde la base ===")
ctx = h.contexto_de_datos()
comprobar("el panorama menciona los rankings", "THE Latam" in ctx and "Shanghai GRAS" in ctx, ctx[:200])
comprobar("el prompt de sistema lo incorpora", h.system_prompt().endswith(ctx.rstrip()), "no coincide")
print(ctx)

print("\n" + "=" * 60)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
