import { useEffect } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useFleet } from '../../state/useFleetData'
import { useNow } from '../../state/useNow'
import StatusBadge from '../common/StatusBadge'
import Avatar from '../common/Avatar'
import { RiderDetailBody, RiderDetailActions } from './RiderDetailContent'
import RiderSheet from './RiderSheet'
import { pushBackHandler } from '../../native/backStack'

export default function RiderDetailDrawer() {
  const { selectedRiderId, clearSelection } = useApp()
  const { riders, deliveries } = useFleet()
  const now = useNow(1000)
  const rider = riders.find((r) => r.id === selectedRiderId)
  const open = Boolean(selectedRiderId)
  const delivery = rider?.currentDelivery
    ? deliveries.find((d) => d.id === rider.currentDelivery.id)
    : null

  // El botón atrás (Android) cierra el panel — solo registra aquí en escritorio;
  // en móvil el back lo gestiona RiderSheet (snaps).
  useEffect(() => {
    if (!open) return undefined
    if (window.matchMedia('(max-width: 767px)').matches) return undefined
    return pushBackHandler(() => {
      clearSelection()
      return true
    })
  }, [open, clearSelection])

  return (
    <>
      {/* Móvil: hoja inferior arrastrable con snap points. */}
      <RiderSheet rider={rider} delivery={delivery} now={now} open={open} onClose={clearSelection} />

      {/* Escritorio: drawer lateral derecho. */}
      <div className="hidden md:block">
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={clearSelection}
          />
        )}
        <aside
          className={clsx(
            'fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l border-line bg-panel shadow-elev-3 transition-transform duration-300 ease-out',
            open ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          {rider && (
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between border-b border-line p-4 pt-[max(1rem,var(--sat,env(safe-area-inset-top)))]">
                <div className="flex items-center gap-3">
                  <Avatar name={rider.name} size="md" />
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-fg">{rider.name}</h2>
                    <div className="mt-1.5">
                      <StatusBadge status={rider.status} size="sm" />
                    </div>
                  </div>
                </div>
                <button
                  onClick={clearSelection}
                  className="tappable rounded-full p-1.5 text-muted transition hover:bg-inset hover:text-fg"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <RiderDetailBody rider={rider} delivery={delivery} now={now} />
              </div>

              <div className="border-t border-line p-4 pb-[max(1rem,var(--sab,env(safe-area-inset-bottom)))]">
                <RiderDetailActions rider={rider} />
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}
