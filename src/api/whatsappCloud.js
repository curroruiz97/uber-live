// Cliente de la Edge Function `whatsapp` (WhatsApp Business API oficial / Meta Cloud
// API). El token permanente vive en org_secrets y nunca llega al navegador: esta
// función reenvía a graph.facebook.com en nombre de la organización activa.
import { WHATSAPP_FN_BASE, SUPABASE_ANON_KEY, authHeaders } from '../config/api'

async function call(path, body) {
  const res = await fetch(`${WHATSAPP_FN_BASE}${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body || {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.message || `Error ${res.status}`)
    err.kind = data?.error
    err.status = res.status
    err.code = data?.code ?? null
    throw err
  }
  return data
}

export const whatsappCloud = {
  // { configured, hasToken, hasPhone, hasWaba }
  health: () => call('/health', {}),
  // Verifica el número y devuelve { verifiedName, displayPhone, qualityRating, ... }
  verify: () => call('/verify', {}),
  // Lista las plantillas aprobadas de la WABA: { templates: [{ name, status, language, bodyVars, bodyText }] }
  templates: () => call('/templates', {}),
  // Envía un mensaje. p = { to, type:'template'|'text', text?, template?:{name,language,params[]}, riderId? }
  send: (p) => call('/send', p),
}
