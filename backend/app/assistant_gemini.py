"""Motor Gemini del asistente: respuestas rápidas y baratas por token.

Comparte con el motor Claude las herramientas de datos, la instrucción de sistema
y el formato de respuesta (`herramientas.py`). Lo único propio de este módulo es
la traducción al protocolo de Gemini y la de sus errores.

Internet es aquí una herramienta que el modelo pide, no una capacidad siempre
encendida. El motor declara `buscar_en_internet` junto a las de datos; cuando el
modelo la llama, este proceso hace una consulta aparte —esa sí con la búsqueda de
Google del lado del servidor— y le devuelve el resultado. Ver `_buscar_en_internet`.

Antes la búsqueda se declaraba en todas las peticiones, combinada con las
funciones propias. Tenía dos inconvenientes: invitaba al modelo a buscar lo que
la base ya responde, y sobre todo, una vez agotada la cuota diaria de búsqueda
—que es independiente de la de tokens— Google rechazaba la petición **entera** en
la validación, con lo que un saludo fallaba igual que una consulta a internet.
"""
import logging
import os
import random
import time

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from .herramientas import POR_NOMBRE, TOOLS, resultado, system_prompt

logger = logging.getLogger(__name__)

MOTOR = "gemini"

# Cadena de modelos, en orden de preferencia. Si el primero agota sus reintentos
# por saturación, el motor pasa al siguiente en vez de perder el turno.
#
# La disponibilidad efectiva pesa tanto como el precio: un modelo saturado
# devuelve 503 y la consulta se pierde. Medido en vivo el 24-09-2026, con turnos
# completos de consulta a la base:
#
#   gemini-3.5-flash-lite     4 de 4 turnos, entre 3,7 y 7 s
#   gemini-3.1-flash-lite     3 de 4 turnos, entre  26 y 118 s
#   gemini-3.8-flash          0 de 4 turnos, 503 inmediato
#
# `GEMINI_MODELOS` fija la cadena completa; `GEMINI_MODEL`, que es la variable
# antigua, sigue funcionando y pone su modelo al frente. El 2.5-flash-lite sigue
# apareciendo en el catálogo del SDK mientras la API lo rechaza para claves
# nuevas: no basta con que un modelo esté listado.
CADENA_POR_DEFECTO = "gemini-3.5-flash-lite,gemini-3.1-flash-lite"


def _modelos() -> list[str]:
    cadena = [m.strip() for m in os.getenv("GEMINI_MODELOS", CADENA_POR_DEFECTO).split(",") if m.strip()]
    preferido = (os.getenv("GEMINI_MODEL") or "").strip()
    if preferido:
        cadena = [preferido] + [m for m in cadena if m != preferido]
    return cadena


MODELOS = _modelos()
# El primero es el que se anuncia en el catálogo de motores y el que se registra
# cuando no llega a haber llamada; el que de verdad respondió viaja en cada
# resultado.
MODEL = MODELOS[0]

# Tope de vueltas del ciclo de herramientas. Sin él, un modelo que se empeñe en
# volver a consultar lo mismo encadenaría llamadas hasta agotar la cuota.
#
# No es una medida de lo que hace falta, sino un margen: un turno corriente gasta
# dos o tres vueltas y una comparación entre instituciones y años, cuatro o cinco.
# Queda configurable porque el número correcto depende del modelo —uno pequeño
# necesita más vueltas para corregir sus propios argumentos— y porque cada vuelta
# es una petición más a la API, que en el nivel gratuito también se cuenta por
# minuto.
MAX_CICLOS = int(os.getenv("GEMINI_MAX_CICLOS", "15"))

CONSOLA_GOOGLE = "aistudio.google.com/apikey"

_cliente = None


def configurado() -> bool:
    return bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))


def cliente() -> genai.Client:
    """Cliente perezoso: crearlo al importar dejaría el backend entero sin
    arrancar cuando falta la clave, incluida su parte pública."""
    global _cliente
    if _cliente is None:
        clave = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        _cliente = genai.Client(api_key=clave)
    return _cliente


