"""Motor Claude del asistente: razonamiento profundo, más caro por token.

Las herramientas de datos y el formato de respuesta son comunes a todos los
motores y viven en `herramientas.py`; aquí solo está lo propio del proveedor:
el ciclo de llamadas, la contabilidad de tokens y la traducción de sus errores.

A las herramientas de base de datos se suma la búsqueda web, que en Anthropic no
es una función local sino una herramienta de servidor: el modelo la invoca y la
ejecuta la propia API, así que el `tool_runner` la reenvía sin intentar
resolverla aquí. Ver `HERRAMIENTAS_WEB`.
"""
import logging
import os

import anthropic
from anthropic import Anthropic

from .herramientas import TOOLS, resultado, system_prompt

logger = logging.getLogger(__name__)

MOTOR = "claude"
MODEL = "claude-opus-5"

# Herramientas de servidor: las ejecuta Anthropic, no este proceso. El
# `tool_runner` separa las que sabe ejecutar (las de `TOOLS`) de las que solo
# tiene que declarar, así que basta con añadirlas a la lista.
#
# `web_search_20260209` filtra los resultados con código antes de que entren en
# el contexto, lo que en Opus 5 sale más barato y más preciso que la versión
# anterior. `max_uses` es el freno de gasto: cada búsqueda se factura aparte de
# los tokens, así que un turno no puede encadenar búsquedas sin límite.
MAX_BUSQUEDAS = int(os.getenv("CLAUDE_MAX_BUSQUEDAS", "5"))

