import clsx from 'clsx'
import { useApp } from '../../state/AppContext'
import { useWhatsApp } from '../../state/whatsapp'
import { useMensatek } from '../../state/mensatek'
import WhatsAppIcon from '../common/WhatsAppIcon'
import MensatekIcon from '../common/MensatekIcon'
import { selection } from '../../native/haptics'

const TABS = [
  { id: 'whatsapp', label: 'WhatsApp', Icon: WhatsAppIcon },
  { id: 'mensatek', label: 'Mensatek', Icon: MensatekIcon },
]

// Conmutador WhatsApp/Mensatek para la pestaña "Mensajes" del tab bar (solo móvil).
// En escritorio cada canal tiene su entrada en el sidebar, así que esto se oculta.
export default function MessagesSegmented() {
  const { activeNav, setActiveNav } = useApp()
  const { messagesToday: waToday } = useWhatsApp()
  const { messagesToday: mkToday } = useMensatek()
  const badges = { whatsapp: waToday, mensatek: mkToday }

  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-inset p-1 md:hidden">
      {TABS.map(({ id, label, Icon }) => {
        const on = activeNav === id
        const badge = badges[id] || 0
        return (
          <button
            key={id}
            onClick={() => {
              if (id !== activeNav) {
                selection()
                setActiveNav(id)
              }
            }}
            className={clsx(
              'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
              on ? 'bg-panel text-fg shadow-sm' : 'text-muted',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {badge > 0 && (
              <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-accent">
                {badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