def _res(texto: str, entrada: int = 0, salida: int = 0, ok: bool = True,
         busquedas: int = 0, modelo: str | None = None) -> dict:
    return resultado(texto, modelo or MODEL, MOTOR, entrada, salida, ok, busquedas)


# --- Traducción de las herramientas ----------------------------------------

# Gemini acepta un subconjunto de JSON Schema y rechaza la petición completa si
# encuentra palabras clave que no reconoce. El esquema que produce `beta_tool`
# trae `title`, `default` y `additionalProperties`, que no forman parte de ese
# subconjunto, así que se podan. Quitar `default` no cambia el comportamiento:
# el parámetro simplemente no se envía y rige el valor por defecto de la propia
# función de Python.
CLAVES_ADMITIDAS = {"type", "description", "properties", "required", "items", "enum", "nullable"}


def _podar(esquema: dict) -> dict:
    limpio = {}
    for clave, valor in esquema.items():
        if clave not in CLAVES_ADMITIDAS:
            continue
        if clave == "properties":
            limpio[clave] = {k: _podar(v) for k, v in valor.items()}
        elif clave == "items":
            limpio[clave] = _podar(valor)
        else:
            limpio[clave] = valor
    return limpio


DECLARACIONES = [
    types.FunctionDeclaration(
        name=t.name,
        description=t.description,
        parameters_json_schema=_podar(t.input_schema),
    )
    for t in TOOLS
]

BUSQUEDA = "buscar_en_internet"

# La búsqueda se ofrece como una función más, con una descripción que dice
# cuándo procede. Así el modelo tiene que decidir explícitamente que la base no
# le basta, en vez de buscar porque la capacidad estaba ahí.
DECLARACION_BUSQUEDA = types.FunctionDeclaration(
    name=BUSQUEDA,
    description=(
        "Busca en internet y devuelve un resumen con sus fuentes. Úsala solo cuando la "
        "pregunta no pueda responderse con la base de datos: ediciones o años que no están "
        "cargados, rankings que no están en ella, cambios de metodología recientes, "
        "convocatorias, noticias del sector o definiciones oficiales. Antes de llamarla, "
        "comprueba con las herramientas de datos que la base no lo cubre; es más lenta que "
        "ellas y su resultado no es tan fiable."
    ),
    parameters_json_schema={
        "type": "object",
        "properties": {
            "consulta": {
                "type": "string",
                "description": "Qué buscar, redactado como se le pediría a un buscador.",
            },
        },
        "required": ["consulta"],
    },
)

HERRAMIENTAS = [types.Tool(function_declarations=[*DECLARACIONES, DECLARACION_BUSQUEDA])]

# Las integradas de Google, para la consulta aparte que resuelve `buscar_en_internet`.
# `url_context` deja abrir una página concreta —la metodología oficial de un
# ranking, por ejemplo— en vez de quedarse con el extracto del buscador.
HERRAMIENTAS_DE_INTERNET = [types.Tool(
    google_search=types.GoogleSearch(),
    url_context=types.UrlContext(),
)]

INSTRUCCION_DE_BUSQUEDA = (
    "Busca en internet lo que se te pide y responde en español, en menos de 250 palabras, "
    "solo con los hechos que encuentres. Prioriza fuentes oficiales: los sitios de las "
    "propias entidades (timeshighereducation.com, topuniversities.com, scimagoir.com, "
    "shanghairanking.com), organismos públicos y las páginas institucionales de las "
    "universidades. Nombra la fuente y el año de cada dato. Si no encuentras nada fiable, "
    "dilo en una línea en vez de rellenar."
)

# La búsqueda de Google tiene una cuota propia, separada de la de tokens: un
# proyecto puede tener tokens de sobra y aun así recibir 429 al buscar. Como esa
# cuota se repone sola, la desactivación es temporal y el motor vuelve a
# intentarlo pasado este plazo.
ESPERA_TRAS_CUOTA_WEB = int(os.getenv("GEMINI_ESPERA_CUOTA_WEB", "1800"))
_web_suspendida_hasta = 0.0

