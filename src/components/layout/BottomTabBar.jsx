import clsx from 'clsx'
import { LayoutDashboard, Map as MapIcon, Users, MessageCircle, Settings } from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useWhatsApp } from '../../state/whatsapp'
import { useMensatek } from '../../state/mensatek'
import { selection } from '../../native/haptics'

// La pestaña "Mensajes" agrupa WhatsApp + Mensatek (dentro se cambia con un segmented).
const MESSAGING = ['whatsapp', 'mensatek']

const TABS = [
  { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
  { id: 'mapa', label: 'Mapa', icon: MapIcon },
  { id: 'riders', label: 'Riders', icon: Users },
  { id: 'mensajes', label: 'Mensajes', icon: MessageCircle, target: 'whatsapp' },
  { id: 'config', label: 'Ajustes', icon: Settings },
]

// Barra de pestañas inferior (solo móvil). Navegación nativa-style por rol de pantalla,
// con safe area, badge de mensajes del día y feedback háptico al cambiar.
export default function BottomTabBar() {
  const { activeNav, setActiveNav } = useApp()
  const { messagesToday: waToday } = useWhatsApp()
  const { messagesToday: mkToday } = useMensatek()
  const msgBadge = (waToday || 0) + (mkToday || 0)

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
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const on = isActive(tab)
          const showBadge = tab.id === 'mensajes' && msgBadge > 0
          return (
            <button
              key={tab.id}
              onClick={() => go(tab)}
              aria-current={on ? 'page' : undefined}
              className={clsx(
                'flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-1 pt-1.5 text-[10px] font-medium transition',
                on ? 'text-accent' : 'text-faint active:text-muted',
              )}
            >
              <span className="relative">
                <Icon className={clsx('h-[22px] w-[22px]', on && 'text-accent')} strokeWidth={on ? 2.4 : 2} />
                {showBadge && (
                  <span className="absolute -right-2 -top-1.5 min-w-[16px] rounded-full bg-accent px-1 text-center text-[9px] font-bold leading-4 text-white">
                    {msgBadge > 99 ? '99+' : msgBadge}
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
