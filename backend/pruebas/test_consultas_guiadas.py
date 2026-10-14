"""Los informes de brechas que el chat pide con un botón (consultas guiadas).

Cada botón manda un mensaje con una pregunta visible y, tras una marca, las
instrucciones y una consulta SQL que arma el informe entero. Esa consulta vive
en el frontend (`src/components/asistente/consultasGuiadas.js`) y la ejecuta el
asistente con `consulta_sql`, así que un cambio de esquema —o una palabra que el
guardián rechace— rompería el botón sin que nada más lo notara. Esta batería
genera los cuatro mensajes con Node, desde ese mismo módulo, y comprueba:

  1. que el mensaje lleva la pregunta delante y el servidor titula con ella;
  2. que cada consulta pasa el guardián y arma un informe completo y bien formado;
  3. que con el plan gratuito QS y THE no entregan datos, y Scimago y KAI sí;
  4. que las cifras de Scimago son las del informe que se validó a mano.

Requiere Node (cualquier versión con módulos ES) además de la base.
"""
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from dotenv import load_dotenv

load_dotenv(os.path.join(RAIZ, ".env"))
from app import acceso, herramientas as h  # noqa: E402
from app.conversaciones import titulo_desde_mensaje, LIMITE_TITULO  # noqa: E402
from app.db import SessionLocal  # noqa: E402

MODULO = pathlib.Path(RAIZ).parent / "frontend" / "kai-project" / "src" / "components" / "asistente" / "consultasGuiadas.js"

fallos = []


def comprobar(nombre, condicion, detalle=""):
    print(f"  [{'OK ' if condicion else 'FALLA'}] {nombre}" + ("" if condicion else f" -> {detalle}"))
    if not condicion:
        fallos.append(nombre)


def generar() -> list[dict]:
    """Los cuatro mensajes, tal como los construye la interfaz."""
    codigo = """
const m = await import(process.argv[1]);
console.log(JSON.stringify(m.CONSULTAS_GUIADAS.map(c => {
  const mensaje = m.construirMensaje(c);
  return { id: c.id, ranking: c.ranking, pregunta: c.pregunta, sql: m.consultaSQL(c), mensaje,
           visible: m.parteVisible(mensaje), detectada: m.consultaDeMensaje(mensaje)?.id ?? null,
           normal: m.parteVisible('Una pregunta escrita a mano'),
           normalDetectada: m.consultaDeMensaje('Una pregunta escrita a mano') };
})));
"""
    salida = subprocess.run(["node", "--input-type=module", "-e", codigo, MODULO.as_uri()],
                            capture_output=True, text=True, encoding="utf-8", timeout=60)
    if salida.returncode != 0:
        raise RuntimeError(salida.stderr[:600])
    return json.loads(salida.stdout)


print("=== 0. El módulo de la interfaz genera los mensajes ===")
if shutil.which("node") is None:
    comprobar("Node está instalado", False, "la batería necesita `node` en el PATH")
    sys.exit(1)
try:
    consultas = generar()
except Exception as e:  # noqa: BLE001 — cualquier fallo aquí invalida el resto
    comprobar("el módulo se importa y genera los mensajes", False, str(e))
    sys.exit(1)
comprobar("hay un botón por ranking, en orden: QS, THE, Scimago y KAI",
          [c["ranking"] for c in consultas] == ["QS Latam", "THE Latam", "Scimago Latam", "Ranking KAI"],
          str([c["ranking"] for c in consultas]))

