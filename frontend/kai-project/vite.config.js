import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
//
// En producción no corre Vite: el Dockerfile compila y sirve `dist/` con `serve`
// (cabeceras en serve.json). Por eso ya no hace falta `server.allowedHosts` con
// el dominio de Railway, que se agregó cuando el contenedor ejecutaba `npm run dev`.
export default defineConfig({
  plugins: [react()],
})
