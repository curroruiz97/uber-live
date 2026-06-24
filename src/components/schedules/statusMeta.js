// Fuente única de verdad para colores/etiquetas de estados de cumplimiento y avisos.
// hex se usa en SVG (gráficos, heatmap); chip en badges; dot en puntos.
import { CheckCircle2, AlertTriangle, UserX, CalendarOff, Sparkles, Percent, Ban, Clock } from 'lucide-react'

// Estados v2: cumple → parcial → ausente; justificado (excusado), extra y sin_datos.
export const STATUS_META = {
  cumple: { label: 'Cumple', hex: '#22C55E', chip: 'bg-green-500/10 text-green-600 dark:text-green-400', dot: 'bg-green-500', Icon: CheckCircle2 },
  parcial: { label: 'Parcial', hex: '#F59E0B', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', Icon: AlertTriangle },
  ausente: { label: 'Ausente', hex: '#EF4444', chip: 'bg-red-500/10 text-red-600 dark:text-red-400', dot: 'bg-red-500', Icon: UserX },
  justificado: { label: 'Justificado', hex: '#38BDF8', chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', dot: 'bg-sky-500', Icon: CalendarOff },
  extra: { label: 'Extra', hex: '#A78BFA', chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', dot: 'bg-violet-500', Icon: Sparkles },
  sin_datos: { label: 'Sin datos', hex: '#71717A', chip: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400', dot: 'bg-zinc-400', Icon: Clock },
}

export const STATUS_ORDER = ['cumple', 'parcial', 'ausente', 'justificado', 'extra', 'sin_datos']

export const ALERT_META = {
  ausente: { label: 'Ausencia', Icon: UserX, chip: 'bg-red-500/10 text-red-600 dark:text-red-400', severity: 'critical' },
  parcial: { label: 'Jornada parcial', Icon: AlertTriangle, chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', severity: 'warning' },
  baja_aceptacion: { label: 'Aceptación baja', Icon: Percent, chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', severity: 'warning' },
  cancelaciones: { label: 'Cancelaciones altas', Icon: Ban, chip: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', severity: 'warning' },
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