SIN_INTERNET = (
    "La búsqueda en internet no está disponible ahora mismo (cuota agotada). Responde con "
    "lo que haya en la base de datos y advierte al usuario de que no pudiste consultar "
    "fuentes externas."
)

# El nivel gratuito devuelve 503 «high demand» por saturación del modelo, no por
# un fallo de la petición. Medido en vivo sobre gemini-3.1-flash-lite: la mitad
# de las llamadas falla así, y la siguiente suele funcionar de inmediato.
#
# Esto explica por qué fallaban las consultas de datos y no los saludos: una
# consulta de datos necesita dos llamadas al modelo —una para pedir la
# herramienta y otra para redactar con su resultado—, así que la probabilidad de
# que alguna falle se multiplica.
#
# De ahí que se reintente cada llamada varias veces con espera creciente. Las
# esperas son cortas porque el turno ocurre con alguien mirando la pantalla, y
# llevan una variación aleatoria para que dos peticiones simultáneas no vuelvan a
# la vez. Se ajustan con GEMINI_ESPERAS_503 («1,3,6»), y ponerlas a cero es lo
# que permite que las baterías de prueba no tarden lo que tardan las esperas.
ESPERAS_TRAS_503 = tuple(
    float(x) for x in os.getenv("GEMINI_ESPERAS_503", "1,3,6").split(",") if x.strip()
)

# Códigos que merecen reintento: son del servidor, no de la petición. Un 429 no
# entra —es cuota, y no se cura esperando segundos— ni un 400, que no mejora
# repitiéndose.
CODIGOS_REINTENTABLES = {500, 502, 503, 504}


def _ejecutar(nombre: str, argumentos: dict) -> str:
    """Ejecuta una herramienta de datos y devuelve su salida como texto.

    Un fallo se devuelve al modelo como resultado de la herramienta en vez de
    abortar el turno: el modelo puede corregir el argumento y volver a intentar,
    que es justamente lo que necesita un modelo pequeño. El tope de ciclos evita
    que se quede reintentando indefinidamente.
    """
    funcion = POR_NOMBRE.get(nombre)
    if funcion is None:
        return f"ERROR: la herramienta '{nombre}' no existe."
    try:
        return funcion(**(argumentos or {}))
    except Exception as e:
        logger.warning("Herramienta %s falló con %r: %s", nombre, argumentos, e)
        return f"ERROR al ejecutar '{nombre}': {type(e).__name__}: {e}"


def _a_contenidos(mensajes: list[dict]) -> list[types.Content]:
    """Historial propio -> formato de Gemini. El rol del asistente es 'model'."""
    return [
        types.Content(
            role="model" if m["role"] == "assistant" else "user",
            parts=[types.Part.from_text(text=m["content"])],
        )
        for m in mensajes
    ]


# --- Llamada al modelo ------------------------------------------------------

def _configuracion() -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        system_instruction=system_prompt(),
        tools=HERRAMIENTAS,
        # El ciclo se conduce a mano en vez de dejarlo al SDK: la ejecución
        # automática solo informa del consumo de la última llamada, y aquí hace
        # falta el de todas para cobrar el turno completo contra la cuota.
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        max_output_tokens=4096,
    )


def _con_reintentos(modelo: str, contenidos, config):
    """Una llamada a un modelo concreto, reintentando ante saturación pasajera."""
    for espera in (*ESPERAS_TRAS_503, None):
        try:
            return cliente().models.generate_content(model=modelo, contents=contenidos, config=config)
        except genai_errors.APIError as e:
            codigo = getattr(e, "code", None)
            if codigo not in CODIGOS_REINTENTABLES or espera is None:
                raise
            # Variación aleatoria: si el backend atiende varias peticiones a la
            # vez y todas fallan por saturación, sin ella reintentarían en el
            # mismo instante y volverían a saturar.
            pausa = espera * random.uniform(0.7, 1.3)
            logger.info("%s no disponible (%s); se reintenta en %.1f s.", modelo, codigo, pausa)
            time.sleep(pausa)


