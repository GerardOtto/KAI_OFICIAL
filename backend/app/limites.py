"""Topes de frecuencia en memoria, por clave.

Frenan los abusos de las rutas públicas de autenticación: adivinar una
contraseña probando una tras otra, rociar contraseñas comunes sobre muchas
cuentas desde una misma conexión, o crear cuentas en masa con un guion.

Viven en la memoria del proceso, como el tope del formulario de contacto
(`contacto.permitir`): se reinician con el backend y no guardan en la base ni
el correo ni la IP de nadie. Con varios procesos, cada uno lleva su propia
cuenta y el tope efectivo se multiplica por su número; sigue frenando un
ataque, que es lo que se busca.

Los topes se ajustan por variables de entorno. Conviene subirlos, por ejemplo,
para una jornada de inscripción en un campus donde muchas personas salen a
internet por la misma IP.
"""
import os
import threading
import time
from collections import deque


class Limitador:
    """Ventana deslizante: como mucho `maximo` marcas por clave en `ventana` segundos."""

    def __init__(self, maximo: int, ventana: float):
        self.maximo = maximo
        self.ventana = ventana
        self._marcas: dict[str, deque] = {}
        # Los endpoints síncronos de FastAPI corren en un grupo de hilos:
        # comprobar y anotar son dos pasos, y sin cerrojo dos peticiones
        # simultáneas pasarían ambas.
        self._cerrojo = threading.Lock()

    def _vigentes(self, clave: str, ahora: float) -> deque | None:
        marcas = self._marcas.get(clave)
        if marcas is None:
            return None
        while marcas and ahora - marcas[0] > self.ventana:
            marcas.popleft()
        if not marcas:
            # La clave vacía se borra: si no, cada correo o IP que pasara una sola
            # vez quedaría en memoria para siempre.
            del self._marcas[clave]
            return None
        return marcas

    def excedido(self, clave: str) -> bool:
        """Si la clave ya agotó su tope. No anota nada."""
        with self._cerrojo:
            marcas = self._vigentes(clave, time.monotonic())
            return marcas is not None and len(marcas) >= self.maximo

    def registrar(self, clave: str) -> None:
        """Anota una marca, esté o no bajo el tope."""
        with self._cerrojo:
            ahora = time.monotonic()
            self._vigentes(clave, ahora)
            self._marcas.setdefault(clave, deque()).append(ahora)

    def permitir(self, clave: str) -> bool:
        """Anota un intento y dice si aún cabía bajo el tope."""
        with self._cerrojo:
            ahora = time.monotonic()
            marcas = self._vigentes(clave, ahora)
            if marcas is not None and len(marcas) >= self.maximo:
                return False
            self._marcas.setdefault(clave, deque()).append(ahora)
            return True

    def olvidar(self, clave: str) -> None:
        with self._cerrojo:
            self._marcas.pop(clave, None)


def _entero(variable: str, defecto: int) -> int:
    return int(os.getenv(variable, str(defecto)))


# Inicios de sesión fallidos contra una misma cuenta. Es el tope que impide
# adivinar una contraseña: se cuenta por correo, no por IP, para que valga
# aunque el ataque llegue desde muchas direcciones y para no castigar a quien
# comparte la IP de un campus. Expira solo; no bloquea la cuenta para siempre.
FALLOS_POR_CUENTA = Limitador(_entero("KAI_LOGIN_FALLOS_POR_CUENTA", 10), 15 * 60)

# Inicios fallidos desde una misma conexión, sobre cualquier cuenta. Cubre lo
# que el anterior no ve: probar unas pocas contraseñas sobre muchas cuentas. Es
# más holgado porque una IP de campus la comparten muchas personas.
FALLOS_POR_IP = Limitador(_entero("KAI_LOGIN_FALLOS_POR_IP", 50), 15 * 60)

# Cuentas creadas desde una misma conexión. Holgado por el mismo motivo: un
# curso que se inscribe a la vez no debe chocar con él; un guion, sí.
REGISTROS_POR_IP = Limitador(_entero("KAI_REGISTROS_POR_IP", 50), 60 * 60)
