"""Registro de los motores del asistente y despacho hacia el que corresponda.

Cada conversación queda ligada a un motor en el momento de crearse y no puede
cambiarlo después. El motivo es el historial: los proveedores no comparten ni el
formato de los turnos ni las firmas internas que acompañan al razonamiento y a
las llamadas de herramientas, así que reenviar a un modelo lo que produjo el otro
da respuestas incoherentes en el mejor caso y errores de formato en el peor.
Para pasar una pregunta de un motor a otro se abre una conversación nueva
(«derivar»), que empieza con el contexto limpio.
"""
from . import assistant as claude
from . import assistant_gemini as gemini

POR_DEFECTO = "claude"

# El orden es el de presentación en la interfaz.
CATALOGO = [
    {
        "id": claude.MOTOR,
        "nombre": "Claude",
        "modelo": claude.MODEL,
        "descripcion": ("Razonamiento profundo. Para análisis comparativos y preguntas de varios "
                        "pasos. Consulta la base de datos y busca en internet."),
        "etiqueta_costo": "Mayor costo por token",
        "modulo": claude,
    },
    {
        "id": gemini.MOTOR,
        "nombre": "Gemini",
        "modelo": gemini.MODEL,
        "descripcion": ("Respuestas rápidas. Para consultas directas de datos y preguntas "
                        "sencillas. Consulta la base de datos y busca en internet."),
        "etiqueta_costo": "Menor costo por token",
        "modulo": gemini,
    },
]

_POR_ID = {m["id"]: m for m in CATALOGO}


def existe(motor: str) -> bool:
    return motor in _POR_ID


def disponible(motor: str) -> bool:
    """Un motor existe siempre; está disponible solo si tiene su clave de API."""
    entrada = _POR_ID.get(motor)
    return bool(entrada) and entrada["modulo"].configurado()


def nombre(motor: str) -> str:
    entrada = _POR_ID.get(motor)
    return entrada["nombre"] if entrada else motor


def catalogo_publico() -> list[dict]:
    """Catálogo para el frontend, sin la referencia al módulo."""
    return [
        {k: v for k, v in m.items() if k != "modulo"} | {"disponible": m["modulo"].configurado()}
        for m in CATALOGO
    ]


def responder(motor: str, mensajes: list[dict]) -> dict:
    entrada = _POR_ID.get(motor)
    if entrada is None:
        # No debería ocurrir: el motor se valida al crear la conversación y queda
        # guardado. Si aparece aquí, es una fila escrita a mano en la base.
        return claude.responder(mensajes)
    return entrada["modulo"].responder(mensajes)
