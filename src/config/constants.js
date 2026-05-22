// Configuración central del dashboard.

export const POLL_INTERVAL_MS = 30000 // 30s, simula los webhooks de Uber por polling

// Base URLs por entorno. En el camino real (cuando exista el spec gated) puedes apuntar
// estas URLs a un proxy/gateway que inyecte el bearer server-side y evite CORS (p.ej. "/uber").
export const ENVIRONMENTS = {
  sandbox: { id: 'sandbox', label: 'Sandbox', baseUrl: 'https://sandbox-api.uber.com' },
  production: { id: 'production', label: 'Producción', baseUrl: 'https://api.uber.com' },
}

// Estados internos del rider + código de color (consistente en mapa / tabla / feed).
// Las clases Tailwind se escriben literalmente para que el JIT las incluya en el build.
export const STATUS = {
  disponible: {
    id: 'disponible',
    label: 'Disponible',
    hex: '#10b981',
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20 dark:border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  en_ruta: {
    id: 'en_ruta',
    label: 'En ruta',
    hex: '#0ea5e9',
    text: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20 dark:border-sky-500/30',
    dot: 'bg-sky-500',
  },
  en_entrega: {
    id: 'en_entrega',
    label: 'En entrega',
    hex: '#f59e0b',
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20 dark:border-amber-500/30',
    dot: 'bg-amber-500',
  },
  offline: {
    id: 'offline',
    label: 'Offline',
    hex: '#71717a',
    text: 'text-zinc-500 dark:text-zinc-400',
    bg: 'bg-zinc-500/10',
    border: 'border-zinc-500/20 dark:border-zinc-500/30',
    dot: 'bg-zinc-500',
  },
}

// Orden de los estados activos (offline al final)
export const STATUS_ORDER = ['disponible', 'en_ruta', 'en_entrega', 'offline']

// Estados que cuentan como "rider activo" (no offline)
export const ACTIVE_STATUSES = ['disponible', 'en_ruta', 'en_entrega']

// Estados con un pedido en curso
export const BUSY_STATUSES = ['en_ruta', 'en_entrega']

// Tipos de evento del feed de actividad
export const EVENT_TYPES = {
  assignment: { id: 'assignment', label: 'Asignación', text: 'text-sky-600 dark:text-sky-400', dot: 'bg-sky-500' },
  completed: { id: 'completed', label: 'Completado', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  cancellation: { id: 'cancellation', label: 'Cancelación', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
}

// Zonas operativas (Valladolid y Madrid). center se usa para asignar zona por cercanía.
export const ZONES = [
  { id: 'vll_centro', label: 'Valladolid · Centro', city: 'Valladolid', center: { lat: 41.6529, lng: -4.7286 } },
  { id: 'vll_oeste', label: 'Valladolid · Parquesol', city: 'Valladolid', center: { lat: 41.645, lng: -4.765 } },
  { id: 'vll_sur', label: 'Valladolid · Delicias', city: 'Valladolid', center: { lat: 41.629, lng: -4.722 } },
  { id: 'mad_centro', label: 'Madrid · Centro', city: 'Madrid', center: { lat: 40.4168, lng: -3.7038 } },
  { id: 'mad_norte', label: 'Madrid · Chamberí', city: 'Madrid', center: { lat: 40.4357, lng: -3.7006 } },
  { id: 'mad_este', label: 'Madrid · Salamanca', city: 'Madrid', center: { lat: 40.4302, lng: -3.6795 } },
]

// Devuelve la zona más cercana a una coordenada (distancia euclídea, suficiente a escala urbana).
export function zoneForLocation(lat, lng) {
  let best = ZONES[0]
  let bestD = Infinity
  for (const z of ZONES) {
    const d = (z.center.lat - lat) ** 2 + (z.center.lng - lng) ** 2
    if (d < bestD) {
      bestD = d
      best = z
    }
  }
  return best
}

// Tiles de mapa: CARTO (gratis, sin token) sobre datos de OpenStreetMap.
// Variante clara u oscura según el tema activo.
export const MAP_TILES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  maxZoom: 20,
}

export const MAP_DEFAULT_CENTER = [41.2, -4.2] // entre Valladolid y Madrid
export const MAP_DEFAULT_ZOOM = 7
