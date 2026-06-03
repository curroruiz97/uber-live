// Fuente única de verdad para colores/etiquetas de estados de cumplimiento y avisos.
// hex se usa en SVG (gráficos, heatmap); chip en badges; dot en puntos.
import { CheckCircle2, Clock, Hourglass, UserX, LogOut } from 'lucide-react'

// Rampa de severidad: verde (cumple) → ámbar (tarde) → naranja (incompleto) → rojo (ausente).
export const STATUS_META = {
  cumple: { label: 'Cumple', hex: '#22C55E', chip: 'bg-green-500/10 text-green-600 dark:text-green-400', dot: 'bg-green-500', Icon: CheckCircle2 },
  tarde: { label: 'Tarde', hex: '#F59E0B', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', Icon: Clock },
  incompleto: { label: 'Incompleto', hex: '#FB923C', chip: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', dot: 'bg-orange-500', Icon: Hourglass },
  ausente: { label: 'Ausente', hex: '#EF4444', chip: 'bg-red-500/10 text-red-600 dark:text-red-400', dot: 'bg-red-500', Icon: UserX },
}

export const STATUS_ORDER = ['cumple', 'tarde', 'incompleto', 'ausente']

export const ALERT_META = {
  ausencia: { label: 'Ausencia', Icon: UserX, chip: 'bg-red-500/10 text-red-600 dark:text-red-400', severity: 'critical' },
  tarde: { label: 'Llegó tarde', Icon: Clock, chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', severity: 'warning' },
  salida_anticipada: { label: 'Salida anticipada', Icon: LogOut, chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', severity: 'warning' },
  jornada_incompleta: { label: 'Jornada incompleta', Icon: Hourglass, chip: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', severity: 'warning' },
}

// Tono de texto según % de cumplimiento.
export function pctTone(pct) {
  if (pct >= 90) return 'text-green-600 dark:text-green-400'
  if (pct >= 70) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

// Color hex según % (para barras/series).
export function pctHex(pct) {
  if (pct >= 90) return '#22C55E'
  if (pct >= 70) return '#F59E0B'
  return '#EF4444'
}

// dd/mm a partir de 'YYYY-MM-DD'.
export function shortDate(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// dd/mm/aaaa a partir de 'YYYY-MM-DD'.
export function longDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
