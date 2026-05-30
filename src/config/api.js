import { supabase } from '../lib/supabase'

// Base del backend (Express). Vacío -> rutas relativas (/api/...), que funcionan
// tanto en dev (Vite reenvía /api por proxy) como en prod si el backend sirve el SPA.
// En el despliegue dividido (front en Vercel, backend en Railway) se define
// VITE_API_BASE = URL del backend.
export const API_BASE = import.meta.env.VITE_API_BASE || ''

// Supabase (para llamar a la Edge Function del proxy de Uber, que es serverless y
// sustituye al backend Express en producción).
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const UBER_FN_BASE = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/uber`
// Proxy de Mensatek (SMS/Email certificado). El API Token vive en los secrets de la
// Edge Function, nunca en el navegador.
export const MENSATEK_FN_BASE = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/mensatek`
// Guarda credenciales de integración por empresa (escribe org_secrets server-side).
export const ORG_CRED_FN_BASE = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/org-credentials`
// URL pública del webhook de reports de Mensatek (se pega en el panel de Mensatek).
export const MENSATEK_WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/mensatek-webhook`

// Organización activa: la fija OrgContext y se envía como x-org-id a las Edge
// Functions, que la revalidan contra org_members y cargan las credenciales de esa
// empresa. Es un módulo simple (no React) para poder usarlo desde los clientes API.
let activeOrgId = ''
export function setActiveOrgId(id) {
  activeOrgId = id || ''
}
export function getActiveOrgId() {
  return activeOrgId
}

// Cabecera de autorización con el token de la sesión de Supabase + el org activo.
// El backend valida ambos (getUser + pertenencia a la org). Refresca el token si falta
// o está a punto de caducar, para evitar el "Missing authorization header" tras recargar
// con una sesión cuyo access_token ya había expirado.
export async function authHeaders() {
  let session = (await supabase.auth.getSession()).data?.session
  const expSoon = session?.expires_at && session.expires_at * 1000 < Date.now() + 60_000
  if (!session?.access_token || expSoon) {
    const refreshed = (await supabase.auth.refreshSession()).data?.session
    if (refreshed?.access_token) session = refreshed
  }
  const h = {}
  if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`
  if (activeOrgId) h['x-org-id'] = activeOrgId
  return h
}
