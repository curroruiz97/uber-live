import clsx from 'clsx'
import { Map as MapIcon, Users, MessageCircle, Settings, ShieldCheck, CalendarDays, Activity } from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useOrg } from '../../state/OrgContext'
import { useWhatsApp } from '../../state/whatsapp'
import { useMensatek } from '../../state/mensatek'
import { useSchedules } from '../../state/schedules'
import { selection } from '../../native/haptics'
import { VIEWER_NAV } from '../../config/nav'

// La pestaña "Mensajes" agrupa WhatsApp + Mensatek (dentro se cambia con un segmented).
const MESSAGING = ['whatsapp', 'mensatek']

const TABS = [
  { id: 'dashboard', label: 'Mapas', icon: MapIcon },
  { id: 'cumplimiento', label: 'Cumplim.', icon: ShieldCheck },
  { id: 'jornadas', label: 'Jornadas', icon: Activity },
  { id: 'horarios', label: 'Horarios', icon: CalendarDays },
  { id: 'riders', label: 'Riders', icon: Users },
  { id: 'mensajes', label: 'Mensajes', icon: MessageCircle, target: 'whatsapp' },
  { id: 'config', label: 'Ajustes', icon: Settings },
]

// Barra de pestañas inferior (solo móvil). Navegación nativa-style por rol de pantalla,
// con safe area, badge de mensajes del día y feedback háptico al cambiar.
export default function BottomTabBar() {
  const { activeNav, setActiveNav } = useApp()
  const { isViewer } = useOrg()
  const { messagesToday: waToday } = useWhatsApp()
  const { messagesToday: mkToday } = useMensatek()
  const { unseenAlerts } = useSchedules()
  const msgBadge = (waToday || 0) + (mkToday || 0)
  // El visor solo ve las pestañas de lectura ('mensajes'/'horarios' quedan fuera).
  const tabs = isViewer ? TABS.filter((t) => VIEWER_NAV.has(t.id)) : TABS

  function isActive(tab) {
    if (tab.id === 'mensajes') return MESSAGING.includes(activeNav)
    return activeNav === tab.id
  }

  function go(tab) {
    const next = tab.target || tab.id
    // En "Mensajes" respeta la sub-pestaña ya abierta (whatsapp/mensatek).
    const dest = tab.id === 'mensajes' && MESSAGING.includes(activeNav) ? activeNav : next
    if (dest !== activeNav) {
      selection()
      setActiveNav(dest)
    }
  }

  return (
    <nav className="app-tabbar fixed inset-x-0 bottom-0 z-30 border-t border-line bg-app/90 pb-safe backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const on = isActive(tab)
          const badgeCount = tab.id === 'mensajes' ? msgBadge : tab.id === 'cumplimiento' ? unseenAlerts : 0
          const badgeRed = tab.id === 'cumplimiento'
          return (
            <button
              key={tab.id}
              onClick={() => go(tab)}
              aria-current={on ? 'page' : undefined}
              className={clsx(
                'tappable relative flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-0.5 pt-2 text-[10px] font-medium transition-colors duration-200',
                on ? 'text-accent' : 'text-faint',
              )}
            >
              {/* Indicador superior animado de la pestaña activa. */}
              <span
                className={clsx(
                  'absolute left-1/2 top-0 h-0.5 -translate-x-1/2 rounded-full bg-accent transition-all duration-300 ease-spring',
                  on ? 'w-8 opacity-100' : 'w-0 opacity-0',
                )}
              />
              <span className="relative">
                <Icon
                  className={clsx('h-[22px] w-[22px] transition-transform duration-300 ease-spring', on && 'text-accent')}
                  strokeWidth={on ? 2.4 : 2}
                />
                {badgeCount > 0 && (
                  <span
                    className={clsx(
                      'absolute -right-2 -top-1.5 min-w-[16px] animate-pop rounded-full px-1 text-center text-[9px] font-bold leading-4 text-white',
                      badgeRed ? 'bg-red-500' : 'bg-accent',
                    )}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </span>
              <span className="truncate">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
