"""Motor Gemini del asistente: respuestas rápidas y baratas por token.

Comparte con el motor Claude las herramientas de datos, la instrucción de sistema
y el formato de respuesta (`herramientas.py`). Lo único propio de este módulo es
la traducción al protocolo de Gemini y la de sus errores.

Se usa el modelo más económico de la familia que admite llamada a funciones. El
identificador es configurable con `GEMINI_MODEL` para poder cambiarlo sin tocar
el código cuando Google publique uno más barato.

A las herramientas de base de datos se suma la búsqueda web de Google. En Gemini
esto no es una función que ejecute este proceso: la resuelve el servidor y
devuelve lo que hizo como partes `toolCall`/`toolResponse` del turno, distintas
de las `functionCall` de las herramientas propias. Ver `HERRAMIENTAS`.
"""
import logging
import os
import time

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from .herramientas import POR_NOMBRE, TOOLS, resultado, system_prompt

logger = logging.getLogger(__name__)

MOTOR = "gemini"
# gemini-3.1-flash-lite es el más barato de los que Google sirve hoy a claves
# nuevas (0,25 / 1,50 USD por millón de tokens). El 2.5-flash-lite era más
# barato aún, pero sigue apareciendo en el catálogo del SDK mientras la API lo
# rechaza para claves nuevas: no basta con que un modelo esté listado.
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")

# Tope de vueltas del ciclo de herramientas. Sin él, un modelo que se empeñe en
# volver a consultar lo mismo encadenaría llamadas hasta agotar la cuota.
MAX_CICLOS = 8

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
         busquedas: int = 0) -> dict:
    return resultado(texto, MODEL, MOTOR, entrada, salida, ok, busquedas)


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

# Las integradas y las propias van en un mismo objeto `Tool`, que es la forma que
# documenta Google para combinarlas, y exigen `include_server_side_tool_invocations`
# para que el contexto de lo que hizo el servidor circule entre turnos. La
# combinación solo está disponible en los modelos Gemini 3 y sigue en Preview:
# de ahí el repliegue de `_sin_integradas()`.
HERRAMIENTAS = [types.Tool(
    google_search=types.GoogleSearch(),
    # Deja abrir una página concreta (la metodología oficial de un ranking, por
    # ejemplo) en vez de quedarse con el extracto del buscador.
    url_context=types.UrlContext(),
    function_declarations=DECLARACIONES,
)]

# Solo las propias: el repliegue si el proveedor rechaza la combinación.
HERRAMIENTAS_SIN_WEB = [types.Tool(function_declarations=DECLARACIONES)]

CONFIG_HERRAMIENTAS = types.ToolConfig(include_server_side_tool_invocations=True)

# Herramientas que ejecuta el servidor de Google, no este proceso. Si alguna
# llegara como llamada a función —no debería—, se ignora en vez de contestar que
# no existe.
NOMBRES_DE_SERVIDOR = {"google_search", "url_context"}

# None = no se sabe todavía; False = este despliegue no admite la combinación.
# Se recuerda para no pagar una llamada fallida en cada turno.
_combinacion_admitida: bool | None = None

# La búsqueda de Google tiene una cuota propia, separada de la de tokens: un
# proyecto puede tener tokens de sobra y aun así recibir 429 en cuanto declara
# `google_search`. Como esa cuota se repone sola, la desactivación es temporal en
# vez de definitiva, y el motor vuelve a intentarlo pasado este plazo.
ESPERA_TRAS_CUOTA_WEB = int(os.getenv("GEMINI_ESPERA_CUOTA_WEB", "1800"))
_web_suspendida_hasta = 0.0

# El nivel gratuito devuelve 503 con frecuencia apreciable por saturación del
# modelo, no por un fallo de la petición. En una medición en vivo, dos de tres
# turnos consecutivos fallaron así y el siguiente funcionó de inmediato: es
# transitorio y merece reintentarse antes de devolver un error al usuario. Las
# esperas son cortas porque el turno ocurre con alguien mirando la pantalla.
ESPERAS_TRAS_503 = (2, 5)

# Señales de que el 400 viene de la combinación de herramientas y no de la
# consulta del usuario. Google no expone un código propio para esto.
SENALES_COMBINACION = ("tool", "google_search", "url_context", "function_declarations",
                       "not supported", "unsupported", "combination")