def _generar(contenidos, config, modelo_fijado: str | None = None):
    """Llama al modelo y devuelve `(respuesta, modelo que respondió)`.

    Sin modelo fijado recorre la cadena: si uno agota sus reintentos por
    saturación, prueba el siguiente. Una vez que uno responde, el turno se queda
    con él —de ahí `modelo_fijado`—, porque el historial de un turno con llamadas
    a herramientas lleva firmas de razonamiento que pertenecen al modelo que las
    produjo, y cambiar de modelo a mitad las invalidaría.
    """
    candidatos = [modelo_fijado] if modelo_fijado else MODELOS
    for i, modelo in enumerate(candidatos):
        try:
            return _con_reintentos(modelo, contenidos, config), modelo
        except genai_errors.APIError as e:
            ultimo = i == len(candidatos) - 1
            if getattr(e, "code", None) not in CODIGOS_REINTENTABLES or ultimo:
                raise
            logger.warning("%s no respondió tras %d intentos (%s); se pasa a %s.",
                           modelo, len(ESPERAS_TRAS_503) + 1, getattr(e, "code", "?"),
                           candidatos[i + 1])


def _busquedas_de(respuesta) -> int:
    """Cuántas consultas al buscador hizo el servidor en esta llamada."""
    meta = getattr(respuesta.candidates[0], "grounding_metadata", None) if respuesta.candidates else None
    return len(getattr(meta, "web_search_queries", None) or []) if meta else 0


def _buscar_en_internet(consulta: str, modelo: str) -> tuple[str, int, int, int]:
    """Resuelve la herramienta de búsqueda. -> (texto, entrada, salida, búsquedas).

    Es una consulta aparte, con las herramientas integradas de Google y sin las
    funciones de datos: el modelo principal recibe el resultado igual que el de
    cualquier otra herramienta. Que sea una llamada distinta es lo que permite
    que la cuota de búsqueda solo se gaste cuando se busca de verdad.
    """
    global _web_suspendida_hasta

    if time.time() < _web_suspendida_hasta:
        return SIN_INTERNET, 0, 0, 0

    config = types.GenerateContentConfig(
        system_instruction=INSTRUCCION_DE_BUSQUEDA,
        tools=HERRAMIENTAS_DE_INTERNET,
        max_output_tokens=1024,
    )
    try:
        respuesta, _ = _generar(consulta, config, modelo_fijado=modelo)
    except genai_errors.APIError as e:
        codigo = getattr(e, "code", None)
        if codigo == 429:
            logger.warning("Cuota de búsqueda web agotada; se suspende %s s.", ESPERA_TRAS_CUOTA_WEB)
            _web_suspendida_hasta = time.time() + ESPERA_TRAS_CUOTA_WEB
            return SIN_INTERNET, 0, 0, 0
        # El fallo se devuelve al modelo como resultado de la herramienta: puede
        # seguir con lo que tenga de la base en vez de perderse el turno entero.
        logger.warning("La búsqueda en internet falló (%s): %s", codigo, getattr(e, "message", e))
        return (f"La búsqueda en internet falló (código {codigo}). Responde con lo que haya en la "
                "base de datos y adviértelo."), 0, 0, 0

    uso = getattr(respuesta, "usage_metadata", None)
    entrada = ((getattr(uso, "prompt_token_count", 0) or 0)
               + (getattr(uso, "tool_use_prompt_token_count", 0) or 0)) if uso else 0
    salida = ((getattr(uso, "candidates_token_count", 0) or 0)
              + (getattr(uso, "thoughts_token_count", 0) or 0)) if uso else 0
    texto = (respuesta.text or "").strip()
    if not texto:
        texto = "La búsqueda no devolvió resultados utilizables."
    # Si el servidor no informa de consultas, la llamada se cuenta igual como una.
    return texto, entrada, salida, _busquedas_de(respuesta) or 1


