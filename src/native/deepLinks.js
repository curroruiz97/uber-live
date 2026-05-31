import { supabase } from '../lib/supabase'
import { isNative } from './platform'

// Esquema de deep link de la app (debe coincidir con el intent-filter de Android y
// el CFBundleURLSchemes de iOS). Supabase debe tener esta URL en "Redirect URLs".
export const APP_SCHEME = 'com.sapiens.telcolive'
export const AUTH_CALLBACK_URL = `${APP_SCHEME}://auth-callback`

// URL de redirección para signUp / OAuth: en nativo el deep link de la app; en web
// el origin actual (donde `detectSessionInUrl` cierra el flujo automáticamente).
export function getAuthRedirectUrl() {
  if (isNative) return AUTH_CALLBACK_URL
  try {
    return window.location.origin
  } catch {
    return undefined
  }
}

// Procesa una URL entrante (confirmación de email u OAuth) y establece la sesión.
// Soporta PKCE (?code=...) e implícito (#access_token=...&refresh_token=...).
// Devuelve true si la URL contenía credenciales de auth (las haya aplicado o no).
export async function handleAuthDeepLink(url) {
  if (!url) return false
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  const code = parsed.searchParams.get('code')
  if (code) {
    try {
      await supabase.auth.exchangeCodeForSession(code)
    } catch {
      /* ignore: el AuthProvider mostrará el estado real */
    }
    return true
  }

  // Flujo implícito: tokens en el fragmento (#).
  const hash = parsed.hash?.startsWith('#') ? parsed.hash.slice(1) : parsed.hash
  if (hash) {
    const frag = new URLSearchParams(hash)
    const access_token = frag.get('access_token')
    const refresh_token = frag.get('refresh_token')
    if (access_token && refresh_token) {
      try {
        await supabase.auth.setSession({ access_token, refresh_token })
      } catch {
        /* ignore */
      }
      return true
    }
  }
  return false
}