def _es_rechazo_de_combinacion(e: genai_errors.APIError) -> bool:
    if getattr(e, "code", None) != 400:
        return False
    detalle = (getattr(e, "message", "") or "").lower()
    return sum(s in detalle for s in SENALES_COMBINACION) >= 2


def _puede_usar_web() -> bool:
    return _combinacion_admitida is not False and time.time() >= _web_suspendida_hasta


def _ejecutar(nombre: str, argumentos: dict) -> str:
    """Ejecuta una herramienta y devuelve su salida como texto.

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
        return (f"El modelo '{MODEL}' no existe o no está disponible para esta clave. "
                "Corrige la variable GEMINI_MODEL.")
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
        return (f"El servicio de Gemini está caído o sobrecargado (código {codigo}). "
                "Intenta de nuevo en unos minutos.")
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


def _configuracion(con_web: bool) -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        system_instruction=system_prompt(),
        tools=HERRAMIENTAS if con_web else HERRAMIENTAS_SIN_WEB,
        tool_config=CONFIG_HERRAMIENTAS if con_web else None,
        # El ciclo se conduce a mano en vez de dejarlo al SDK: la ejecución
        # automática solo informa del consumo de la última llamada, y aquí hace
        # falta el de todas para cobrar el turno completo contra la cuota.
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        max_output_tokens=4096,
    )


def _generar_con_reintentos(contenidos, con_web: bool):
    """Una llamada al modelo, reintentando solo ante saturación pasajera (503).

    Cualquier otro error se propaga sin más: un 429 lo trata el ciclo llamante
    replegándose sin búsqueda web, y un 400 no mejora por reintentarse.
    """
    for espera in (*ESPERAS_TRAS_503, None):
        try:
            return cliente().models.generate_content(
                model=MODEL, contents=contenidos, config=_configuracion(con_web))
        except genai_errors.APIError as e:
            if getattr(e, "code", None) != 503 or espera is None:
                raise
            logger.info("Gemini saturado (503); se reintenta en %s s.", espera)
            time.sleep(espera)


def _busquedas_del_turno(respuesta) -> int:
    """Cuántas consultas al buscador hizo el servidor en esta llamada.

    Se facturan aparte de los tokens, así que interesa contarlas aunque no se
    cobren contra la cuota de tokens del plan.
    """
    meta = getattr(respuesta.candidates[0], "grounding_metadata", None) if respuesta.candidates else None
    return len(getattr(meta, "web_search_queries", None) or []) if meta else 0


def responder(mensajes: list[dict]) -> dict:
    if not configurado():
        return _res("El servidor no tiene configurada GEMINI_API_KEY: el motor Gemini está "
                    "deshabilitado. Ver docs/asistente-motores.md.", ok=False)

    global _combinacion_admitida, _web_suspendida_hasta
    entrada = salida = busquedas = 0
    contenidos = _a_contenidos(mensajes)
    con_web = _puede_usar_web()

    try:
        respuesta = None
        for _ in range(MAX_CICLOS):
            try:
                respuesta = _generar_con_reintentos(contenidos, con_web)
            except genai_errors.APIError as e:
                # Dos motivos distintos para repetir el turno sin búsqueda web, y
                # ninguno debe dejar al usuario sin respuesta: la base de datos
                # sigue siendo consultable aunque internet no lo esté.
                if con_web and _es_rechazo_de_combinacion(e):
                    # La combinación está en Preview y solo en los modelos Gemini 3.
                    # Si este despliegue la rechaza, no lo hará después: se recuerda
                    # para no repetir la llamada fallida en cada turno.
                    logger.warning("Gemini rechazó la combinación con búsqueda web; se "
                                   "desactiva para este proceso: %s", getattr(e, "message", e))
                    _combinacion_admitida = False
                    con_web = False
                    continue
                if con_web and getattr(e, "code", None) == 429:
                    # La búsqueda de Google se factura y se limita aparte de los
                    # tokens, así que el proyecto puede tener tokens de sobra y aun
                    # así agotar la cuota de búsqueda. Se reintenta sin ella: si el
                    # 429 venía de la búsqueda, el turno sale adelante; si venía del
                    # ritmo de peticiones, volverá a fallar y se informará entonces.
                    logger.warning("Gemini devolvió 429 con la búsqueda web declarada; se "
                                   "reintenta sin ella y se suspende %s s.", ESPERA_TRAS_CUOTA_WEB)
                    _web_suspendida_hasta = time.time() + ESPERA_TRAS_CUOTA_WEB
                    con_web = False
                    continue
                raise
            if con_web:
                _combinacion_admitida = True

            uso = getattr(respuesta, "usage_metadata", None)
            if uso is not None:
                # prompt_token_count ya incluye los tokens leídos de caché; los de
                # razonamiento se facturan como salida.
                entrada += (getattr(uso, "prompt_token_count", 0) or 0)
                entrada += (getattr(uso, "tool_use_prompt_token_count", 0) or 0)
                salida += (getattr(uso, "candidates_token_count", 0) or 0)
                salida += (getattr(uso, "thoughts_token_count", 0) or 0)
            busquedas += _busquedas_del_turno(respuesta)

            # El servidor ejecuta la búsqueda por su cuenta y la devuelve como
            # partes toolCall/toolResponse, no como functionCall, así que aquí no
            # deberían aparecer nunca; se descartan por si acaso, para no
            # responder «esa herramienta no existe» a algo que el servidor ya
            # resolvió. Lo que no se descarta es un nombre simplemente
            # desconocido: ese va a `_ejecutar`, que devuelve el error al modelo
            # para que se corrija. Filtrarlo aquí dejaría al modelo sin saber por
            # qué su llamada no obtuvo respuesta.
            llamadas = [ll for ll in (respuesta.function_calls or [])
                        if ll.name not in NOMBRES_DE_SERVIDOR]
            if not llamadas:
                break

            # El turno del modelo se conserva íntegro (incluidas las firmas de
            # razonamiento y las partes de las herramientas de servidor, que es
            # lo que mantiene el contexto entre turnos) antes de añadir los
            # resultados.
            contenidos.append(respuesta.candidates[0].content)
            contenidos.append(types.Content(role="user", parts=[
                types.Part.from_function_response(
                    name=ll.name,
                    response={"resultado": _ejecutar(ll.name, ll.args)},
                )
                for ll in llamadas
            ]))
        else:
            return _res(f"El asistente encadenó más de {MAX_CICLOS} consultas sin llegar a una "
                        "respuesta. Acota la pregunta.", entrada, salida, ok=False, busquedas=busquedas)

    except genai_errors.APIError as e:
        logger.warning("Error de la API de Gemini (%s): %s", getattr(e, "code", "?"), getattr(e, "message", e))
        return _res(_mensaje_de_error(e), entrada, salida, ok=False, busquedas=busquedas)
    except Exception as e:
        # Misma red de seguridad que en el motor Claude: un fallo aquí no debe
        # salir como un 500 opaco que el frontend muestre como "no se pudo
        # contactar al asistente".
        logger.exception("Fallo inesperado en el motor Gemini")
        return _res(f"El asistente falló al procesar la consulta ({type(e).__name__}). "
                    "Revisa los logs del backend.", entrada, salida, ok=False, busquedas=busquedas)

    if respuesta is None or not respuesta.candidates:
        return _res("No se obtuvo respuesta del modelo.", entrada, salida, ok=False, busquedas=busquedas)

    motivo = getattr(respuesta.candidates[0], "finish_reason", None)
    nombre_motivo = getattr(motivo, "name", None) or str(motivo or "")
    texto = respuesta.text or ""

    if nombre_motivo in FINALES_PROBLEMATICOS and not texto:
        return _res(FINALES_PROBLEMATICOS[nombre_motivo], entrada, salida, ok=False, busquedas=busquedas)
    if not texto:
        return _res("El modelo no devolvió una respuesta de texto.", entrada, salida,
                    ok=False, busquedas=busquedas)
    if nombre_motivo == "MAX_TOKENS":
        # Hay texto, pero incompleto: se entrega avisando en vez de descartarlo.
        texto += "\n\n[Respuesta cortada por longitud. Pide una versión más acotada.]"
    return _res(texto, entrada, salida, ok=True, busquedas=busquedas)
