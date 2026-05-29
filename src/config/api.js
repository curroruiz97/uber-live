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
// El backend valida ambos (getUser + pertenencia a la org).
export async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  const h = {}
  if (token) h.Authorization = `Bearer ${token}`
  if (activeOrgId) h['x-org-id'] = activeOrgId
  return h
}