# --- Traducción de errores --------------------------------------------------

def _mensaje_de_error(e: genai_errors.APIError) -> str:
    codigo = getattr(e, "code", None)
    detalle = (getattr(e, "message", "") or "").lower()

    if codigo in (401, 403):
        if "api key" in detalle or "api_key" in detalle:
            return ("La clave de la API de Gemini no es válida o fue revocada. Genera una nueva "
                    f"en {CONSOLA_GOOGLE} y ponla en GEMINI_API_KEY (backend/.env).")
        return ("La clave de la API de Gemini no tiene permiso para usar este modelo. "
                f"Revisa sus restricciones en {CONSOLA_GOOGLE}.")
    if codigo == 404:
        return (f"Ninguno de los modelos configurados ({', '.join(MODELOS)}) existe o está "
                "disponible para esta clave. Corrige GEMINI_MODELOS.")
    if codigo == 429:
        # En Gemini el 429 cubre tanto el límite por minuto como el agotamiento de
        # la cuota diaria del nivel gratuito; el texto del error distingue cuál.
        if "quota" in detalle or "exhausted" in detalle:
            return ("Se agotó la cuota de la API de Gemini para este período. Revisa los límites "
                    f"y la facturación del proyecto en {CONSOLA_GOOGLE}. Mientras tanto puedes "
                    "abrir una conversación nueva con el motor Claude.")
        return "El asistente recibió demasiadas solicitudes en poco tiempo. Espera unos segundos y vuelve a intentar."
    if codigo == 400:
        # 400 FAILED_PRECONDITION: la API exige facturación activa en el proyecto
        # (ocurre, por ejemplo, en países sin nivel gratuito).
        if "billing" in detalle or "failed_precondition" in detalle:
            return ("El proyecto de Google Cloud asociado a la clave necesita facturación activa "
                    "para usar esta API. Actívala en console.cloud.google.com.")
        return "El asistente rechazó la solicitud (parámetros inválidos). Intenta reformular tu consulta."
    if codigo and codigo >= 500:
        # Ya se reintentó varias veces y con todos los modelos de la cadena antes
        # de llegar aquí, así que no vale decir solo «vuelve a intentarlo».
        return (f"El servicio de Gemini está caído o sobrecargado (código {codigo}). No respondió "
                f"tras {len(ESPERAS_TRAS_503) + 1} intentos con cada uno de los modelos "
                "configurados. Vuelve a enviar la consulta en unos minutos o deriva la "
                "conversación al motor Claude.")
    return f"El servicio de Gemini respondió con un error (código {codigo}): {getattr(e, 'message', e)}"


# Motivos de corte que no son una respuesta útil, con su explicación.
FINALES_PROBLEMATICOS = {
    "SAFETY": "El modelo bloqueó la respuesta por sus filtros de seguridad. Reformula la consulta.",
    "PROHIBITED_CONTENT": "El modelo bloqueó la respuesta por sus políticas de uso. Reformula la consulta.",
    "BLOCKLIST": "La respuesta contenía términos bloqueados por el proveedor. Reformula la consulta.",
    "SPII": "El modelo bloqueó la respuesta porque detectó datos personales sensibles.",
    "RECITATION": "El modelo detuvo la respuesta para no reproducir contenido protegido.",
    "MAX_TOKENS": "La respuesta se cortó por longitud. Pide un resumen más acotado o divide la consulta.",
    "MALFORMED_FUNCTION_CALL": ("El modelo generó una llamada a herramienta inválida. Vuelve a intentarlo; "
                                "si se repite, la consulta puede ser demasiado compleja para este motor: "
                                "prueba a derivarla al motor Claude."),
}