HERRAMIENTAS_WEB = [
    {"type": "web_search_20260209", "name": "web_search", "max_uses": MAX_BUSQUEDAS},
    # Permite abrir una página concreta (la metodología oficial de un ranking,
    # por ejemplo) en vez de quedarse con el extracto del buscador.
    {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": MAX_BUSQUEDAS},
]

# El cliente se crea a demanda: instanciarlo al importar reventaría el arranque
# del backend si falta la clave, dejando caída también la parte pública de la API.
_cliente = None


def configurado() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY"))


def cliente() -> Anthropic:
    global _cliente
    if _cliente is None:
        _cliente = Anthropic()
    return _cliente


def _res(texto: str, entrada: int = 0, salida: int = 0, ok: bool = True,
         busquedas: int = 0) -> dict:
    return resultado(texto, MODEL, MOTOR, entrada, salida, ok, busquedas)


CONSOLA_BILLING = "platform.claude.com/settings/billing"

# El saldo agotado llega como 400 invalid_request_error; el texto exacto lo fija
# Anthropic, así que se comprueban varias señales. Ver docs/asistente-creditos.md.
SENALES_SIN_CREDITO = ("credit balance", "insufficient credit", "purchase credits", "plans & billing")

# Distinto del anterior: aquí hay saldo, pero se alcanzó un tope de gasto que
# alguien configuró en la consola. También llega como 400.
SENALES_TOPE_PROPIO = ("you have reached your specified api usage limits",
                       "you have reached your specified workspace api usage limits")


def _detalle_error(e) -> str:
    """Texto del error en minúsculas, para buscar señales sin reventar si falta."""
    try:
        return str(e).lower()
    except Exception:
        return ""


def _es_tope_de_gasto_mensual(e) -> bool:
    """Un 429 puede ser rate limit (se reintenta en segundos) o el tope mensual de
    gasto de la organización (no se recupera hasta el día 1 del mes siguiente).
    La API los distingue con error.details.error_code."""
    cuerpo = getattr(e, "body", None)
    if isinstance(cuerpo, dict):
        detalles = (cuerpo.get("error") or {}).get("details") or {}
        if detalles.get("error_code") == "enforced_spend_limit_reached":
            return True
    return "enforced_spend_limit_reached" in _detalle_error(e)


def responder(mensajes: list[dict]) -> dict:
    if not configurado():
        return _res("El servidor no tiene configurada ANTHROPIC_API_KEY: el motor Claude "
                    "está deshabilitado. Ver docs/asistente-creditos.md.", ok=False)

    entrada = salida = busquedas = 0
    try:
        runner = cliente().beta.messages.tool_runner(
            model=MODEL,
            max_tokens=4096,
            output_config={"effort": "medium"},
            system=system_prompt(),
            tools=[*TOOLS, *HERRAMIENTAS_WEB],
            messages=mensajes,
        )
        final = None
        for message in runner:
            final = message
            # El ciclo de herramientas hace varias llamadas a la API; el consumo
            # es la suma de todas, no solo el de la última.
            uso = getattr(message, "usage", None)
            if uso is not None:
                entrada += (getattr(uso, "input_tokens", 0) or 0)
                entrada += (getattr(uso, "cache_read_input_tokens", 0) or 0)
                entrada += (getattr(uso, "cache_creation_input_tokens", 0) or 0)
                salida += (getattr(uso, "output_tokens", 0) or 0)
                # Las búsquedas web se facturan por uso, aparte de los tokens.
                servidor = getattr(uso, "server_tool_use", None)
                if servidor is not None:
                    busquedas += (getattr(servidor, "web_search_requests", 0) or 0)
                    busquedas += (getattr(servidor, "web_fetch_requests", 0) or 0)

    # El orden importa: las tres primeras son subclases de APIStatusError y deben
    # ir antes que ella, de lo más específico a lo más general.
    except anthropic.AuthenticationError:
        return _res(("La clave de la API de Claude no es válida, fue revocada o expiró. "
                "Hay que generar una nueva y ponerla en ANTHROPIC_API_KEY (backend/.env). "
                "Ver docs/asistente-creditos.md."), ok=False)
    except anthropic.PermissionDeniedError:
        return _res(("La clave de la API no tiene permiso para usar este modelo o su workspace está "
                f"deshabilitado. Revisa los permisos de la clave en {CONSOLA_BILLING.split('/')[0]}."), ok=False)
    except anthropic.NotFoundError:
        return _res((f"El modelo '{MODEL}' no existe o no está habilitado para esta cuenta. "
                "Revisa el identificador del modelo en backend/app/assistant.py."), ok=False)
    except anthropic.RateLimitError as e:
        # Un 429 no siempre es un pico de tráfico: también es el tope de gasto
        # mensual de la organización, que no se recupera reintentando.
        if _es_tope_de_gasto_mensual(e):
            return _res(("La organización alcanzó su tope de gasto mensual en la API. El acceso se "
                    "restablece el día 1 del mes siguiente, o antes si se sube el límite en "
                    f"{CONSOLA_BILLING} (ver docs/asistente-creditos.md)."), ok=False)
        return _res("El asistente recibió demasiadas solicitudes en poco tiempo. Espera unos segundos y vuelve a intentar.", ok=False)
    except anthropic.BadRequestError as e:
        detalle = _detalle_error(e)
        if any(s in detalle for s in SENALES_SIN_CREDITO):
            return _res(("La cuenta de Anthropic se quedó sin créditos. Hay que recargar saldo en "
                    f"{CONSOLA_BILLING} (ver docs/asistente-creditos.md). Mientras tanto puedes "
                    "abrir una conversación nueva con el motor Gemini."), ok=False)
        if any(s in detalle for s in SENALES_TOPE_PROPIO):
            return _res(("Se alcanzó el límite de gasto configurado manualmente para esta cuenta o "
                    f"workspace. Súbelo o quítalo en {CONSOLA_BILLING} (ver docs/asistente-creditos.md)."), ok=False)
        return _res("El asistente rechazó la solicitud (parámetros inválidos). Intenta reformular tu consulta.", ok=False)
    except anthropic.APITimeoutError:
        return _res("El asistente tardó demasiado en responder. Vuelve a intentarlo con una consulta más acotada.", ok=False)
    except anthropic.APIConnectionError:
        return _res("No se pudo conectar con la API de Claude. Verifica la conexión a internet del servidor.", ok=False)
    except anthropic.APIStatusError as e:
        # 402 billing_error: el SDK de Python no tiene clase propia para este
        # código, así que se distingue aquí. Es un problema de medio de pago,
        # no de saldo consumido.
        if e.status_code == 402:
            return _res(("Hay un problema con la facturación o el medio de pago de la cuenta de "
                    f"Anthropic. Revisa los datos de pago en {CONSOLA_BILLING} "
                    "(ver docs/asistente-creditos.md)."), ok=False)
        if e.status_code >= 500:
            return _res((f"El servicio de IA está caído o sobrecargado (código {e.status_code}). "
                    "Intenta de nuevo en unos minutos."), ok=False)
        return _res(f"El servicio de IA respondió con un error (código {e.status_code}): {e.message}", ok=False)
    except Exception as e:
        # Red de seguridad: si falla una herramienta (por ejemplo, la base de datos
        # caída) la excepción no debe propagarse y convertirse en un 500 opaco,
        # porque el frontend lo mostraría como "no se pudo contactar al asistente".
        logger.exception("Fallo inesperado en el motor Claude")
        return _res(
            f"El asistente falló al procesar la consulta ({type(e).__name__}). "
            "Revisa los logs del backend; puede ser un problema con la base de datos.",
            entrada, salida, ok=False)

    if final is None:
        return _res("No se obtuvo respuesta del modelo.", entrada, salida, ok=False)

    if getattr(final, "stop_reason", None) == "refusal":
        return _res("El modelo declinó responder a esa consulta por sus políticas de uso. Reformúlala.",
                    entrada, salida, ok=False, busquedas=busquedas)

    # Se concatenan todos los bloques de texto, no solo el primero: cuando el
    # modelo usa la búsqueda web, la respuesta final llega partida en varios
    # bloques con los resultados de búsqueda intercalados, y quedarse con el
    # primero devolvería la respuesta a medias.
    texto = "\n\n".join(b.text for b in final.content if b.type == "text" and b.text.strip())
    if not texto:
        return _res("El modelo no devolvió una respuesta de texto.", entrada, salida,
                    ok=False, busquedas=busquedas)
    return _res(texto, entrada, salida, ok=True, busquedas=busquedas)
