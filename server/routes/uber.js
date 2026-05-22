import { Router } from 'express'

// Envuelve un handler async y traduce errores a JSON con status/kind/uber.
function wrap(fn) {
  return async (req, res) => {
    try {
      await fn(req, res)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[uber]', e.message)
      res
        .status(e.status || 500)
        .json({ error: e.kind || 'proxy_error', message: e.message, uber: e.uber })
    }
  }
}

const envOf = (req) => (req.query.env === 'production' ? 'production' : 'sandbox')
const tokenOf = (req) => req.headers['x-uber-token'] || ''
const scopeOf = (req) => (req.query.scope != null ? String(req.query.scope) : undefined)

export function uberRouter(uber) {
  const router = Router()

  router.get('/health', (req, res) => res.json(uber.getHealth()))

  // A partir de aquí se exigen credenciales (o un token pegado).
  router.use((req, res, next) => {
    if (!tokenOf(req) && !uber.isConfigured()) {
      return res.status(503).json({
        error: 'not_configured',
        message:
          'Faltan credenciales: define UBER_CLIENT_ID y UBER_CLIENT_SECRET en .env (o pega un token).',
      })
    }
    next()
  })

  router.get(
    '/ping',
    wrap(async (req, res) => {
      res.json(await uber.ping(envOf(req), tokenOf(req), scopeOf(req)))
    }),
  )

  router.get(
    '/fleet',
    wrap(async (req, res) => {
      res.json(await uber.fetchFleet(envOf(req), tokenOf(req), scopeOf(req)))
    }),
  )

  router.get(
    '/deliveries',
    wrap(async (req, res) => {
      const { status, json } = await uber.deliveries(envOf(req), tokenOf(req), scopeOf(req))
      res.status(status).json(json)
    }),
  )

  router.get(
    '/deliveries/:id',
    wrap(async (req, res) => {
      const { status, json } = await uber.delivery(
        req.params.id,
        envOf(req),
        tokenOf(req),
        scopeOf(req),
      )
      res.status(status).json(json)
    }),
  )

  return router
}