print("\n=== 1. Lo que ve el usuario y lo que recibe el modelo ===")
for c in consultas:
    comprobar(f"{c['id']}: el usuario ve solo la pregunta", c["visible"] == c["pregunta"], repr(c["visible"]))
    comprobar(f"{c['id']}: el mensaje se reconoce como consulta guiada", c["detectada"] == c["id"],
              str(c["detectada"]))
    comprobar(f"{c['id']}: el modelo recibe la consulta completa", c["sql"] in c["mensaje"])
    # Una frase que sirva de respuesta dentro del prompt es un atajo: Gemini
    # respondió una vez el aviso de «no hay datos» sin ejecutar la consulta.
    comprobar(f"{c['id']}: el mensaje no trae una respuesta lista para copiar",
              not re.search(r"No hay datos|no se encontraron", c["mensaje"], re.I))
    comprobar(f"{c['id']}: el título de la conversación es la pregunta entera",
              titulo_desde_mensaje(c["mensaje"]) == c["pregunta"] and len(c["pregunta"]) <= LIMITE_TITULO,
              titulo_desde_mensaje(c["mensaje"]))
normal = consultas[0]
comprobar("un mensaje escrito a mano se muestra entero y no se toma por guiado",
          normal["normal"] == "Una pregunta escrita a mano" and normal["normalDetectada"] is None,
          f"{normal['normal']!r} {normal['normalDetectada']!r}")

print("\n=== 2. Cada consulta arma su informe ===")
CABECERA = "informe\n> **Cómo leer este informe**"
informes = {}
for c in consultas:
    motivo = h._revisar_sql(c["sql"])
    comprobar(f"{c['id']}: el guardián de consulta_sql la acepta", motivo is None, str(motivo))
    salida = h.consulta_sql(c["sql"])
    informes[c["id"]] = salida
    comprobar(f"{c['id']}: devuelve el informe y no un error", salida.startswith(CABECERA), salida[:200])

    secciones = re.findall(r"^## (.+)$", salida, re.M)
    comprobar(f"{c['id']}: una sección por universidad, PUCV primero",
              len(secciones) == 2 and "(PUCV)" in secciones[0] and "(UV)" in secciones[1], str(secciones))
    comprobar(f"{c['id']}: cada sección dice su lugar en el total",
              all(re.search(r": \d+\.º de \d+ en Chile$", s) for s in secciones), str(secciones))

    filas = [l for l in salida.splitlines() if l.startswith("| ")]
    cabeceras = [l for l in filas if "| Hoy |" in l]
    datos = [l for l in filas if "| Hoy |" not in l]
    comprobar(f"{c['id']}: dos tablas con su fila de alineación",
              len(cabeceras) == 2 and salida.count("|---|---:|---:|---|---:|---:|") == 2, str(len(cabeceras)))
    comprobar(f"{c['id']}: todas las filas tienen las seis columnas",
              datos and all(l.count("|") == 7 for l in datos), str([l for l in datos if l.count("|") != 7]))
    comprobar(f"{c['id']}: entre 4 y 7 filas por universidad", 8 <= len(datos) <= 14, str(len(datos)))
    comprobar(f"{c['id']}: dos prioridades marcadas por universidad",
              salida.count("· **prioridad 1**") == 2 and salida.count("· **prioridad 2**") == 2)
    comprobar(f"{c['id']}: un «Dónde enfocarse» con dos puntos por universidad",
              salida.count("**Dónde enfocarse**") == 2
              and len(re.findall(r"^[12]\. \*\*", salida, re.M)) == 4)
    comprobar(f"{c['id']}: cierra con el glosario y la fuente",
              "**Qué mide cada " in salida and re.search(r"\n\*Fuente: .+\*$", salida) is not None,
              salida[-250:])
    # Una celda vacía es «| |» en la misma línea; entre dos filas hay un salto.
    hueco = re.search(r"\bNone\b|\bnull\b|\( *\)|\*\*\*\*|\|[ \t]*\|", salida)
    comprobar(f"{c['id']}: sin huecos ni valores nulos", hueco is None,
              hueco and salida[max(0, hueco.start() - 60):hueco.end() + 20])
    # Un punto seguido de una o dos cifras es un decimal en inglés; el de miles
    # («1.234») lleva tres, y el de los ordinales («28.º»), una letra.
    decimal_con_punto = re.search(r"\d\.\d{1,2}(?!\d)", salida)
    comprobar(f"{c['id']}: las cifras usan coma decimal", decimal_con_punto is None,
              decimal_con_punto and salida[max(0, decimal_con_punto.start() - 60):decimal_con_punto.end() + 20])

