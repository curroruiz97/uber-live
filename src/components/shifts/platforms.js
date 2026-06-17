import UberIcon from '../common/UberIcon'
import GlovoIcon from '../common/GlovoIcon'

// Días de la semana: id = valor guardado (minúscula con acento), label = mostrado.
export const DAYS = [
  { id: 'lunes', label: 'Lunes' },
  { id: 'martes', label: 'Martes' },
  { id: 'miércoles', label: 'Miércoles' },
  { id: 'jueves', label: 'Jueves' },
  { id: 'viernes', label: 'Viernes' },
  { id: 'sábado', label: 'Sábado' },
  { id: 'domingo', label: 'Domingo' },
]

// Índice de orden por día (para ordenar la vista combinada de lunes a domingo).
export const DAY_INDEX = DAYS.reduce((m, d, i) => {
  m[d.id] = i
  return m
}, {})

// Metadatos de marca por plataforma. Uber = negro/gris, Glovo = ámbar/naranja.
// badge: chip de etiqueta; tint: fondo sutil de fila; edge: borde lateral de color.
export const PLATFORMS = {
  uber: {
    id: 'uber',
    label: 'Uber',
    Icon: UberIcon,
    badge: 'bg-zinc-900 text-white dark:bg-zinc-700',
    tint: 'bg-zinc-500/[0.06]',
    edge: 'border-l-zinc-800 dark:border-l-zinc-400',
  },
  glovo: {
    id: 'glovo',
    label: 'Glovo',
    Icon: GlovoIcon,
    badge: 'bg-amber-400 text-zinc-900',
    tint: 'bg-amber-400/10',
    edge: 'border-l-amber-400',
  },
}

export const PLATFORM_IDS = ['uber', 'glovo']
