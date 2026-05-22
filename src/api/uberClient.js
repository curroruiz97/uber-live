// Cliente que habla con el BACKEND (/api/uber), NO con Uber directamente.
// El backend (server/lib/uberService.js) guarda el client_secret, hace el OAuth y
// reenvía las llamadas. Opcionalmente se pasa un token ya minteado (se reenvía tal cual).
// Así el secret nunca llega al navegador y no hay problemas de CORS.

import { UBER_FN_BASE, SUPABASE_ANON_KEY, authHeaders } from '../config/api'

export class ApiError extends Error {
  constructor(message, kind, status) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind // 'network' | 'not_configured' | 'oauth' | 'auth' | 'endpoint' | 'http' | 'abort'
    this.status = status
  }
}

async function request(path, { environment, token, signal } = {}) {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${UBER_FN_BASE}${path}${sep}env=${encodeURIComponent(environment || 'sandbox')}`

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    ...(token ? { 'x-uber-token': token } : {}),
    ...(await authHeaders()),
  }
  let res
  try {
    res = await fetch(url, { headers, signal })
  } catch (e) {
    if (e?.name === 'AbortError') throw new ApiError('Petición cancelada.', 'abort')
    throw new ApiError(
      'No se pudo contactar con el proxy de Uber (Edge Function de Supabase).',
      'network',
    )
  }

  let data
  try {
    data = await res.json()
  } catch {
    data = {}
  }

  if (!res.ok) {
    let kind = 'http'
    if (data?.error === 'not_configured') kind = 'not_configured'
    else if (data?.error === 'oauth') kind = 'oauth'
    else if (res.status === 401 || res.status === 403) kind = 'auth'
    else if (res.status === 404) kind = 'endpoint'
    throw new ApiError(data?.message || `Error ${res.status} desde la API de Uber.`, kind, res.status)
  }

  return data
}

export function createUberClient({ environment, token } = {}) {
  return {
    environment,
    getHealth: (signal) => request('/health', { environment, signal }),
    // Validación ligera (solo orgs): rápida, para la pantalla de conexión.
    getPing: (signal) => request('/ping', { environment, token, signal }),
    // Vehicle Solutions API (flota real): orgs -> conductores -> ubicación en vivo.
    getFleet: (signal) => request('/fleet', { environment, token, signal }),
    getDeliveries: (signal) => request('/deliveries', { environment, token, signal }),
    getDelivery: (id, signal) =>
      request(`/deliveries/${encodeURIComponent(id)}`, { environment, token, signal }),
  }
}