print("\n=== 3. Plan gratuito: QS y THE no entregan datos ===")
with SessionLocal() as db:
    vedados = acceso.ids_restringidos(db)
with h.con_rankings_vedados(vedados):
    for c in consultas:
        salida = h.consulta_sql(c["sql"])
        if c["ranking"].startswith(("QS", "THE")):
            # Sin datos la celda llega vacía. No se rellena con un aviso: el
            # aviso quedaría escrito en el prompt y el modelo lo copió una vez
            # sin ejecutar la consulta.
            comprobar(f"{c['id']}: con el plan gratuito la celda llega vacía",
                      salida.strip() == "informe", salida[:200])
        else:
            comprobar(f"{c['id']}: con el plan gratuito arma el mismo informe",
                      salida == informes[c["id"]], salida[:200])

print("\n=== 4. Scimago: las cifras del informe validado ===")
scimago = informes.get("brechas-scimago", "")
ESPERADO = [
    "## Pontificia Universidad Católica de Valparaíso (PUCV): 9.º de 57 en Chile",
    "universidades chilenas de Scimago 2023 en cada métrica",
    "| Impacto normalizado · **prioridad 1** | 0,91 | 28.º de 57 | Alta (13 %) | 1,09 (14.º) | 1,15 |",
    "| Impacto tecnológico · **prioridad 2** | 0,90 % | 16.º de 57 | Alta (10 %) | — | 1,15 % |",
    "| Acceso abierto | 67,8 % | 34.º de 57 | Baja (2 %) | 73,0 % (17.º) | 77,8 % |",
    "| Patentes | 13 | 15.º de 57 | Alta (10 %) | — | 17 |",
    "## Universidad de Valparaíso (UV): 13.º de 57 en Chile",
    "| Impacto tecnológico · **prioridad 2** | 0,60 % | 27.º de 57 | Alta (10 %) | 1,04 % (14.º) | 1,15 % |",
    "| Excelencia con liderazgo | 92 | 19.º de 56 | Media (8 %) | — | 157 |",
    "pasar de 0,91 a **1,15** (un 27 % más que hoy) la dejaría en el top 10 de esa métrica.",
    "pasar de 0,60 % a **1,15 %** (un 92 % más que hoy) la dejaría en el top 10 de esa métrica.",
]
for linea in ESPERADO:
    comprobar(f"contiene: {linea[:70]}…", linea in scimago)

print("\n=== 5. /chat entrega el informe exacto aunque la copia del modelo falle ===")
# Un modelo simulado que hace lo que hizo Gemini en vivo: ejecuta la consulta y
# la copia con una palabra traducida. El resto —sesión, cuota, herramienta,
# persistencia— es real.
import types as pytypes  # noqa: E402
import uuid  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app import assistant_gemini as g  # noqa: E402
from app.main import app  # noqa: E402

guiada = next(c for c in consultas if c["id"] == "brechas-scimago")
informe = scimago.split("\n", 1)[1]
ERRATA = ("5 % a 10 %", "5 % to 10 %")


class Uso:
    prompt_token_count, candidates_token_count = 1500, 200
    thoughts_token_count = tool_use_prompt_token_count = 0


class Respuesta:
    def __init__(self, texto="", llamadas=()):
        self.text = texto
        self.function_calls = [pytypes.SimpleNamespace(name=n, args=a) for n, a in llamadas]
        self.usage_metadata = Uso()
        self.candidates = [pytypes.SimpleNamespace(
            finish_reason="STOP", grounding_metadata=None,
            content=pytypes.SimpleNamespace(role="model", parts=[]))]


