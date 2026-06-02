// Cliente de la Edge Function org-credentials: guarda credenciales por empresa.
// El secreto viaja al backend (que lo escribe en org_secrets) y nunca vuelve.
import { ORG_CRED_FN_BASE, SUPABASE_ANON_KEY, authHeaders } from '../config/api'

async function post(path, body) {
  const res = await fetch(`${ORG_CRED_FN_BASE}${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body || {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || `Error ${res.status}`)
  return data
}

export const orgCredentials = {
  saveUber: (p) => post('/uber', p),
  saveMensatek: (p) => post('/mensatek', p),
  // p = { phone_number_id, business_account_id, token }
  saveWhatsApp: (p) => post('/whatsapp', p),
  // p = { client_id, kid, company_id, city_codes, environment, private_key }
  saveGlovo: (p) => post('/glovo', p),
}
