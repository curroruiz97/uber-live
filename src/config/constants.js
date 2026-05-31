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
// Paleta de estados (Revolut-grade): verde/azul/ámbar/gris vivos y consistentes.
export const STATUS = {
  disponible: {
    id: 'disponible',
    label: 'Disponible',
    hex: '#22C55E',
    text: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20 dark:border-green-500/30',
    dot: 'bg-green-500',
  },
  en_ruta: {
    id: 'en_ruta',
    label: 'En ruta',
    hex: '#3B82F6',
    text: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20 dark:border-blue-500/30',
    dot: 'bg-blue-500',
  },
  en_entrega: {
    id: 'en_entrega',
    label: 'En entrega',
    hex: '#F59E0B',
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20 dark:border-amber-500/30',
    dot: 'bg-amber-500',
  },
  offline: {
    id: 'offline',
    label: 'Offline',
    hex: '#6B7280',
    text: 'text-gray-500 dark:text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/20 dark:border-gray-500/30',
    dot: 'bg-gray-500',
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
  assignment: { id: 'assignment', label: 'Asignación', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  completed: { id: 'completed', label: 'Completado', text: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },
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
