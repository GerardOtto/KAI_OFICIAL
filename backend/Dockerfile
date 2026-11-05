FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
# Sin privilegios: si alguien llegara a ejecutar código en el proceso, no sería
# root dentro del contenedor.
RUN useradd --create-home --uid 10001 kai
USER kai
# Sin --reload: vigila los archivos para reiniciar al editar, que en producción
# solo gasta CPU y puede reiniciar el proceso a mitad de una respuesta. Un solo
# proceso, además, mantiene coherentes los topes en memoria (app/limites.py).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]