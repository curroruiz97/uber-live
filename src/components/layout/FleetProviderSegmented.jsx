import clsx from 'clsx'
import { Car, Bike, Layers, AlertTriangle } from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useFleet } from '../../state/useFleetData'
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
  const { activeProvider, setActiveProvider, demoMode } = useApp()
  const { error, riders, loading } = useFleet()

  // Aviso si el proveedor activo no está conectado (modo real, sin credenciales aún).
  // En demo nunca falla. En "Todos" no avisamos (una fuente puede faltar sin romper).
  const showNotice =
    !demoMode && !loading && activeProvider !== 'all' && Boolean(error) && riders.length === 0

  return (
    <div className="space-y-2">
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

      {showNotice && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {activeProvider === 'glovo' ? 'Glovo' : 'Uber'} aún no está conectado para esta empresa.
            Ve a <strong>Ajustes → Integraciones / APIs</strong> para configurarlo.
          </span>
        </div>
      )}
    </div>
  )
}
