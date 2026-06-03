import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { LayoutDashboard, Users, Trophy, CalendarClock, History, Bell, ShieldCheck } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import { selection } from '../../native/haptics'
import SummaryTab from './SummaryTab'
import RidersTab from './RidersTab'
import RankingTab from './RankingTab'
import SchedulesTab from './SchedulesTab'
import HistoryTab from './HistoryTab'
import AlertsTab from './AlertsTab'

const TABS = [
  { id: 'resumen', label: 'Resumen', Icon: LayoutDashboard },
  { id: 'riders', label: 'Riders', Icon: Users },
  { id: 'ranking', label: 'Ranking', Icon: Trophy },
  { id: 'horarios', label: 'Horarios', Icon: CalendarClock },
  { id: 'historial', label: 'Historial', Icon: History },
  { id: 'avisos', label: 'Avisos', Icon: Bell },
]

export default function ScheduleView() {
  const [tab, setTab] = useState('resumen')
  const { roster, schedules, daily, unseenAlerts } = useSchedules()

  const pills = useMemo(
    () => [
      { label: 'riders', value: roster.length },
      { label: 'turnos planificados', value: schedules.length },
      { label: 'jornadas medidas', value: daily.length },
    ],
    [roster, schedules, daily],
  )

  return (
    <div className="space-y-4">
      {/* Cabecera de la sección */}
      <div className="overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-accent/10 via-panel to-panel p-4 shadow-elev-1 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-fg">Cumplimiento de Riders</h2>
              <p className="text-xs text-muted">Asistencia, puntualidad y horas reales frente a los turnos planificados.</p>
            </div>
          </div>
          {unseenAlerts > 0 && (
            <button
              onClick={() => {
                selection()
                setTab('avisos')
              }}
              className="hidden shrink-0 items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-500/15 dark:text-red-400 sm:inline-flex"
            >
              <Bell className="h-3.5 w-3.5" /> {unseenAlerts} sin ver
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {pills.map((p) => (
            <span key={p.label} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel/60 px-2.5 py-1 text-[11px] text-muted">
              <span className="font-semibold tabular-nums text-fg">{p.value}</span> {p.label}
            </span>
          ))}
        </div>
      </div>

      {/* Sub-pestañas (scroll horizontal en móvil) */}
      <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
        <div className="flex min-w-max gap-1.5 rounded-xl bg-inset p-1.5">
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
                  'flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition',
                  on ? 'bg-panel text-fg shadow-sm ring-1 ring-line' : 'text-muted hover:text-fg',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
                {badge > 0 && (
                  <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-red-600 dark:text-red-400">{badge}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'resumen' && <SummaryTab />}
      {tab === 'riders' && <RidersTab />}
      {tab === 'ranking' && <RankingTab />}
      {tab === 'horarios' && <SchedulesTab />}
      {tab === 'historial' && <HistoryTab />}
      {tab === 'avisos' && <AlertsTab />}
    </div>
  )
}
