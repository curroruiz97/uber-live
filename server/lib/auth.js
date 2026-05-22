// Middleware de autenticación para /api: exige un token de Supabase válido.
//
// El frontend envía `Authorization: Bearer <access_token>` (sesión de Supabase).
// Lo validamos contra GET {SUPABASE_URL}/auth/v1/user (con la anon key como apikey).
// Cacheamos el resultado ~60s por token para no llamar a Supabase en cada request.
//
// Sin esto, los endpoints /api/uber y /api/wa quedarían abiertos al exponer el backend
// en producción (fuga de PII de conductores, control de WhatsApp, etc.).

const cache = new Map() // token -> { ok, exp }
const TTL_MS = 60_000

export function requireAuth(env = process.env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY

  return async function authMiddleware(req, res, next) {
    if (!url || !anon) {
      // Fallar cerrado: sin config no podemos validar.
      return res.status(503).json({
        error: 'auth_not_configured',
        message: 'Falta SUPABASE_URL / SUPABASE_ANON_KEY en el backend.',
      })
    }
    const hdr = req.headers.authorization || ''
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7).trim() : ''
    if (!token) {
      return res.status(401).json({ error: 'unauthorized', message: 'Falta el token de sesión.' })
    }

    const cached = cache.get(token)
    if (cached && cached.exp > Date.now()) {
      if (cached.ok) return next()
      return res.status(401).json({ error: 'unauthorized', message: 'Sesión no válida.' })
    }

    try {
      const r = await fetch(`${url}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: anon },
      })
      const ok = r.status === 200
      cache.set(token, { ok, exp: Date.now() + TTL_MS })
      if (ok) return next()
      return res.status(401).json({ error: 'unauthorized', message: 'Token inválido o expirado.' })
    } catch (e) {
      return res.status(503).json({ error: 'auth_check_failed', message: e.message })
    }
  }
}
