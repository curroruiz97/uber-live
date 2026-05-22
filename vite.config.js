import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El backend (Express) corre aparte: `server/index.js`. En desarrollo Vite sirve
// el front con HMR y reenvía /api -> backend (sin CORS). En producción el propio
// backend sirve el dist compilado (un solo despliegue).
export default defineConfig(() => {
  // En dev el backend escucha SIEMPRE en 3001 (lo fija el script dev:api), así que
  // el proxy apunta ahí de forma determinista, sin depender de PORT (que en prod lo
  // inyecta el host, p. ej. Railway).
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: 'http://localhost:3001', changeOrigin: true },
      },
    },
  }
})
