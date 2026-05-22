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

// Cabecera de autorización con el token de la sesión de Supabase. El backend la
// valida (requireAuth / getUser), así que toda llamada al backend debe incluirla.
export async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}
