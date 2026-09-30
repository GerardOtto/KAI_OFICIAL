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

from . import acceso, auth, conversaciones as conv, herramientas, motores

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

MENSAJE_SOLO_GOOGLE = "Su cuenta está verificada, solo puede ingresar vía su cuenta de Google."


class RegistroRequest(BaseModel):
    nombre: str
    correo: str
    clave: str
    institucion: str


class InstitucionRequest(BaseModel):
    institucion: str


def _validar_institucion(db, nombre: str | None) -> str:
    """Comprueba que la institución exista en el catálogo y la devuelve normalizada.

    Se valida contra `universidad` y no se admite texto libre: la institución
    pasa a gobernar la afiliación del usuario, y un campo libre la haría
    inservible para agrupar o para conceder acceso. La comparación ignora
    mayúsculas y espacios sobrantes, pero se guarda el nombre tal como está en la
    base, para que dos cuentas de la misma institución coincidan exactamente.
    """
    limpio = " ".join((nombre or "").split())
    if not limpio:
        raise HTTPException(status_code=400, detail="Hay que indicar la institución.")

    fila = db.execute(text("""
        SELECT nombre_universidad FROM universidad
         WHERE lower(nombre_universidad) = lower(:n) LIMIT 1
    """), {"n": limpio}).first()
    if fila is None:
        raise HTTPException(
            status_code=400,
            detail="Esa institución no está en el catálogo. Elige una de la lista.")
    return fila.nombre_universidad


class LoginRequest(BaseModel):
    correo: str
    clave: str


class GoogleRequest(BaseModel):
    credential: str  # ID token emitido por Google Identity Services


def _sesion(db, usuario: dict) -> dict:
    """Respuesta común de los tres caminos de autenticación.

    Incluye las capacidades del plan para que la interfaz sepa qué mostrar desde
    el primer dibujo, sin una petición más y sin un instante en que ofrezca lo
    que el plan no permite.
    """
    token, expira_en = auth.crear_token(usuario["id_usuario"], usuario["correo_usuario"])
    return {"token": token, "expira_en": expira_en, "usuario": _perfil(usuario),
            "capacidades": acceso.capacidades(db, usuario)}


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
            text("SELECT id_usuario, google_sub FROM usuario WHERE lower(correo_usuario) = :c"),
            {"c": correo},
        ).first()
        if existe:
            if existe.google_sub:
                raise HTTPException(status_code=409, detail=MENSAJE_SOLO_GOOGLE)
            raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese correo.")

        institucion = _validar_institucion(db, req.institucion)

        id_usuario = db.execute(text("""
            INSERT INTO usuario (nombre_usuario, correo_usuario, clave_usuario,
                                 institucion_usuario, plan_usuario)
            VALUES (:n, :c, :k, :i, :p) RETURNING id_usuario
        """), {"n": req.nombre.strip(), "c": correo,
               "k": auth.hashear_clave(req.clave),
               "i": institucion,
               "p": auth.PLAN_POR_DEFECTO}).scalar()
        db.commit()
        return _sesion(db, auth.buscar_usuario_por_id(db, id_usuario))
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

        # Una cuenta con Google no admite contraseña: se avisa antes de comprobar
        # la clave, para que el usuario sepa por dónde entrar.
        if fila is not None and fila.google_sub:
            raise HTTPException(status_code=401, detail=MENSAJE_SOLO_GOOGLE)

        # Mismo mensaje para correo inexistente y clave incorrecta: revelar cuál
        # de los dos falló permitiría enumerar las cuentas registradas.
        if fila is None or not auth.verificar_clave(req.clave, fila.clave_usuario):
            raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")

        db.execute(text("UPDATE usuario SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id_usuario = :i"),
                   {"i": fila.id_usuario})
        db.commit()
        return _sesion(db, auth.buscar_usuario_por_id(db, fila.id_usuario))
    finally:
        db.close()


