import clsx from 'clsx'
import { pctTone } from './statusMeta'

function initials(name) {
  return (name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
}

// Podio de los 3 mejores riders por % de cumplimiento.
const SLOTS = [
  { rank: 2, bar: 'h-14', ring: 'ring-slate-400/50', badge: 'bg-slate-400/20 text-slate-600 dark:text-slate-300', order: 'order-1' },
  { rank: 1, bar: 'h-20', ring: 'ring-amber-400/70', badge: 'bg-amber-400/25 text-amber-700 dark:text-amber-300', order: 'order-2' },
  { rank: 3, bar: 'h-10', ring: 'ring-orange-400/50', badge: 'bg-orange-400/20 text-orange-700 dark:text-orange-300', order: 'order-3' },
]

export default function Podium({ top = [] }) {
  if (!top.length) return null
  const byRank = new Map(top.map((r) => [r.rank, r]))

  return (
    <div className="flex items-end justify-center gap-3 px-2 sm:gap-5">
      {SLOTS.map((s) => {
        const r = byRank.get(s.rank)
        if (!r) return null
        return (
          <div key={s.rank} className={clsx('flex w-[5.5rem] flex-col items-center sm:w-28', s.order)}>
            <div className={clsx('mb-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-panel text-sm font-bold text-fg ring-2', s.ring)}>
              {initials(r.name)}
            </div>
            <p className="mb-0.5 w-full truncate text-center text-xs font-medium text-fg">{r.name}</p>
            <p className={clsx('text-sm font-bold tabular-nums', pctTone(r.avgCompliancePct))}>{r.avgCompliancePct}%</p>
            <div className={clsx('mt-1.5 flex w-full justify-center rounded-t-lg bg-inset pt-1.5', s.bar)}>
              <span className={clsx('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', s.badge)}>{s.rank}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
