import { createClient } from '@supabase/supabase-js'

// Cliente de Supabase para el navegador: Auth (login del equipo), datos (RLS) y
// Realtime. La anon key es pública (protegida por RLS); va por variables de entorno.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Aviso claro en consola si faltan las variables (en vez de un error críptico).
  // eslint-disable-next-line no-console
  console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env')
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