class ModeloConErrata:
    """Pide la consulta que trae el mensaje y luego «copia» con una errata."""

    def __init__(self):
        self.vuelta = 0
        self.models = pytypes.SimpleNamespace(generate_content=self._generar)

    def _generar(self, model, contents, config):
        self.vuelta += 1
        if self.vuelta % 2 == 1:
            return Respuesta(llamadas=[("consulta_sql", {"sql": guiada["sql"]})])
        if self.vuelta == 2:
            return Respuesta(texto=informe.replace(*ERRATA))
        return Respuesta(texto="Resumen libre: la PUCV queda 9.ª de 57.")


g.cliente = lambda: ModeloConErrata.instancia
g.configurado = lambda: True
ModeloConErrata.instancia = ModeloConErrata()
comprobar("la errata simulada existe en el informe", ERRATA[0] in informe)

cliente = TestClient(app)
correo = f"prueba-guiadas-{uuid.uuid4().hex[:8]}@pucv.cl"
id_usuario = None
try:
    r = cliente.post("/auth/registro", json={"nombre": "Prueba Guiadas", "correo": correo,
                                             "clave": "Prueba12345!",
                                             "institucion": "Pontificia Universidad Catolica de Valparaiso"})
    token = r.json().get("token")
    with SessionLocal() as db:
        id_usuario = db.execute(text("SELECT id_usuario FROM usuario WHERE correo_usuario = :c"),
                                {"c": correo}).scalar()
        # El asistente exige una cuenta de la PUCV vinculada a Google; el plan
        # gratuito, porque Scimago está en él.
        db.execute(text("UPDATE usuario SET plan_usuario = 'free', google_sub = :g WHERE id_usuario = :u"),
                   {"g": f"prueba-{uuid.uuid4().hex}", "u": id_usuario})
        db.commit()
    cabeceras = {"Authorization": f"Bearer {token}"}

    r = cliente.post("/chat", headers=cabeceras, json={"mensaje": guiada["mensaje"], "motor": "gemini"})
    cuerpo = r.json()
    comprobar("/chat responde la consulta guiada", r.status_code == 200 and cuerpo.get("ok") is True,
              f"{r.status_code} {str(cuerpo)[:200]}")
    comprobar("la respuesta es el informe exacto, sin la errata del modelo",
              cuerpo.get("content") == informe, (cuerpo.get("content") or "")[:200])
    id_conversacion = cuerpo.get("id_conversacion")

    r = cliente.post("/chat", headers=cabeceras,
                     json={"mensaje": "Resúmelo en una frase", "id_conversacion": id_conversacion})
    comprobar("una pregunta de seguimiento escrita a mano no se reemplaza",
              r.json().get("content") == "Resumen libre: la PUCV queda 9.ª de 57.", r.text[:200])

    datos = cliente.get(f"/conversaciones/{id_conversacion}", headers=cabeceras).json()
    mensajes = datos.get("mensajes", [])
    comprobar("el título es la pregunta visible", datos.get("titulo") == guiada["pregunta"], datos.get("titulo"))
    comprobar("se guarda el mensaje completo, con sus instrucciones",
              len(mensajes) == 4 and mensajes[0]["contenido"] == guiada["mensaje"].strip(), str(len(mensajes)))
    comprobar("y la respuesta guardada es el informe exacto",
              len(mensajes) == 4 and mensajes[1]["contenido"] == informe)
finally:
    with SessionLocal() as db:
        if id_usuario:
            db.execute(text("DELETE FROM conversacion WHERE id_usuario = :u"), {"u": id_usuario})
            db.execute(text("DELETE FROM usuario WHERE id_usuario = :u"), {"u": id_usuario})
            db.commit()
        queda = db.execute(text("SELECT count(*) FROM usuario WHERE correo_usuario = :c"), {"c": correo}).scalar()
    comprobar("el usuario de prueba se borró", queda == 0, f"quedan {queda}")

print("\n" + "=" * 64)
print(f"FALLOS: {len(fallos)}" + (f" -> {fallos}" if fallos else "  (todo correcto)"))
sys.exit(1 if fallos else 0)
