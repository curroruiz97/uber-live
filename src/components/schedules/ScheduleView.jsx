import { useState } from 'react'
import clsx from 'clsx'
import { LayoutDashboard, CalendarClock, History, Bell } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import { selection } from '../../native/haptics'
import SummaryTab from './SummaryTab'
import SchedulesTab from './SchedulesTab'
import HistoryTab from './HistoryTab'
import AlertsTab from './AlertsTab'

const TABS = [
  { id: 'resumen', label: 'Resumen', Icon: LayoutDashboard },
  { id: 'horarios', label: 'Horarios', Icon: CalendarClock },
  { id: 'historial', label: 'Historial', Icon: History },
  { id: 'avisos', label: 'Avisos', Icon: Bell },
]

export default function ScheduleView() {
  const [tab, setTab] = useState('resumen')
  const { unseenAlerts } = useSchedules()

  return (
    <div className="space-y-4">
      <div className="grid w-full grid-cols-4 gap-1.5 rounded-xl bg-inset p-1.5">
        {TABS.map(({ id, label, Icon }) => {
          const on = tab === id
          const badge = id === 'avisos' ? unseenAlerts : 0
          return (
            <button
              key={id}
              onClick={() => {
                if (id !== tab) {
                  selection()
                  setTab(id)
                }
              }}
              aria-pressed={on}
              className={clsx(
                'flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition',
                on ? 'bg-panel text-fg shadow-sm ring-1 ring-line' : 'text-muted hover:text-fg',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              {badge > 0 && (
                <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-red-600 dark:text-red-400">
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'resumen' && <SummaryTab />}
      {tab === 'horarios' && <SchedulesTab />}
      {tab === 'historial' && <HistoryTab />}
      {tab === 'avisos' && <AlertsTab />}
    </div>
  )
}