@app.post("/auth/google")
def login_google(req: GoogleRequest):
    """Registro e inicio de sesión con una cuenta de Google.

    Google devuelve un ID token firmado; aquí se verifica y se traduce a una
    sesión propia. Si el correo ya existe con contraseña local, se vincula la
    cuenta de Google a ese mismo usuario en lugar de crear un duplicado, y la
    contraseña se elimina: desde entonces solo se entra con Google.

    Borrar la contraseña cierra el secuestro previo de cuentas: como el registro
    local no verifica el correo, alguien pudo registrarse antes con un correo
    ajeno; al vincularlo su dueño real, esa contraseña deja de servir.

    Si el dominio del correo es institucional (`dominio_institucion`), la
    institución se fija aquí y no se pregunta: el correo ya viene verificado. Se
    hace en cada entrada, no solo al crear la cuenta, para que una cuenta con
    contraseña que se vincula tome la institución de su dominio.
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
                       clave_usuario = NULL,
                       avatar_url = COALESCE(avatar_url, :a),
                       correo_verificado = TRUE,
                       ultimo_acceso = CURRENT_TIMESTAMP
                 WHERE id_usuario = :i
            """), {"g": datos["sub"], "a": datos["avatar"], "i": id_usuario})

        db.execute(text("""
            UPDATE usuario SET institucion_usuario = institucion_por_correo(correo_usuario)
             WHERE id_usuario = :i AND institucion_por_correo(correo_usuario) IS NOT NULL
        """), {"i": id_usuario})

        db.commit()
        return _sesion(db, auth.buscar_usuario_por_id(db, id_usuario))
    finally:
        db.close()


@app.get("/auth/yo")
def yo(usuario: dict = Depends(auth.usuario_actual)):
    db = SessionLocal()
    try:
        return {"usuario": _perfil(usuario), "cuota": conv.estado_de_cuota(db, usuario),
                "capacidades": acceso.capacidades(db, usuario)}
    finally:
        db.close()


@app.patch("/auth/institucion")
def fijar_institucion(req: InstitucionRequest, usuario: dict = Depends(auth.usuario_actual)):
    """Completa la institución de una cuenta que se creó sin ella.

    Existe por el acceso con Google: ese camino no pregunta nada al usuario, de
    modo que la institución —obligatoria desde ahora— se reclama después, en la
    primera sesión, si el correo no la identifica. También sirve para corregirla,
    salvo cuando viene acreditada por el dominio: entonces es un hecho y no una
    elección, y cambiarla le quitaría el valor que tiene.
    """
    if acceso.institucion_acreditada(usuario):
        raise HTTPException(
            status_code=409,
            detail=(f"Tu institución ({usuario['institucion_del_correo']}) viene de tu correo "
                    "institucional y no se puede cambiar."))
    db = SessionLocal()
    try:
        institucion = _validar_institucion(db, req.institucion)
        db.execute(text("UPDATE usuario SET institucion_usuario = :i WHERE id_usuario = :u"),
                   {"i": institucion, "u": usuario["id_usuario"]})
        db.commit()
        actualizado = auth.buscar_usuario_por_id(db, usuario["id_usuario"])
        return {"usuario": _perfil(actualizado), "capacidades": acceso.capacidades(db, actualizado)}
    finally:
        db.close()


@app.get("/instituciones")
def listar_instituciones():
    """Catálogo de instituciones para el registro. Público, porque se necesita
    antes de tener cuenta.

    Son todas las universidades del sistema, tengan datos cargados o no: una
    persona pertenece a su institución con independencia de cuántas mediciones
    tengamos de ella, y una lista recortada obligaría a quien no aparece a elegir
    una institución falsa.
    """
    db = SessionLocal()
    try:
        filas = db.execute(text("""
            SELECT id_universidad, nombre_universidad, pais_universidad
              FROM universidad ORDER BY nombre_universidad
        """))
        return [dict(f._mapping) for f in filas]
    finally:
        db.close()


