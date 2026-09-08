import logging

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware # 1. Importa el middleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()

from . import auth, conversaciones as conv, motores

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

app = FastAPI()


# Orígenes de producción: lista explícita, sin barra final.
ORIGENES_PRODUCCION = [
    "https://kaioficial-production.up.railway.app",
]

# En desarrollo se acepta cualquier puerto de localhost. Motivo: si el puerto
# habitual de Vite (5173) está ocupado, el servidor arranca en el siguiente y,
# con una lista fija, el backend responde 200 pero sin la cabecera
# 'Access-Control-Allow-Origin'. El navegador descarta entonces todas las
# respuestas y la aplicación entera parece caída, con un síntoma que no señala
# su causa. Aceptar cualquier puerto local elimina ese modo de fallo.
REGEX_LOCALHOST = r"http://(localhost|127\.0\.0\.1)(:\d+)?"


class ErroresConCORS(BaseHTTPMiddleware):
    """Convierte cualquier excepción no controlada en un JSON 500.

    Sin esto, una excepción la atrapa el middleware de errores de Starlette, que
    está POR FUERA del de CORS: la respuesta 500 sale sin la cabecera
    'Access-Control-Allow-Origin', el navegador la descarta y el cliente solo ve
    «Failed to fetch», sin rastro del error real. Al capturarla aquí —por dentro
    de CORS— la respuesta sí lleva las cabeceras y el error llega al cliente.
    """

    async def dispatch(self, request, call_next):
        try:
            return await call_next(request)
        except Exception:
            logger.exception("Error no controlado en %s %s", request.method, request.url.path)
            return JSONResponse(
                status_code=500,
                content={"detail": "Error interno del servidor. Revisa los registros del backend."},
            )


