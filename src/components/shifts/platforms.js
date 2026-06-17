import UberIcon from '../common/UberIcon'
import GlovoIcon from '../common/GlovoIcon'

// Días de la semana: id = valor guardado (minúscula con acento), label = mostrado.
export const DAYS = [
  { id: 'lunes', label: 'Lunes', short: 'L' },
  { id: 'martes', label: 'Martes', short: 'M' },
  { id: 'miercoles', label: 'Miércoles', short: 'X' },
  { id: 'jueves', label: 'Jueves', short: 'J' },
  { id: 'viernes', label: 'Viernes', short: 'V' },
  { id: 'sabado', label: 'Sábado', short: 'S' },
  { id: 'domingo', label: 'Domingo', short: 'D' },
]
export const DAY_INDEX = DAYS.reduce((m, d, i) => {
  m[d.id] = i
  return m
}, {})

// Metadatos de marca por plataforma. Uber = negro/gris, Glovo = ámbar.
export const PLATFORMS = {
  uber: { id: 'uber', label: 'Uber', Icon: UberIcon, badge: 'bg-zinc-900 text-white dark:bg-zinc-700', tint: 'bg-zinc-500/[0.06]', edge: 'border-l-zinc-800 dark:border-l-zinc-400' },
  glovo: { id: 'glovo', label: 'Glovo', Icon: GlovoIcon, badge: 'bg-amber-400 text-zinc-900', tint: 'bg-amber-400/10', edge: 'border-l-amber-400' },
}
export const PLATFORM_IDS = ['uber', 'glovo']

// Estados/causas de no disponibilidad. forecast = genera previsión de días no trabajables
// (baja, vacaciones, permiso, avería). Médico y asuntos propios admiten duración pero no
// bloquean por defecto una previsión larga.
export const STATES = {
  baja_laboral: { id: 'baja_laboral', label: 'Baja laboral', chip: 'bg-red-500/10 text-red-600 dark:text-red-400', dot: 'bg-red-500', forecast: true },
  vacaciones: { id: 'vacaciones', label: 'Vacaciones', chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', dot: 'bg-sky-500', forecast: true },
  permiso_no_retribuido: { id: 'permiso_no_retribuido', label: 'Permiso no retribuido', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', forecast: true },
  medico: { id: 'medico', label: 'Médico', chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', dot: 'bg-violet-500', forecast: false },
  asuntos_propios: { id: 'asuntos_propios', label: 'Asuntos propios', chip: 'bg-slate-500/10 text-slate-600 dark:text-slate-300', dot: 'bg-slate-500', forecast: false },
  averia_vehiculo: { id: 'averia_vehiculo', label: 'Avería vehículo', chip: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', dot: 'bg-orange-500', forecast: true },
}
export const STATE_IDS = ['baja_laboral', 'vacaciones', 'permiso_no_retribuido', 'medico', 'asuntos_propios', 'averia_vehiculo']

// Suma días a una fecha ISO (YYYY-MM-DD) y devuelve ISO.
export function addDaysIso(iso, n) {
  if (!iso) return iso
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// Lista de fechas (previsión de días no trabajables) de fecha_inicio durante `dias` días.
export function forecastDays(fechaInicio, dias) {
  const n = Math.max(0, Number(dias) || 0)
  if (!fechaInicio || !n) return []
  return Array.from({ length: n }, (_, i) => addDaysIso(fechaInicio, i))
}

export function longDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