def ranking_permitido(ranking_id: int | None = None,
                      usuario: dict = Depends(auth.usuario_actual)) -> dict:
    """Exige sesión y, si la petición nombra un ranking, que el plan lo incluya.

    El plan gratuito ve los nombres de THE y QS —el catálogo los devuelve
    marcados— pero no sus datos. La comprobación vive aquí, en el servidor, y no
    solo en la interfaz que los deshabilita: un selector bloqueado se salta
    escribiendo la dirección a mano.
    """
    if ranking_id is None:
        return usuario
    db = SessionLocal()
    try:
        if not acceso.puede_ver_ranking(db, usuario, ranking_id):
            raise HTTPException(status_code=403, detail=acceso.motivo_ranking(db, ranking_id))
    finally:
        db.close()
    return usuario


# ---------------------------------------------------------------------------
# Descargas de informes
# ---------------------------------------------------------------------------

class DescargaRequest(BaseModel):
    modulo: str
    formato: str


@app.get("/descargas")
def descargas(usuario: dict = Depends(auth.usuario_actual)):
    """Informes ya descargados, por módulo y formato."""
    db = SessionLocal()
    try:
        return {"limite": None if not acceso.es_gratuito(usuario) or acceso.es_admin(usuario)
                          else acceso.DESCARGAS_GRATUITAS,
                "usadas": acceso.descargas_usadas(db, usuario["id_usuario"])}
    finally:
        db.close()


@app.post("/descargas")
def registrar_descarga(req: DescargaRequest, usuario: dict = Depends(auth.usuario_actual)):
    """Pide permiso para generar un informe y lo contabiliza.

    El informe se compone en el navegador, así que el servidor no puede contarlo
    al entregarlo: la interfaz pide permiso antes de generarlo y solo continúa si
    esta respuesta lo concede. Contar aquí —y no en el cliente— es lo que hace
    que el límite sobreviva a un borrado del almacenamiento del navegador o a un
    cambio de equipo.
    """
    db = SessionLocal()
    try:
        # El mismo cerrojo por usuario que la cuota del asistente: comprobar y
        # registrar son dos pasos, y dos pulsaciones simultáneas del botón
        # pasarían ambas la comprobación.
        conv.bloquear_cuota(db, usuario["id_usuario"])
        permitido, motivo = acceso.puede_descargar(db, usuario, req.modulo, req.formato)
        if not permitido:
            codigo = 400 if "no genera informes" in motivo or "no admitido" in motivo else 403
            raise HTTPException(status_code=codigo, detail=motivo)

        acceso.registrar_descarga(db, usuario["id_usuario"], req.modulo, req.formato)
        db.commit()
        return {"permitido": True, "usadas": acceso.descargas_usadas(db, usuario["id_usuario"])}
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
            SELECT codigo_plan, nombre_plan, descripcion, precio_mensual_usd, precio_mensual_clp,
                   precio_lista_clp,
                   tokens_claude_mes, tokens_gemini_mes, mensajes_por_dia, dias_entre_mensajes
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
    permitido, motivo = acceso.puede_usar_asistente(usuario) if usuario is not None else (True, None)

    if usuario is not None:
        db = SessionLocal()
        try:
            cuota = conv.estado_de_cuota(db, usuario)
        finally:
            db.close()
        for m in catalogo:
            estado = cuota["motores"].get(m["id"], {})
            m["incluido_en_plan"] = estado.get("incluido", False)
            # La afiliación pesa sobre los dos motores por igual: sin ella no hay
            # asistente, aunque el plan incluya el motor y quede cuota.
            m["disponible_ahora"] = permitido and m["disponible"] and estado.get("disponible", False)
    else:
        for m in catalogo:
            m["incluido_en_plan"] = None
            m["disponible_ahora"] = m["disponible"]

    return {"motores": catalogo, "por_defecto": motores.POR_DEFECTO,
            "permitido": permitido, "motivo": motivo}


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

    # El asistente está reservado, por ahora, a las cuentas de la institución que
    # financia el proyecto. Se comprueba aquí y no solo en el catálogo de motores
    # porque es el único punto por el que se gasta cuota del proveedor.
    permitido, motivo = acceso.puede_usar_asistente(usuario)
    if not permitido:
        raise HTTPException(status_code=403, detail=motivo)

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
        #
        #    El cerrojo abarca desde aquí hasta que se confirma el mensaje del
        #    usuario: comprobar y consumir la cuota son dos pasos, y sin él dos
        #    peticiones simultáneas del mismo usuario leen el mismo recuento y
        #    ambas se creen dentro del límite (ver `bloquear_cuota`).
        conv.bloquear_cuota(db, usuario["id_usuario"])
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
        vedados = acceso.ids_vedados(db, usuario)
        db.commit()

        # Las herramientas del asistente leen la base por su cuenta: sin esto, el
        # plan gratuito obtendría por el chat los datos de THE y QS que la
        # interfaz le niega.
        with herramientas.con_rankings_vedados(vedados):
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
                # Las búsquedas en internet las cobran ambos proveedores por uso,
                # aparte de los tokens; se informan para que el gasto sea visible.
                "busquedas": resultado.get("busquedas", 0),
            },
            "cuota": conv.estado_de_cuota(db, usuario),
        }
    finally:
        db.close()