# El orden importa: add_middleware antepone, así que el último añadido queda por
# fuera. CORS debe ser el más externo para poder añadir cabeceras a la respuesta
# de error que genera el middleware de arriba.
app.add_middleware(ErroresConCORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES_PRODUCCION,
    allow_origin_regex=REGEX_LOCALHOST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/")
def root():
    return {"message": "API funcionando"}


# ---------------------------------------------------------------------------
# Autenticación
# ---------------------------------------------------------------------------

class RegistroRequest(BaseModel):
    nombre: str
    correo: str
    clave: str
    institucion: str | None = None


class LoginRequest(BaseModel):
    correo: str
    clave: str


class GoogleRequest(BaseModel):
    credential: str  # ID token emitido por Google Identity Services


def _sesion(usuario: dict) -> dict:
    """Respuesta común de los tres caminos de autenticación."""
    token, expira_en = auth.crear_token(usuario["id_usuario"], usuario["correo_usuario"])
    return {"token": token, "expira_en": expira_en, "usuario": _perfil(usuario)}


def _perfil(usuario: dict) -> dict:
    """Datos del usuario que se exponen al cliente. Nunca incluye la clave."""
    return {
        "id": usuario["id_usuario"],
        "nombre": usuario["nombre_usuario"],
        "correo": usuario["correo_usuario"],
        "institucion": usuario.get("institucion_usuario"),
        "plan": usuario.get("plan_usuario"),
        "nombre_plan": usuario.get("nombre_plan"),
        "avatar": usuario.get("avatar_url"),
        "con_google": usuario.get("con_google", False),
        "con_clave": usuario.get("con_clave", False),
    }


@app.get("/auth/config")
def auth_config():
    """Permite al frontend saber si puede ofrecer el acceso con Google."""
    return {
        "google_habilitado": auth.google_configurado(),
        "google_client_id": auth.GOOGLE_CLIENT_ID,
    }


@app.post("/auth/registro")
def registro(req: RegistroRequest):
    correo = (req.correo or "").strip().lower()
    auth.validar_registro(correo, req.clave, req.nombre)

    db = SessionLocal()
    try:
        existe = db.execute(
            text("SELECT id_usuario FROM usuario WHERE lower(correo_usuario) = :c"),
            {"c": correo},
        ).first()
        if existe:
            raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese correo.")

        id_usuario = db.execute(text("""
            INSERT INTO usuario (nombre_usuario, correo_usuario, clave_usuario,
                                 institucion_usuario, plan_usuario)
            VALUES (:n, :c, :k, :i, :p) RETURNING id_usuario
        """), {"n": req.nombre.strip(), "c": correo,
               "k": auth.hashear_clave(req.clave),
               "i": (req.institucion or "").strip() or None,
               "p": auth.PLAN_POR_DEFECTO}).scalar()
        db.commit()
        return _sesion(auth.buscar_usuario_por_id(db, id_usuario))
    finally:
        db.close()


@app.post("/auth/login")
def login(req: LoginRequest):
    correo = (req.correo or "").strip().lower()
    db = SessionLocal()
    try:
        fila = db.execute(text("""
            SELECT id_usuario, clave_usuario, google_sub FROM usuario
            WHERE lower(correo_usuario) = :c
        """), {"c": correo}).first()

        # Mismo mensaje para correo inexistente y clave incorrecta: revelar cuál
        # de los dos falló permitiría enumerar las cuentas registradas.
        if fila is None or not auth.verificar_clave(req.clave, fila.clave_usuario):
            if fila is not None and fila.clave_usuario is None and fila.google_sub:
                raise HTTPException(
                    status_code=401,
                    detail="Esta cuenta se creó con Google. Usa el botón «Continuar con Google».")
            raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")

        db.execute(text("UPDATE usuario SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id_usuario = :i"),
                   {"i": fila.id_usuario})
        db.commit()
        return _sesion(auth.buscar_usuario_por_id(db, fila.id_usuario))
    finally:
        db.close()


@app.post("/auth/google")
def login_google(req: GoogleRequest):
    """Registro e inicio de sesión con una cuenta de Google.

    Google devuelve un ID token firmado; aquí se verifica y se traduce a una
    sesión propia. Si el correo ya existe con contraseña local, se vincula la
    cuenta de Google a ese mismo usuario en lugar de crear un duplicado.
    """
    datos = auth.verificar_token_google(req.credential)

    db = SessionLocal()
    try:
        fila = db.execute(text("""
            SELECT id_usuario, google_sub FROM usuario
            WHERE google_sub = :g OR lower(correo_usuario) = :c
        """), {"g": datos["sub"], "c": datos["correo"]}).first()

        if fila is None:
            id_usuario = db.execute(text("""
                INSERT INTO usuario (nombre_usuario, correo_usuario, google_sub,
                                     avatar_url, correo_verificado, plan_usuario, ultimo_acceso)
                VALUES (:n, :c, :g, :a, TRUE, :p, CURRENT_TIMESTAMP)
                RETURNING id_usuario
            """), {"n": datos["nombre"], "c": datos["correo"], "g": datos["sub"],
                   "a": datos["avatar"], "p": auth.PLAN_POR_DEFECTO}).scalar()
        else:
            id_usuario = fila.id_usuario
            db.execute(text("""
                UPDATE usuario
                   SET google_sub = :g,
                       avatar_url = COALESCE(avatar_url, :a),
                       correo_verificado = TRUE,
                       ultimo_acceso = CURRENT_TIMESTAMP
                 WHERE id_usuario = :i
            """), {"g": datos["sub"], "a": datos["avatar"], "i": id_usuario})

        db.commit()
        return _sesion(auth.buscar_usuario_por_id(db, id_usuario))
    finally:
        db.close()


@app.get("/auth/yo")
def yo(usuario: dict = Depends(auth.usuario_actual)):
    db = SessionLocal()
    try:
        return {"usuario": _perfil(usuario), "cuota": conv.estado_de_cuota(db, usuario)}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Conversaciones del asistente
# ---------------------------------------------------------------------------

class NuevoTitulo(BaseModel):
    titulo: str


@app.get("/conversaciones")
def listar_conversaciones(usuario: dict = Depends(auth.usuario_actual)):
    db = SessionLocal()
    try:
        return conv.listar_conversaciones(db, usuario["id_usuario"])
    finally:
        db.close()


@app.get("/conversaciones/{id_conversacion}")
def obtener_conversacion(id_conversacion: int, usuario: dict = Depends(auth.usuario_actual)):
    db = SessionLocal()
    try:
        datos = conv.obtener_conversacion(db, id_conversacion, usuario["id_usuario"])
        if datos is None:
            raise HTTPException(status_code=404, detail="Conversación no encontrada.")
        return datos
    finally:
        db.close()


@app.delete("/conversaciones/{id_conversacion}")
def eliminar_conversacion(id_conversacion: int, usuario: dict = Depends(auth.usuario_actual)):
    db = SessionLocal()
    try:
        if not conv.eliminar_conversacion(db, id_conversacion, usuario["id_usuario"]):
            raise HTTPException(status_code=404, detail="Conversación no encontrada.")
        db.commit()
        return {"eliminada": id_conversacion}
    finally:
        db.close()


@app.patch("/conversaciones/{id_conversacion}")
def renombrar_conversacion(id_conversacion: int, req: NuevoTitulo,
                           usuario: dict = Depends(auth.usuario_actual)):
    db = SessionLocal()
    try:
        if not conv.renombrar_conversacion(db, id_conversacion, usuario["id_usuario"], req.titulo):
            raise HTTPException(status_code=404, detail="Conversación no encontrada.")
        db.commit()
        return {"id_conversacion": id_conversacion, "titulo": req.titulo}
    finally:
        db.close()


@app.get("/uso")
def uso(usuario: dict = Depends(auth.usuario_actual)):
    db = SessionLocal()
    try:
        return conv.estado_de_cuota(db, usuario)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Asistente
# ---------------------------------------------------------------------------

@app.get("/planes")
def listar_planes():
    """Planes que se ofrecen, para la portada. Público y sin sesión."""
    db = SessionLocal()
    try:
        filas = db.execute(text("""
            SELECT codigo_plan, nombre_plan, descripcion, precio_mensual_usd,
                   tokens_claude_mes, tokens_gemini_mes, mensajes_por_dia
            FROM plan WHERE publico ORDER BY orden
        """))
        return [
            {**dict(f._mapping), "precio_mensual_usd": float(f.precio_mensual_usd)}
            for f in filas
        ]
    finally:
        db.close()


@app.get("/motores")
def listar_motores(usuario: dict | None = Depends(auth.usuario_opcional)):
    """Motores del asistente y si se pueden usar ahora mismo.

    Es público a propósito: la portada anuncia con qué modelos cuenta la
    herramienta antes de que nadie inicie sesión. Con sesión, además informa de
    si el plan del usuario incluye cada motor, para que el selector pueda
    mostrarlo bloqueado en vez de dejar que la consulta falle al enviarse.
    """
    catalogo = motores.catalogo_publico()

    if usuario is not None:
        db = SessionLocal()
        try:
            cuota = conv.estado_de_cuota(db, usuario)
        finally:
            db.close()
        for m in catalogo:
            estado = cuota["motores"].get(m["id"], {})
            m["incluido_en_plan"] = estado.get("incluido", False)
            m["disponible_ahora"] = m["disponible"] and estado.get("disponible", False)
    else:
        for m in catalogo:
            m["incluido_en_plan"] = None
            m["disponible_ahora"] = m["disponible"]

    return {"motores": catalogo, "por_defecto": motores.POR_DEFECTO}


class ChatRequest(BaseModel):
    mensaje: str
    id_conversacion: int | None = None
    motor: str | None = None


@app.post("/chat")
def chat(req: ChatRequest, usuario: dict = Depends(auth.usuario_actual)):
    """Envía una consulta al asistente dentro de una conversación del usuario.

    El historial se reconstruye desde la base de datos, no se recibe del cliente:
    así el cliente no puede inyectar turnos falsos ni inflar el contexto que se
    factura, y la conversación sobrevive a un recambio de dispositivo.

    El motor solo se elige al crear la conversación. En una ya existente se usa
    el que quedó guardado y se rechaza cualquier intento de cambiarlo, porque el
    historial no es intercambiable entre proveedores (ver `motores.py`).
    """
    texto = (req.mensaje or "").strip()
    if not texto:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío.")

    db = SessionLocal()
    try:
        # 1) Qué motor atiende este turno.
        if req.id_conversacion is None:
            motor = req.motor or motores.POR_DEFECTO
            if not motores.existe(motor):
                raise HTTPException(status_code=400, detail=f"El motor '{motor}' no existe.")
            if not motores.disponible(motor):
                raise HTTPException(
                    status_code=503,
                    detail=(f"El motor {motores.nombre(motor)} no está configurado en el servidor. "
                            "Ver docs/asistente-motores.md."))
        else:
            motor = conv.motor_de_conversacion(db, req.id_conversacion, usuario["id_usuario"])
            if motor is None:
                raise HTTPException(status_code=404, detail="Conversación no encontrada.")
            if req.motor and req.motor != motor:
                # 409: la petición es válida pero incompatible con el estado del
                # recurso. El cliente debe derivar el mensaje a una conversación
                # nueva en vez de reintentar esta.
                raise HTTPException(
                    status_code=409,
                    detail=(f"Esta conversación usa {motores.nombre(motor)} y no puede cambiar de "
                            "motor. Deriva el mensaje a una conversación nueva."))

        # 2) Si el plan permite usarlo y queda cuota. Se comprueba después de
        #    conocer el motor porque la cuota es de cada uno por separado, y
        #    antes de escribir nada, para no dejar rastro de un turno rechazado.
        cuota = conv.estado_de_cuota(db, usuario)
        bloqueo = conv.motivo_de_bloqueo(cuota, motor)
        if bloqueo:
            codigo, mensaje = bloqueo
            raise HTTPException(status_code=codigo, detail=mensaje)

        # 3) La conversación se crea solo cuando el turno va a ejecutarse.
        if req.id_conversacion is None:
            id_conversacion = conv.crear_conversacion(
                db, usuario["id_usuario"], conv.titulo_desde_mensaje(texto), motor)
        else:
            id_conversacion = req.id_conversacion

        id_mensaje_usuario = conv.guardar_mensaje(db, id_conversacion, "user", texto)
        historial = conv.historial_para_modelo(db, id_conversacion)
        db.commit()

        resultado = motores.responder(motor, historial)

        era_nueva = req.id_conversacion is None
        if resultado["ok"]:
            conv.guardar_mensaje(db, id_conversacion, "assistant", resultado["texto"],
                                 resultado["tokens_entrada"], resultado["tokens_salida"],
                                 resultado["modelo"])
        else:
            # El turno no llegó a producirse: se descarta para que el historial no
            # arrastre un mensaje sin respuesta que luego se reenviaría al modelo,
            # ni un mensaje de error que el modelo leería como si fuera suyo.
            conv.descartar_turno_fallido(db, id_conversacion, id_mensaje_usuario, era_nueva)
            if era_nueva:
                # La conversación se borró con el turno: no se devuelve su id, o el
                # cliente lo reutilizaría en el mensaje siguiente y recibiría un 404.
                id_conversacion = None
        db.commit()

        return {
            "role": "assistant",
            "content": resultado["texto"],
            "ok": resultado["ok"],
            "id_conversacion": id_conversacion,
            "motor": motor,
            "modelo": resultado["modelo"],
            "uso": {
                "tokens_entrada": resultado["tokens_entrada"],
                "tokens_salida": resultado["tokens_salida"],
            },
            "cuota": conv.estado_de_cuota(db, usuario),
        }
    finally:
        db.close()

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
            SELECT id_universidad, nombre_universidad, pais_universidad
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

@app.get("/cientificos-sugerencias")
def get_cientificos_sugerencias(
    fuente: str = FUENTE_TOP2,
    q: str = None,
    limite: int = 6,
):
    """Autocompletado del buscador de investigadores. Devuelve dos grupos:
    nombres de investigador y áreas de investigación, ambos ordenados poniendo
    primero las coincidencias por prefijo. Consulta ligera a propósito: no
    arrastra métricas ni tópicos anidados como /cientificos."""
    db = SessionLocal()
    try:
        termino = (q or "").strip()
        if len(termino) < 2:
            return {"investigadores": [], "topicos": []}

        limite = max(1, min(limite, 20))
        params = {
            "fuente": fuente,
            "like": f"%{termino}%",
            "crudo": termino.lower(),
            "limite": limite,
        }

        investigadores = db.execute(text("""
            SELECT c.id_cientifico, c.nombre_cientifico, cm.h_index, cm.num_articulos
            FROM cientifico c
            JOIN cientifico_metrica cm ON cm.id_cientifico = c.id_cientifico
            WHERE cm.fuente = :fuente
              AND c.nombre_cientifico ILIKE :like
            ORDER BY
              CASE WHEN position(:crudo IN lower(c.nombre_cientifico)) = 1 THEN 0 ELSE 1 END,
              cm.h_index DESC NULLS LAST,
              c.nombre_cientifico
            LIMIT :limite
        """), params)

        topicos = db.execute(text("""
            SELECT ct.topico, count(DISTINCT ct.id_cientifico) AS investigadores
            FROM cientifico_topico ct
            WHERE ct.fuente = :fuente
              AND ct.topico ILIKE :like
            GROUP BY ct.topico
            ORDER BY
              CASE WHEN position(:crudo IN lower(ct.topico)) = 1 THEN 0 ELSE 1 END,
              count(DISTINCT ct.id_cientifico) DESC,
              ct.topico
            LIMIT :limite
        """), params)

        return {
            "investigadores": [dict(r._mapping) for r in investigadores],
            "topicos": [dict(r._mapping) for r in topicos],
        }
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
            SELECT m.id_metrica, m.nombre_metrica, m.disciplina, m.peso_metrica,
                   MIN(mu.anio_metrica) AS anio_min, MAX(mu.anio_metrica) AS anio_max
            FROM metrica m
            JOIN metrica_universidad mu ON mu.id_metrica = m.id_metrica
            WHERE m.id_ranking = :ranking_id
            GROUP BY m.id_metrica, m.nombre_metrica, m.disciplina, m.peso_metrica
            ORDER BY m.nombre_metrica, m.disciplina
        """), {"ranking_id": ranking_id})
        return [dict(row._mapping) for row in result]
    finally:
        db.close()


@app.get("/tendencias-comparacion")
def get_tendencias_comparacion(
    ranking_id: int,
    anio: int,
    metricas: str = None,
    universidades: str = None,
):
    """Vista 'Comparación anual' de Tendencias: N instituciones x M métricas en un
    único año. Devuelve además el techo observado de cada métrica (su máximo
    histórico dentro del ranking) para poder normalizar en un mismo eje métricas
    que conviven en escalas distintas (0-100, 0-5, conteos de papers)."""
    db = SessionLocal()
    try:
        params = {"ranking_id": ranking_id, "anio": anio}

        met_filter = ""
        if metricas:
            params["met_ids"] = [int(x) for x in metricas.split(",") if x.strip()]
            met_filter = "AND m.id_metrica = ANY(:met_ids)"

        uni_filter = ""
        if universidades:
            params["uni_ids"] = [int(x) for x in universidades.split(",") if x.strip()]
            uni_filter = "AND u.id_universidad = ANY(:uni_ids)"

        query = text(f"""
            WITH techos AS (
                SELECT mu.id_metrica, MAX(mu.valor_metrica) AS techo
                FROM metrica_universidad mu
                JOIN metrica m ON m.id_metrica = mu.id_metrica
                WHERE m.id_ranking = :ranking_id
                GROUP BY mu.id_metrica
            )
            SELECT
                m.id_metrica,
                m.nombre_metrica,
                m.peso_metrica,
                m.disciplina,
                t.techo,
                u.id_universidad,
                u.nombre_universidad,
                mu.valor_metrica AS valor
            FROM metrica m
            JOIN metrica_universidad mu ON mu.id_metrica = m.id_metrica
            JOIN universidad u ON u.id_universidad = mu.id_universidad
            JOIN techos t ON t.id_metrica = m.id_metrica
            WHERE m.id_ranking = :ranking_id
              AND mu.anio_metrica = :anio
              AND mu.valor_metrica IS NOT NULL
              {met_filter}
              {uni_filter}
            ORDER BY m.id_metrica, u.nombre_universidad
        """)

        return [dict(row._mapping) for row in db.execute(query, params)]
    finally:
        db.close()