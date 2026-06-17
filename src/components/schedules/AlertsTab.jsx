import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { CheckCheck } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import EmptyState from '../common/EmptyState'
import Segmented from './Segmented'
import { ALERT_META } from './statusMeta'

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'critical', label: 'Críticos' },
  { id: 'warning', label: 'Avisos' },
]

function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Avisos derivados del cruce turnos × actividad (sin persistencia): ausencias, jornadas
// parciales, aceptación baja y cancelaciones altas.
export default function AlertsTab() {
  const { alerts, loading } = useSchedules()
  const [filter, setFilter] = useState('all')

  const list = useMemo(
    () => (filter === 'all' ? alerts : alerts.filter((a) => a.severity === filter)),
    [alerts, filter],
  )
  const counts = useMemo(
    () => ({ critical: alerts.filter((a) => a.severity === 'critical').length, warning: alerts.filter((a) => a.severity === 'warning').length }),
    [alerts],
  )

  if (loading) return <div className="py-10 text-center text-sm text-muted">Cargando…</div>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-1 font-semibold text-red-600 dark:text-red-400">{counts.critical} críticos</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-1 font-semibold text-amber-600 dark:text-amber-400">{counts.warning} avisos</span>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={CheckCheck} title="Sin incidencias" hint="Cuando un rider falte, no complete su turno o baje su aceptación, aparecerá aquí." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-elev-1">
          <div className="divide-y divide-line">
            {list.slice(0, 300).map((a) => {
              const meta = ALERT_META[a.type] || ALERT_META.parcial
              const Icon = meta.Icon
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.chip)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">
                      <span className="font-medium">{a.name}</span> · {meta.label}
                    </p>
                    <p className="text-[11px] text-faint">{fmtDate(a.date)}</p>
                  </div>
                  {a.severity === 'critical' && <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">crítico</span>}
                </div>
              )
            })}
          </div>
          {list.length > 300 && <p className="border-t border-line px-4 py-2 text-center text-[11px] text-faint">Mostrando 300 de {list.length} incidencias. Afina con los filtros o el rango.</p>}
        </div>
      )}
    </div>
  )
}