@app.get("/universidad")
def get_subrankings(usuario: dict = Depends(auth.usuario_actual)):
    db = SessionLocal()
    try:
        result = db.execute(text("SELECT * FROM universidad"))
        data = [dict(row._mapping) for row in result]
        return data
    finally:
        db.close()

@app.get("/trends")
def get_trends(ranking_id: int, metrica_id: int, universidades: str = None,
    modo: str = "puntajes",
    usuario: dict = Depends(ranking_permitido)):
    db = SessionLocal()
    try:

        base_query = f"""
            SELECT 
                u.nombre_universidad AS universidad,
                mu.anio_metrica AS anio,
                mu.valor_metrica AS valor,
                mu.unidad,
                mu.calidad,
                u.id_universidad
            FROM {_fuente_valores(db, modo)} mu
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
def get_metricas(ranking_id: int,
    usuario: dict = Depends(ranking_permitido)):
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
def get_universidades(usuario: dict = Depends(auth.usuario_actual)):
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
def get_rankings(usuario: dict = Depends(auth.usuario_actual)):
    db = SessionLocal()
    try:
        # `pesos_editables` y `valores_son_crudos` se leen a través de to_jsonb para
        # no depender de que las migraciones 009 y 010 ya estén aplicadas: sin la
        # columna, la clave no existe y queda en falso, en vez de romper el
        # catálogo entero. Por lo mismo, los valores medidos solo se buscan si la
        # tabla de la 008 existe.
        con_valores = (
            "EXISTS (SELECT 1 FROM valor_real_universidad v JOIN metrica m "
            "ON m.id_metrica = v.id_metrica WHERE m.id_ranking = r.id_ranking)"
            if _hay_tabla(db, "valor_real_universidad") else "false")
        result = db.execute(text(f"""
            SELECT r.id_ranking, r.nombre_ranking, r.descripcion_ranking,
                   COALESCE((to_jsonb(r) ->> 'pesos_editables')::boolean, false) AS pesos_editables,
                   COALESCE((to_jsonb(r) ->> 'valores_son_crudos')::boolean, false)
                       OR {con_valores} AS tiene_valores_reales,
                   to_jsonb(r) ->> 'normalizacion' AS normalizacion,
                   to_jsonb(r) ->> 'origen_valores' AS origen_valores
            FROM ranking r
            ORDER BY r.id_ranking"""))
        # Los rankings reservados se devuelven igualmente, marcados: el plan
        # gratuito ve que existen y qué se pierde, en lugar de encontrarse una
        # lista corta que no explica nada.
        restringidos = (acceso.ids_restringidos(db)
                        if acceso.es_gratuito(usuario) and not acceso.es_admin(usuario) else set())
        return [{**dict(row._mapping), "restringido": row.id_ranking in restringidos}
                for row in result]
    finally:
        db.close()

@app.get("/simulacion")
def get_simulacion(ranking_id: int, anio: int, universidades: str = None,
    modo: str = "puntajes",
    usuario: dict = Depends(ranking_permitido)):
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
                u.pais_universidad,
                m.id_metrica,
                m.nombre_metrica,
                m.disciplina,
                m.peso_metrica,
                m.pondera,
                to_jsonb(m) ->> 'sentido' AS sentido,
                mu.valor_metrica,
                mu.anio_metrica,
                mu.unidad,
                mu.calidad
            FROM metrica m
            JOIN {_fuente_valores(db, modo)} mu ON mu.id_metrica = m.id_metrica
            JOIN universidad u ON u.id_universidad = mu.id_universidad
            WHERE m.id_ranking = :ranking_id
              AND mu.anio_metrica = :anio
              -- En puntajes, solo lo que compone el total. En valores medidos
              -- también los indicadores de referencia: en THE son ellos, y no los
              -- pilares, los que tienen cifra.
              {"AND m.pondera" if modo == "puntajes" else ""}
              {uni_filter}
            ORDER BY u.nombre_universidad, m.id_metrica
        """)

        rows = [dict(row._mapping) for row in db.execute(query, params)]
        return rows
    finally:
        db.close()

