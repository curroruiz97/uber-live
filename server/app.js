import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createUberService } from './lib/uberService.js'
import { requireAuth } from './lib/auth.js'
import { uberRouter } from './routes/uber.js'
import { whatsappRouter } from './routes/whatsapp.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '..', 'dist')

export function createApp() {
  const app = express()
  // Front (Vercel) y backend (Railway) viven en orígenes distintos -> CORS.
  // El acceso lo protege el token Bearer (requireAuth), no el origen, así que
  // reflejar cualquier origen es seguro aquí.
  app.use(cors())
  app.use(express.json({ limit: '1mb' }))

  // Liveness simple del backend (abierto, sin datos sensibles).
  app.get('/api/health', (req, res) => res.json({ ok: true }))

  // /api/uber y /api/wa exigen un token de Supabase válido.
  app.use('/api/uber', requireAuth(), uberRouter(createUberService(process.env)))
  app.use('/api/wa', requireAuth(), whatsappRouter())

  // En producción servimos el SPA ya compilado -> un solo despliegue.
  // (En dev el front lo sirve Vite y reenvía /api aquí por proxy.)
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir))
    // Fallback SPA para navegación cliente: cualquier GET no-API -> index.html.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  return app
}
