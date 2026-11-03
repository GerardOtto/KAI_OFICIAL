# Producción: se compila la aplicación y se sirven los archivos resultantes.
#
# Antes este contenedor corría `npm run dev`, el servidor de desarrollo de Vite,
# que no está hecho para producción: compila cada módulo al vuelo en cada
# visita, sirve el código fuente sin minificar e inyecta el cliente de recarga
# en caliente (/@vite/client) en la página pública.

# --- Compilación ---------------------------------------------------------------
# Node 22: Vite 8 exige 20.19 o 22.12 en adelante.
FROM node:22-slim AS compilacion
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .

# Vite incrusta las variables VITE_* al compilar, no al servir: la dirección del
# backend tiene que llegar aquí, como argumento de construcción. En Railway
# basta con que VITE_API_URL exista como variable del servicio. Sin ella, la
# compilación se detiene: la aplicación pediría todo a «undefined/...».
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || { echo "Falta VITE_API_URL: pásala como argumento de construcción." >&2; exit 1; }
RUN npm run build

# --- Servicio ------------------------------------------------------------------
FROM node:22-slim
WORKDIR /app
RUN npm install -g --no-audit --no-fund serve@14.2.6
COPY --from=compilacion /app/dist ./dist
# El mismo puerto que antes, para no cambiar lo que espera el despliegue.
EXPOSE 5173
# -s: una ruta que no es un archivo devuelve index.html, que es lo que necesita
# React Router para abrir /tendencias o /ranking directamente.
CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:5173"]
