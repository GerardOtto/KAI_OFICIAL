"""Lectura de variables de entorno con valor por defecto.

Una variable definida pero vacía (`JWT_HORAS_VALIDEZ=` en un .env copiado de la
plantilla, o una variable creada sin valor en Railway) cuenta como no definida.
Antes, `int(os.getenv("X", "12"))` recibía "" y el backend no arrancaba; y una
lista vacía —`KAI_DOMINIOS_ASISTENTE`, `GEMINI_MODELOS`— dejaba sin asistente a
todo el mundo o sin modelos al motor Gemini.
"""
import os


def texto(nombre: str, defecto: str = "") -> str:
    """El valor sin espacios en los extremos, o `defecto` si falta o está vacío."""
    return (os.getenv(nombre) or "").strip() or defecto


def entero(nombre: str, defecto: int) -> int:
    """El valor como entero, o `defecto` si falta o está vacío.

    Un valor que no es un número detiene el arranque con un mensaje que nombra
    la variable, en vez de un ValueError sin contexto.
    """
    valor = texto(nombre)
    if not valor:
        return defecto
    try:
        return int(valor)
    except ValueError:
        raise RuntimeError(f"La variable de entorno {nombre} debe ser un número entero (vale «{valor}»).") from None
