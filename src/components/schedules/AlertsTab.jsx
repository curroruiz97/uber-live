import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Bell, Check, CheckCheck, UserX, Clock, LogOut, Hourglass } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import { ALERT_TYPE } from '../../domain/compliance'
import EmptyState from '../common/EmptyState'

const TYPE_META = {
  ausencia: { Icon: UserX, cls: 'text-red-600 dark:text-red-400 bg-red-500/10' },
  tarde: { Icon: Clock, cls: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
  salida_anticipada: { Icon: LogOut, cls: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
  jornada_incompleta: { Icon: Hourglass, cls: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
}

function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function AlertsTab() {
  const { alerts, roster, acknowledgeAlert, loading } = useSchedules()
  const [showSeen, setShowSeen] = useState(false)

  const nameByKey = useMemo(() => {
    const m = new Map()
    for (const r of roster) m.set(r.riderKey, r.name)
    return m
  }, [roster])

  const list = useMemo(() => {
    const arr = alerts
      .filter((a) => showSeen || !a.acknowledged)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    return arr
  }, [alerts, showSeen])

  if (loading) return <div className="py-10 text-center text-sm text-muted">Cargando…</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={showSeen} onChange={(e) => setShowSeen(e.target.checked)} className="h-3.5 w-3.5 accent-accent" />
          Mostrar también los vistos
        </label>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={CheckCheck} title="Sin avisos pendientes" hint="Cuando un rider falte, llegue tarde o no complete su turno, aparecerá aquí." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-elev-1">
          <div className="divide-y divide-line">
            {list.map((a) => {
              const meta = TYPE_META[a.type] || TYPE_META.tarde
              const Icon = meta.Icon
              const name = a.name || nameByKey.get(a.riderKey) || a.riderKey
              const label = ALERT_TYPE[a.type]?.label ?? a.type
              return (
                <div key={a.id} className={clsx('flex items-center gap-3 px-4 py-3', a.acknowledged && 'opacity-55')}>
                  <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.cls)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">
                      <span className="font-medium">{name}</span> · {label}
                    </p>
                    <p className="text-[11px] text-faint">{fmtDate(a.date)}</p>
                  </div>
                  {!a.acknowledged ? (
                    <button
                      onClick={() => acknowledgeAlert(a.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-inset hover:text-fg"
                    >
                      <Check className="h-3.5 w-3.5" /> Visto
                    </button>
                  ) : (
                    <span className="shrink-0 text-[11px] text-faint">visto</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