@app.get("/anios")
def get_anios(ranking_id: int, modo: str = "puntajes",
    usuario: dict = Depends(ranking_permitido)):
    db = SessionLocal()
    try:
        result = db.execute(text(f"""
            SELECT DISTINCT mu.anio_metrica
            FROM {_fuente_valores(db, modo)} mu
            JOIN metrica m ON m.id_metrica = mu.id_metrica
            WHERE m.id_ranking = :ranking_id
            ORDER BY mu.anio_metrica DESC
        """), {"ranking_id": ranking_id})
        return [row._mapping["anio_metrica"] for row in result]
    finally:
        db.close()

@app.get("/ranking-resumen")
def get_ranking_resumen(ranking_id: int, anio: int,
    usuario: dict = Depends(ranking_permitido)):
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
              -- Solo las métricas que componen el total. Hoy las de referencia no
              -- tienen observaciones, así que el resultado es el mismo; el filtro
              -- impide que una carga futura en ese nivel sume dos veces el peso.
              AND m.pondera
            GROUP BY r.id_ranking, r.nombre_ranking, r.descripcion_ranking,
                     u.id_universidad, u.nombre_universidad, u.pais_universidad
            ORDER BY score_total DESC
        """), {"ranking_id": ranking_id, "anio": anio})
        rows = [dict(row._mapping) for row in result]
        return rows
    finally:
        db.close()

@app.get("/tipos-metrica")
def get_tipos_metrica(usuario: dict = Depends(auth.usuario_actual)):
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
def get_metricas_por_tipo(tipo: str,
    usuario: dict = Depends(auth.usuario_actual)):
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
                -- Un ranking puede publicar su metodología en dos niveles. Quien
                -- sume pesos debe usar solo las que ponderan: las demás son el
                -- otro nivel de la misma jerarquía y duplicarían el total.
                m.pondera,
                m.id_metrica_padre,
                p.nombre_metrica AS nombre_metrica_padre,
                r.id_ranking,
                r.nombre_ranking
            FROM metrica m
            JOIN ranking r ON r.id_ranking = m.id_ranking
            LEFT JOIN metrica p ON p.id_metrica = m.id_metrica_padre
            WHERE m.tipo_metrica = :tipo
            ORDER BY r.nombre_ranking, m.nombre_metrica
        """), {"tipo": tipo})

        # En el glosario la restricción no puede quitar la columna: el plan
        # gratuito debe ver que THE y QS están ahí. Se conserva el nombre del
        # ranking y se vacía lo que tiene valor —el peso y la descripción—, de
        # modo que la celda se dibuje bloqueada y no simplemente ausente.
        restringidos = (acceso.ids_restringidos(db)
                        if acceso.es_gratuito(usuario) and not acceso.es_admin(usuario) else set())
        return [
            {**dict(row._mapping), "restringido": True,
             "peso_metrica": None, "descripcion_metrica": None}
            if row.id_ranking in restringidos else
            {**dict(row._mapping), "restringido": False}
            for row in result
        ]
    finally:
        db.close()

