import clsx from 'clsx'
import { Layers, AlertTriangle } from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useFleet } from '../../state/useFleetData'
import { selection } from '../../native/haptics'
import UberIcon from '../common/UberIcon'
import GlovoIcon from '../common/GlovoIcon'

// Conmutador de proveedor de flota para el mapa: Uber | Glovo | Todos.
// Ancho completo (3 columnas iguales), con los logos de marca para un look pro.
// Cambiar de pestaña recarga toda la vista de flota (mapa + KPIs + tabla + feed).
function AllLogo() {
  return (
    <span className="flex items-center -space-x-1.5">
      <UberIcon className="h-5 w-5 rounded-md ring-1 ring-panel" />
      <GlovoIcon className="h-5 w-5 rounded-md ring-1 ring-panel" />
    </span>
  )
}

const TABS = [
  { id: 'uber', label: 'Uber', renderLogo: () => <UberIcon className="h-5 w-5" /> },
  { id: 'glovo', label: 'Glovo', renderLogo: () => <GlovoIcon className="h-5 w-5" /> },
  { id: 'all', label: 'Todos', renderLogo: () => <AllLogo /> },
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
      <div className="grid w-full grid-cols-3 gap-1.5 rounded-xl bg-inset p-1.5">
        {TABS.map(({ id, label, renderLogo }) => {
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
                'flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition',
                on
                  ? 'bg-panel text-fg shadow-sm ring-1 ring-line'
                  : 'text-muted hover:bg-panel/50 hover:text-fg',
              )}
            >
              {renderLogo()}
              <span>{label}</span>
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
