import clsx from 'clsx'
import { Car, Bike, Layers } from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { selection } from '../../native/haptics'

// Conmutador de proveedor de flota para el mapa: Uber | Glovo | Todos.
// Mismo lenguaje visual que MessagesSegmented (grid bg-inset, activo bg-panel).
// Cambiar de pestaña recarga toda la vista de flota (mapa + KPIs + tabla + feed).
const TABS = [
  { id: 'uber', label: 'Uber', Icon: Car },
  { id: 'glovo', label: 'Glovo', Icon: Bike },
  { id: 'all', label: 'Todos', Icon: Layers },
]

export default function FleetProviderSegmented() {
  const { activeProvider, setActiveProvider } = useApp()

  return (
    <div className="inline-grid grid-cols-3 gap-1 rounded-xl bg-inset p-1">
      {TABS.map(({ id, label, Icon }) => {
        const on = activeProvider === id
        return (
          <button
            key={id}
            onClick={() => {
              if (id !== activeProvider) {
                selection()
                setActiveProvider(id)
              }
            }}
            aria-pressed={on}
            className={clsx(
              'flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
              on ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