@app.get("/valores-metrica-universidad")
def get_valores_metrica_universidad(tipo: str, universidad_id: int, anio: int,
    modo: str = "puntajes",
    usuario: dict = Depends(auth.usuario_actual)):
    db = SessionLocal()
    try:
        result = db.execute(text(f"""
            SELECT
                m.id_metrica,
                m.nombre_metrica,
                m.tipo_metrica,
                m.disciplina,
                r.nombre_ranking,
                mu.valor_metrica,
                mu.anio_metrica,
                mu.unidad,
                mu.calidad
            FROM metrica m
            JOIN ranking r ON r.id_ranking = m.id_ranking
            JOIN {_fuente_valores(db, modo)} mu ON mu.id_metrica = m.id_metrica
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
def get_cientificos_fuentes(usuario: dict = Depends(auth.usuario_actual)):
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
def get_cientificos(fuente: str = FUENTE_TOP2,
    campo: str = None,
    universidad_id: int = None,
    q: str = None,
    topico: str = None,
    usuario: dict = Depends(auth.usuario_actual)):
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
def get_cientificos_sugerencias(fuente: str = FUENTE_TOP2,
    q: str = None,
    limite: int = 6,
    usuario: dict = Depends(auth.usuario_actual)):
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
def get_cientifico_topicos(id_cientifico: int, fuente: str = None,
    usuario: dict = Depends(auth.usuario_actual)):
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
def get_cientificos_campos(usuario: dict = Depends(auth.usuario_actual)):
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

MODOS = ("puntajes", "numerico")


def _modo(modo: str) -> str:
    if modo not in MODOS:
        raise HTTPException(status_code=422, detail=f"modo debe ser uno de {', '.join(MODOS)}.")
    return modo


def _fuente_valores(db, modo: str) -> str:
    """Tabla derivada con la forma de metrica_universidad para el modo pedido.

    El switch global de la interfaz alterna entre el puntaje normalizado y el
    valor cuantificable. En vez de duplicar cada consulta, los endpoints leen de
    esta tabla derivada: mismas columnas —más `unidad` y `calidad`— y el mismo
    alias. En modo numérico solo entran las universidades que el ranking clasificó
    ese año, igual que en /valores-reales.
    """
    _modo(modo)
    if modo == "numerico":
        if not _hay_tabla(db, "valor_real_universidad"):
            return ("(SELECT NULL::int AS id_metrica, NULL::int AS id_universidad, "
                    "NULL::float AS valor_metrica, NULL::int AS anio_metrica, "
                    "NULL::text AS unidad, NULL::text AS calidad WHERE false)")
        return """(SELECT v.id_metrica, v.id_universidad, v.valor AS valor_metrica,
                          v.anio_edicion AS anio_metrica, v.unidad, v.calidad
                   FROM valor_real_universidad v
                   JOIN metrica m0 ON m0.id_metrica = v.id_metrica
                   WHERE EXISTS (
                       SELECT 1 FROM metrica_universidad p
                       JOIN metrica m1 ON m1.id_metrica = p.id_metrica
                       WHERE m1.id_ranking = m0.id_ranking AND p.anio_metrica = v.anio_edicion
                         AND p.id_universidad = v.id_universidad))"""
    return ("(SELECT id_metrica, id_universidad, valor_metrica, anio_metrica, "
            "NULL::text AS unidad, NULL::text AS calidad FROM metrica_universidad)")


def _hay_tabla(db, nombre: str) -> bool:
    """Si la tabla existe. Permite desplegar el código antes que su migración."""
    return bool(db.execute(text("SELECT to_regclass(:t) IS NOT NULL"),
                           {"t": f"public.{nombre}"}).scalar())


@app.get("/valores-reales")
def get_valores_reales(ranking_id: int, anio: int | None = None,
    usuario: dict = Depends(ranking_permitido)):
    """Los valores medidos detrás de un ranking —razones, porcentajes, conteos—, en
    vez de sus puntajes normalizados.

    Dos orígenes, según el ranking. En THE, QS y el Ranking KAI los valores se
    midieron aparte y viven en `valor_real_universidad`, con su calidad. En
    Scimago la fuente ya publica el valor crudo, que es lo que guarda
    `metrica_universidad`. La respuesta incluye la cobertura del año —cuántas
    componentes del ranking tienen valor y qué peso suman— porque el modo
    numérico debe decir qué parte del ranking puede mostrar y cuál no.
    """
    db = SessionLocal()
    try:
        rk = db.execute(text("""
            SELECT nombre_ranking,
                   COALESCE((to_jsonb(r) ->> 'valores_son_crudos')::boolean, false) AS crudos,
                   to_jsonb(r) ->> 'origen_valores' AS origen
            FROM ranking r WHERE id_ranking = :r"""), {"r": ranking_id}).first()
        if rk is None:
            raise HTTPException(status_code=404, detail="No existe ese ranking.")

        metricas = [dict(f._mapping) for f in db.execute(text("""
            SELECT m.id_metrica, m.nombre_metrica, m.peso_metrica, m.pondera,
                   to_jsonb(m) ->> 'sentido' AS sentido,
                   to_jsonb(m) ->> 'unidad_valor' AS unidad_valor,
                   NOT EXISTS (SELECT 1 FROM metrica h WHERE h.id_metrica_padre = m.id_metrica)
                       AS es_componente
            FROM metrica m WHERE m.id_ranking = :r
            ORDER BY m.peso_metrica DESC NULLS LAST, m.nombre_metrica"""), {"r": ranking_id})]

        if rk.crudos:
            fuente_anios = """SELECT DISTINCT mu.anio_metrica AS anio FROM metrica_universidad mu
                              JOIN metrica m ON m.id_metrica = mu.id_metrica WHERE m.id_ranking = :r"""
            consulta = """
                SELECT mu.id_metrica, mu.id_universidad, u.nombre_universidad,
                       mu.valor_metrica AS valor, to_jsonb(m) ->> 'unidad_valor' AS unidad,
                       'directa' AS calidad, NULL AS formula,
                       'Publicado por ' || r.nombre_ranking AS fuentes,
                       mu.anio_metrica::text AS anios_origen
                FROM metrica_universidad mu
                JOIN metrica m ON m.id_metrica = mu.id_metrica
                JOIN ranking r ON r.id_ranking = m.id_ranking
                JOIN universidad u ON u.id_universidad = mu.id_universidad
                WHERE m.id_ranking = :r AND mu.anio_metrica = :a AND mu.valor_metrica IS NOT NULL"""
        elif _hay_tabla(db, "valor_real_universidad"):
            fuente_anios = """SELECT DISTINCT v.anio_edicion AS anio FROM valor_real_universidad v
                              JOIN metrica m ON m.id_metrica = v.id_metrica WHERE m.id_ranking = :r"""
            consulta = """
                SELECT v.id_metrica, v.id_universidad, u.nombre_universidad, v.valor, v.unidad,
                       v.calidad, v.formula, v.fuentes, v.anios_origen
                FROM valor_real_universidad v
                JOIN metrica m ON m.id_metrica = v.id_metrica
                JOIN universidad u ON u.id_universidad = v.id_universidad
                WHERE m.id_ranking = :r AND v.anio_edicion = :a
                  -- Solo universidades que el ranking clasificó esa edición. Los
                  -- valores de THE se calcularon para toda universidad con datos
                  -- del SIES, pero THE Latam rankea a una treintena: mostrar las
                  -- demás bajo su nombre sugeriría que están en él.
                  AND EXISTS (
                      SELECT 1 FROM metrica_universidad mu
                      JOIN metrica m2 ON m2.id_metrica = mu.id_metrica
                      WHERE m2.id_ranking = :r AND mu.anio_metrica = :a
                        AND mu.id_universidad = v.id_universidad)"""
        else:
            fuente_anios = consulta = None

        anios = sorted((f.anio for f in db.execute(text(fuente_anios), {"r": ranking_id})),
                       reverse=True) if fuente_anios else []
        anio = anio if anio is not None else (anios[0] if anios else None)
        valores = ([dict(f._mapping) for f in db.execute(text(consulta), {"r": ranking_id, "a": anio})]
                   if consulta and anio in anios else [])

        # Cobertura sobre las componentes —las métricas que no agrupan a otras—,
        # que son las que tienen valor medible: en THE los diecisiete indicadores
        # y no los cinco pilares.
        con_valor = {v["id_metrica"] for v in valores}
        componentes = [m for m in metricas if m["es_componente"]]
        for m in metricas:
            m["peso_metrica"] = float(m["peso_metrica"] or 0)
            m["tiene_valores"] = m["id_metrica"] in con_valor
        calidades: dict[str, int] = {}
        for v in valores:
            calidades[v["calidad"]] = calidades.get(v["calidad"], 0) + 1

        return {
            "ranking": rk.nombre_ranking,
            # Quién produjo las cifras: la fuente (Scimago) o KAI con la definición
            # del ranking. La interfaz advierte distinto en cada caso.
            "origen": rk.origen or ("fuente" if rk.crudos else "medido"),
            "anio": anio,
            "anios": anios,
            "metricas": metricas,
            "valores": valores,
            "cobertura": {
                "componentes": len(componentes),
                "componentes_con_valor": sum(1 for m in componentes if m["tiene_valores"]),
                "peso_total": round(sum(m["peso_metrica"] for m in componentes), 2),
                "peso_con_valor": round(sum(m["peso_metrica"] for m in componentes
                                            if m["tiene_valores"]), 2),
                "calidades": calidades,
            },
        }
    finally:
        db.close()


@app.get("/metricas-con-datos")
def get_metricas_con_datos(ranking_id: int, modo: str = "puntajes",
    usuario: dict = Depends(ranking_permitido)):
    db = SessionLocal()
    try:
        result = db.execute(text(f"""
            SELECT m.id_metrica, m.nombre_metrica, m.disciplina, m.peso_metrica,
                   to_jsonb(m) ->> 'sentido' AS sentido,
                   MIN(mu.anio_metrica) AS anio_min, MAX(mu.anio_metrica) AS anio_max,
                   MAX(mu.unidad) AS unidad
            FROM metrica m
            JOIN {_fuente_valores(db, modo)} mu ON mu.id_metrica = m.id_metrica
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
    modo: str = "puntajes",
    # Faltaba: era el único endpoint de datos sin sesión, y por él se leían los
    # valores de THE y QS que el plan gratuito no incluye. El cliente ya enviaba
    # el token, así que exigirlo no cambia nada para quien usa la interfaz.
    usuario: dict = Depends(ranking_permitido),
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

        fuente = _fuente_valores(db, modo)
        query = text(f"""
            WITH techos AS (
                SELECT mu.id_metrica, MAX(mu.valor_metrica) AS techo
                FROM {fuente} mu
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
                mu.valor_metrica AS valor,
                mu.unidad,
                mu.calidad
            FROM metrica m
            JOIN {fuente} mu ON mu.id_metrica = m.id_metrica
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