import { Activity } from 'lucide-react'
import { useFleet } from '../../state/useFleetData'
import { useNow } from '../../state/useNow'
import { EVENT_TYPES } from '../../config/constants'
import { formatRelative, formatClock } from '../../utils/time'
import EmptyState from '../common/EmptyState'

export default function ActivityFeed() {
  const { events } = useFleet()
  const now = useNow(1000)

  return (
    <div className="flex max-h-[480px] flex-col rounded-2xl border border-line bg-panel shadow-elev-1 xl:sticky xl:top-[72px] xl:max-h-[calc(100vh-92px)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Activity className="h-4 w-4 text-accent" /> Actividad
        </h2>
        <span className="text-xs text-faint">{events.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {events.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Sin eventos todavía"
            hint="Las asignaciones, entregas y cancelaciones aparecerán aquí en tiempo real."
          />
        ) : (
          <ul className="space-y-0.5">
            {events.map((e) => {
              const t = EVENT_TYPES[e.type] ?? EVENT_TYPES.assignment
              return (
                <li
                  key={e.id}
                  className="flex animate-fade-in gap-3 rounded-lg px-2 py-2 transition hover:bg-inset"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-fg">{e.message}</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
                      <span className={t.text}>{t.label}</span>
                      <span>·</span>
                      <span>{formatRelative(e.ts, now)}</span>
                      <span>{formatClock(e.ts)}</span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
