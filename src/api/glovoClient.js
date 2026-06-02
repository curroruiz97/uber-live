// Cliente que habla con la Edge Function `glovo` (NO con Glovo directamente).
// La Edge Function guarda la clave privada RSA, firma el client_assertion JWT, lo
// intercambia en STS por un access_token (Bearer ~2h) y llama a la Live Operations
// API. Así la clave nunca llega al navegador y no hay problemas de CORS.

import { GLOVO_FN_BASE, SUPABASE_ANON_KEY, authHeaders } from '../config/api'

export class GlovoApiError extends Error {
  constructor(message, kind, status) {
    super(message)
    this.name = 'GlovoApiError'
    this.kind = kind // 'network' | 'not_configured' | 'auth' | 'endpoint' | 'http' | 'abort'
    this.status = status
  }
}

async function request(path, { environment, signal } = {}) {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${GLOVO_FN_BASE}${path}${sep}env=${encodeURIComponent(environment || 'staging')}`

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    ...(await authHeaders()),
  }
  let res
  try {
    res = await fetch(url, { headers, signal })
  } catch (e) {
    if (e?.name === 'AbortError') throw new GlovoApiError('Petición cancelada.', 'abort')
    throw new GlovoApiError('No se pudo contactar con el proxy de Glovo (Edge Function de Supabase).', 'network')
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
    else if (res.status === 401 || res.status === 403) kind = 'auth'
    else if (res.status === 404) kind = 'endpoint'
    throw new GlovoApiError(data?.message || `Error ${res.status} desde la API de Glovo.`, kind, res.status)
  }

  return data
}

export function createGlovoClient({ environment } = {}) {
  return {
    environment,
    getHealth: (signal) => request('/health', { environment, signal }),
    // Validación ligera (token + 1 llamada): para la pantalla de Ajustes.
    getPing: (signal) => request('/ping', { environment, signal }),
    // Live Operations API (flota real con GPS): riders por ciudad + KPIs.
    getFleet: (signal) => request('/fleet', { environment, signal }),
  }
}
