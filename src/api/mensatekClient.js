// Cliente que habla con la Edge Function /mensatek (NO con Mensatek directamente).
// La función guarda el API Token y añade la Basic Auth; aquí solo mandamos la
// sesión de Supabase (apikey + Bearer) que la función valida con getUser.

import { MENSATEK_FN_BASE, SUPABASE_ANON_KEY, authHeaders } from '../config/api'

export class MensatekError extends Error {
  constructor(message, kind, status) {
    super(message)
    this.name = 'MensatekError'
    this.kind = kind // 'network' | 'not_configured' | 'auth' | 'http' | 'proxy_error'
    this.status = status
  }
}

async function call(path, body, { signal } = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    ...(await authHeaders()),
  }
  let res
  try {
    res = await fetch(`${MENSATEK_FN_BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {}),
      signal,
    })
  } catch (e) {
    if (e?.name === 'AbortError') throw new MensatekError('Petición cancelada.', 'abort')
    throw new MensatekError('No se pudo contactar con el proxy de Mensatek.', 'network')
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
    else if (res.status === 401 || res.status === 403 || data?.error === 'auth') kind = 'auth'
    throw new MensatekError(data?.message || `Error ${res.status} desde Mensatek.`, kind, res.status)
  }
  return data
}

export const mensatekApi = {
  health: (signal) => call('/health', {}, { signal }),
  credits: (signal) => call('/credits', {}, { signal }),
  sendSms: (payload, signal) => call('/send-sms', payload, { signal }),
  sendEmail: (payload, signal) => call('/send-email', payload, { signal }),
  report: (payload, signal) => call('/report', payload, { signal }),
}
