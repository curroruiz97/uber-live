import clsx from 'clsx'
import CountUp from '../common/CountUp'
import Sparkline from '../common/Sparkline'

const ACCENTS = {
  emerald: { chip: 'text-green-600 dark:text-green-400 bg-green-500/10', hex: '#22C55E' },
  sky: { chip: 'text-blue-600 dark:text-blue-400 bg-blue-500/10', hex: '#3B82F6' },
  amber: { chip: 'text-amber-600 dark:text-amber-400 bg-amber-500/10', hex: '#F59E0B' },
  indigo: { chip: 'text-accent bg-accent/10', hex: '#f97316' },
  red: { chip: 'text-red-600 dark:text-red-400 bg-red-500/10', hex: '#EF4444' },
}

function mmss(minutes) {
  const total = Math.max(0, Math.round((Number(minutes) || 0) * 60))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function DeltaChip({ delta }) {
  if (delta == null) return null
  const d = Math.round(delta)
  if (d === 0) return null
  const up = d > 0
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
        up
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-red-500/10 text-red-600 dark:text-red-400',
      )}
      title="Cambio vs ciclo anterior"
    >
      {up ? '↑' : '↓'}
      {Math.abs(d)}
    </span>
  )
}

export default function KpiCard({ label, value, decimals = 0, suffix, format, icon: Icon, accent = 'indigo', history, delta, hint }) {
  const a = ACCENTS[accent] ?? ACCENTS.indigo
  return (
    <div className="group relative overflow-hidden rounded-xl border border-line bg-panel p-4 shadow-soft transition hover:border-accent/40">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        {Icon && (
          <span className={clsx('flex h-7 w-7 items-center justify-center rounded-lg', a.chip)}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          {format === 'mmss' ? (
            <span className="font-mono text-xl font-semibold tabular-nums text-fg sm:text-2xl">{mmss(value)}</span>
          ) : (
            <CountUp value={value} decimals={decimals} className="text-xl font-semibold tabular-nums text-fg sm:text-2xl" />
          )}
          {suffix && <span className="text-sm text-faint">{suffix}</span>}
          <DeltaChip delta={delta} />
        </div>
        {history && history.length > 1 && (
          <Sparkline data={history} color={a.hex} className="shrink-0 opacity-90" />
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  )
}