def responder(mensajes: list[dict]) -> dict:
    if not configurado():
        return _res("El servidor no tiene configurada GEMINI_API_KEY: el motor Gemini está "
                    "deshabilitado. Ver docs/asistente-motores.md.", ok=False)

    entrada = salida = busquedas = 0
    contenidos = _a_contenidos(mensajes)
    config = _configuracion()
    modelo = None

    try:
        respuesta = None
        for _ in range(MAX_CICLOS):
            respuesta, modelo = _generar(contenidos, config, modelo_fijado=modelo)

            uso = getattr(respuesta, "usage_metadata", None)
            if uso is not None:
                # prompt_token_count ya incluye los tokens leídos de caché; los de
                # razonamiento se facturan como salida.
                entrada += (getattr(uso, "prompt_token_count", 0) or 0)
                entrada += (getattr(uso, "tool_use_prompt_token_count", 0) or 0)
                salida += (getattr(uso, "candidates_token_count", 0) or 0)
                salida += (getattr(uso, "thoughts_token_count", 0) or 0)

            llamadas = list(respuesta.function_calls or [])
            if not llamadas:
                break

            partes = []
            for ll in llamadas:
                if ll.name == BUSQUEDA:
                    texto, e_busqueda, s_busqueda, n = _buscar_en_internet(
                        (ll.args or {}).get("consulta", ""), modelo)
                    # La búsqueda es otra llamada al modelo: sus tokens también se
                    # cobran contra la cuota del turno.
                    entrada += e_busqueda
                    salida += s_busqueda
                    busquedas += n
                else:
                    texto = _ejecutar(ll.name, ll.args)
                partes.append(types.Part.from_function_response(
                    name=ll.name, response={"resultado": texto}))

            # El turno del modelo se conserva íntegro —incluidas las firmas de
            # razonamiento, que es lo que mantiene el contexto entre vueltas—
            # antes de añadir los resultados.
            contenidos.append(respuesta.candidates[0].content)
            contenidos.append(types.Content(role="user", parts=partes))
        else:
            return _res(f"El asistente encadenó más de {MAX_CICLOS} consultas sin llegar a una "
                        "respuesta. Acota la pregunta.", entrada, salida, ok=False,
                        busquedas=busquedas, modelo=modelo)

    except genai_errors.APIError as e:
        logger.warning("Error de la API de Gemini (%s): %s", getattr(e, "code", "?"), getattr(e, "message", e))
        return _res(_mensaje_de_error(e), entrada, salida, ok=False, busquedas=busquedas, modelo=modelo)
    except Exception as e:
        # Misma red de seguridad que en el motor Claude: un fallo aquí no debe
        # salir como un 500 opaco que el frontend muestre como "no se pudo
        # contactar al asistente".
        logger.exception("Fallo inesperado en el motor Gemini")
        return _res(f"El asistente falló al procesar la consulta ({type(e).__name__}). "
                    "Revisa los logs del backend.", entrada, salida, ok=False,
                    busquedas=busquedas, modelo=modelo)

    if respuesta is None or not respuesta.candidates:
        return _res("No se obtuvo respuesta del modelo.", entrada, salida, ok=False,
                    busquedas=busquedas, modelo=modelo)

    motivo = getattr(respuesta.candidates[0], "finish_reason", None)
    nombre_motivo = getattr(motivo, "name", None) or str(motivo or "")
    texto = respuesta.text or ""

    if nombre_motivo in FINALES_PROBLEMATICOS and not texto:
        return _res(FINALES_PROBLEMATICOS[nombre_motivo], entrada, salida, ok=False,
                    busquedas=busquedas, modelo=modelo)
    if not texto:
        return _res("El modelo no devolvió una respuesta de texto.", entrada, salida,
                    ok=False, busquedas=busquedas, modelo=modelo)
    if nombre_motivo == "MAX_TOKENS":
        # Hay texto, pero incompleto: se entrega avisando en vez de descartarlo.
        texto += "\n\n[Respuesta cortada por longitud. Pide una versión más acotada.]"
    return _res(texto, entrada, salida, ok=True, busquedas=busquedas, modelo=modelo)
