"""Backend de prueba para las sondas del asistente (`motores` y `respuestas_markdown`).

Es el backend real con dos sustituciones, para ejercitar la interfaz del chat en
un navegador sin gastar tokens ni tener una cuenta de Google:

  * El proveedor de lenguaje es un doble. Ante «Compara la PUCV en THE Latam»
    devuelve una respuesta en Markdown con todo lo que suele romperse al
    dibujarla (negritas mal escritas, una tabla ancha, listas, saltos de línea,
    cita, código, un enlace y un <script>); ante cualquier otra cosa, «Respuesta
    simulada del motor X (contexto: N)», con N los turnos del usuario que le
    llegaron.
  * El asistente queda abierto a cualquier cuenta, y las cuentas nuevas nacen en
    un plan de pago, para poder elegir entre los dos motores.

Uso (con la base de pruebas en DATABASE_URL):

    python pruebas/servidor_doble.py            # escucha en :8010
    KAI_API_URL=http://localhost:8010 node pruebas/ejecutar.mjs motores respuestas_markdown

La aplicación tiene que estar compilada contra esa dirección (VITE_API_URL).
"""
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
os.chdir(RAIZ)

from dotenv import load_dotenv

load_dotenv(os.path.join(RAIZ, ".env"))
# Ambos motores deben figurar como configurados; el doble no los llama nunca.
os.environ.setdefault("ANTHROPIC_API_KEY", "clave-de-prueba")
os.environ.setdefault("GEMINI_API_KEY", "clave-de-prueba")

import uvicorn  # noqa: E402

from app import acceso, auth, main, motores  # noqa: E402
from app.herramientas import resultado  # noqa: E402

RESPUESTA_MARKDOWN = """La PUCV **subió 12 posiciones** en THE Latam, y esta frase está ** mal escrita ** a propósito.

| Universidad | 2024 | 2025 | Cambio |
|---|---:|---:|---:|
| Pontificia Universidad Católica de Valparaíso, sede principal | 45,2 | 48,9 | +3,7 |
| Pontificia Universidad Católica de Chile, Campus San Joaquín | 80,1 | 81,4 | +1,3 |
| Universidad de Chile, Facultad de Ciencias Físicas y Matemáticas | 79,0 | 78,2 | -0,8 |

- Métrica usada: `citations_per_faculty`
- Fuente: [THE Latam](https://www.timeshighereducation.com/world-university-rankings)

Rankings consultados:
1: THE Latam
2: QS Latam
3: Scimago Latam

> Las cifras son las publicadas por cada ranking.

```sql
SELECT nombre_universidad FROM universidad LIMIT 3
```

<script>window.__inyectado = true</script>
"""


def responder_doble(motor, mensajes, emitir=None):
    ultimo = next((m["content"] for m in reversed(mensajes) if m.get("role") == "user"), "")
    if isinstance(ultimo, list):
        ultimo = " ".join(str(p.get("text", "")) for p in ultimo if isinstance(p, dict))
    if "Compara la PUCV en THE Latam" in str(ultimo):
        texto = RESPUESTA_MARKDOWN
    else:
        turnos = sum(1 for m in mensajes if m.get("role") == "user")
        texto = f"Respuesta simulada del motor {motor} (contexto: {turnos})"
    if emitir is not None:
        # /chat/stream: el texto se entrega en trozos, como lo hace un motor real,
        # para que las pruebas de navegador recorran la vista en vivo.
        emitir({"tipo": "estado", "texto": "Consultando la base de datos"})
        emitir({"tipo": "reinicio"})
        for i in range(0, len(texto), 40):
            emitir({"tipo": "texto", "delta": texto[i:i + 40]})
    return resultado(texto, f"modelo-doble-{motor}", motor, 1000, 100, ok=True)


motores.responder = responder_doble
acceso.puede_usar_asistente = lambda usuario: (True, None)
# Cuentas nuevas en un plan de pago: el gratuito no incluye Claude.
auth.PLAN_POR_DEFECTO = os.getenv("KAI_PLAN_DOBLE", "investigador")

if __name__ == "__main__":
    uvicorn.run(main.app, host="127.0.0.1", port=int(os.getenv("KAI_PUERTO_DOBLE", "8010")))
