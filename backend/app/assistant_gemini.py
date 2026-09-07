"""Motor Gemini del asistente: respuestas rápidas y baratas por token.

Comparte con el motor Claude las herramientas de datos, la instrucción de sistema
y el formato de respuesta (`herramientas.py`). Lo único propio de este módulo es
la traducción al protocolo de Gemini y la de sus errores.

Se usa el modelo más económico de la familia que admite llamada a funciones. El
identificador es configurable con `GEMINI_MODEL` para poder cambiarlo sin tocar
el código cuando Google publique uno más barato.
"""
import logging
import os

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from .herramientas import POR_NOMBRE, SYSTEM_PROMPT, TOOLS, resultado

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


def _res(texto: str, entrada: int = 0, salida: int = 0, ok: bool = True) -> dict:
    return resultado(texto, MODEL, MOTOR, entrada, salida, ok)


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

HERRAMIENTAS = [types.Tool(function_declarations=DECLARACIONES)]


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


def responder(mensajes: list[dict]) -> dict:
    if not configurado():
        return _res("El servidor no tiene configurada GEMINI_API_KEY: el motor Gemini está "
                    "deshabilitado. Ver docs/asistente-motores.md.", ok=False)

    entrada = salida = 0
    contenidos = _a_contenidos(mensajes)
    configuracion = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=HERRAMIENTAS,
        # El ciclo se conduce a mano en vez de dejarlo al SDK: la ejecución
        # automática solo informa del consumo de la última llamada, y aquí hace
        # falta el de todas para cobrar el turno completo contra la cuota.
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        max_output_tokens=4096,
    )

    try:
        respuesta = None
        for _ in range(MAX_CICLOS):
            respuesta = cliente().models.generate_content(
                model=MODEL, contents=contenidos, config=configuracion)

            uso = getattr(respuesta, "usage_metadata", None)
            if uso is not None:
                # prompt_token_count ya incluye los tokens leídos de caché; los de
                # razonamiento se facturan como salida.
                entrada += (getattr(uso, "prompt_token_count", 0) or 0)
                entrada += (getattr(uso, "tool_use_prompt_token_count", 0) or 0)
                salida += (getattr(uso, "candidates_token_count", 0) or 0)
                salida += (getattr(uso, "thoughts_token_count", 0) or 0)

            llamadas = respuesta.function_calls
            if not llamadas:
                break

            # El turno del modelo se conserva íntegro (incluidas las firmas de
            # razonamiento que trae) antes de añadir los resultados.
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
                        "respuesta. Acota la pregunta.", entrada, salida, ok=False)

    except genai_errors.APIError as e:
        logger.warning("Error de la API de Gemini (%s): %s", getattr(e, "code", "?"), getattr(e, "message", e))
        return _res(_mensaje_de_error(e), entrada, salida, ok=False)
    except Exception as e:
        # Misma red de seguridad que en el motor Claude: un fallo aquí no debe
        # salir como un 500 opaco que el frontend muestre como "no se pudo
        # contactar al asistente".
        logger.exception("Fallo inesperado en el motor Gemini")
        return _res(f"El asistente falló al procesar la consulta ({type(e).__name__}). "
                    "Revisa los logs del backend.", entrada, salida, ok=False)

    if respuesta is None or not respuesta.candidates:
        return _res("No se obtuvo respuesta del modelo.", entrada, salida, ok=False)

    motivo = getattr(respuesta.candidates[0], "finish_reason", None)
    nombre_motivo = getattr(motivo, "name", None) or str(motivo or "")
    texto = respuesta.text or ""

    if nombre_motivo in FINALES_PROBLEMATICOS and not texto:
        return _res(FINALES_PROBLEMATICOS[nombre_motivo], entrada, salida, ok=False)
    if not texto:
        return _res("El modelo no devolvió una respuesta de texto.", entrada, salida, ok=False)
    if nombre_motivo == "MAX_TOKENS":
        # Hay texto, pero incompleto: se entrega avisando en vez de descartarlo.
        texto += "\n\n[Respuesta cortada por longitud. Pide una versión más acotada.]"
    return _res(texto, entrada, salida, ok=True)
