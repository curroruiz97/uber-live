import clsx from 'clsx'
import {
  Map as MapIcon,
  Users,
  ShieldCheck,
  CalendarDays,
  Activity,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useWhatsApp } from '../../state/whatsapp'
import { useMensatek } from '../../state/mensatek'
import { useSchedules } from '../../state/schedules'
import WhatsAppIcon from '../common/WhatsAppIcon'
import MensatekIcon from '../common/MensatekIcon'
import Logo from '../common/Logo'

const NAV = [
  { id: 'dashboard', label: 'Mapas', icon: MapIcon },
  { id: 'cumplimiento', label: 'Cumplimiento', icon: ShieldCheck },
  { id: 'jornadas', label: 'Jornadas', icon: Activity },
  { id: 'horarios', label: 'Horarios', icon: CalendarDays },
  { id: 'riders', label: 'Riders', icon: Users },
  { id: 'whatsapp', label: 'WhatsApp', icon: WhatsAppIcon },
  { id: 'mensatek', label: 'Mensatek', icon: MensatekIcon },
  { id: 'config', label: 'Ajustes', icon: Settings },
]

export default function Sidebar({ mobileOpen, onCloseMobile }) {
  const { sidebarCollapsed, toggleSidebar, activeNav, setActiveNav } = useApp()
  const { messagesToday: waToday } = useWhatsApp()
  const { messagesToday: mkToday } = useMensatek()
  const { unseenAlerts } = useSchedules()

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-panel transition-all duration-200',
          sidebarCollapsed ? 'md:w-16' : 'md:w-60',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="flex h-14 items-center border-b border-line px-4">
          {sidebarCollapsed ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white shadow-md shadow-accent/30">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
              </span>
            </div>
          ) : (
            <Logo className="h-7 w-auto" />
          )}
        </div>

        <nav className="flex-1 space-y-1 p-2.5">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = activeNav === item.id
            const badge = item.id === 'whatsapp' ? waToday : item.id === 'mensatek' ? mkToday : item.id === 'cumplimiento' ? unseenAlerts : 0
            const badgeAlert = item.id === 'cumplimiento'
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveNav(item.id)
                  onCloseMobile?.()
                }}
                title={sidebarCollapsed ? item.label : undefined}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  sidebarCollapsed && 'md:justify-center md:px-0',
                  active
                    ? 'bg-accent/15 text-fg ring-1 ring-accent/30'
                    : 'text-muted hover:bg-inset hover:text-fg',
                )}
              >
                <span className="relative shrink-0">
                  <Icon className={clsx('h-5 w-5', active && 'text-accent')} />
                  {badge > 0 && sidebarCollapsed && (
                    <span className={clsx('absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full ring-2 ring-panel', badgeAlert ? 'bg-red-500' : 'bg-[#25D366]')} />
                  )}
                </span>
                {!sidebarCollapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                {!sidebarCollapsed && badge > 0 && (
                  <span className={clsx('rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums', badgeAlert ? 'bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-[#25D366]/15 text-[#25D366]')}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="hidden border-t border-line p-2.5 md:block">
          <button
            onClick={toggleSidebar}
            className={clsx(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-faint transition hover:bg-inset hover:text-fg',
              sidebarCollapsed && 'justify-center px-0',
            )}
          >
            {sidebarCollapsed ? (
              <ChevronsRight className="h-5 w-5" />
            ) : (
              <>
                <ChevronsLeft className="h-5 w-5" />
                <span>Colapsar</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
