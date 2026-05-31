import { useEffect } from 'react'
import clsx from 'clsx'
import { X, Phone, MapPin, Package, Clock, Bike, Hash, Mail, Route } from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useFleet } from '../../state/useFleetData'
import { useNow } from '../../state/useNow'
import StatusBadge from '../common/StatusBadge'
import MiniRouteMap from '../map/MiniRouteMap'
import { formatRouteTime, formatRelative } from '../../utils/time'
import { pushBackHandler } from '../../native/backStack'

function InfoRow({ icon: Icon, label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex shrink-0 items-center gap-2 text-sm text-muted">
        <Icon className="h-4 w-4 text-faint" />
        {label}
      </span>
      <span
        className={clsx('max-w-[58%] truncate text-right text-sm text-fg', mono && 'font-mono tabular-nums')}
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </span>
    </div>
  )
}

export default function RiderDetailDrawer() {
  const { selectedRiderId, clearSelection } = useApp()
  const { riders, deliveries } = useFleet()
  const now = useNow(1000)
  const rider = riders.find((r) => r.id === selectedRiderId)
  const open = Boolean(selectedRiderId)
  const delivery = rider?.currentDelivery
    ? deliveries.find((d) => d.id === rider.currentDelivery.id)
    : null

  // El botón atrás (Android) cierra el panel del rider antes que navegar.
  useEffect(() => {
    if (!open) return undefined
    return pushBackHandler(() => {
      clearSelection()
      return true
    })
  }, [open, clearSelection])

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={clearSelection} />
      )}
      <aside
        className={clsx(
          'fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l border-line bg-panel shadow-2xl transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {rider && (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between border-b border-line p-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <div>
                <h2 className="text-base font-semibold text-fg">{rider.name}</h2>
                <div className="mt-1.5">
                  <StatusBadge status={rider.status} size="sm" />
                </div>
              </div>
              <button
                onClick={clearSelection}
                className="rounded-lg p-1.5 text-muted transition hover:bg-inset hover:text-fg"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <MiniRouteMap rider={rider} pickup={delivery?.pickup} dropoff={delivery?.dropoff} />

              <div className="space-y-3">
                <InfoRow icon={Bike} label="Vehículo" value={rider.vehicleType ?? '—'} />
                {rider.licensePlate && (
                  <InfoRow icon={Hash} label="Matrícula" value={rider.licensePlate} mono />
                )}
                {typeof rider.tripsToday === 'number' && (
                  <InfoRow icon={Route} label="Viajes hoy" value={String(rider.tripsToday)} />
                )}
                <InfoRow icon={MapPin} label="Región" value={rider.zone?.label ?? '—'} />
                {rider.routeStartedAt && (
                  <InfoRow icon={Clock} label="Tiempo en ruta" value={formatRouteTime(rider.routeStartedAt, now)} mono />
                )}
                <InfoRow icon={Clock} label="Última señal" value={formatRelative(rider.lastSeenAt, now)} />
                {rider.phone && <InfoRow icon={Phone} label="Teléfono" value={rider.phone} mono />}
                {rider.email && <InfoRow icon={Mail} label="Email" value={rider.email} />}
              </div>

              {rider.currentDelivery && (
                <div className="rounded-xl border border-line bg-inset p-3">
                  <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-faint">
                    <Package className="h-3.5 w-3.5" /> Pedido actual
                  </h3>
                  {rider.currentDelivery.dropoffAddress || rider.currentDelivery.pickupName ? (
                    <div className="mt-2 space-y-2 text-sm">
                      {rider.currentDelivery.pickupName && (
                        <div>
                          <span className="text-faint">Recogida: </span>
                          <span className="text-fg">{rider.currentDelivery.pickupName}</span>
                        </div>
                      )}
                      {rider.currentDelivery.dropoffAddress && (
                        <div>
                          <span className="text-faint">Entrega: </span>
                          <span className="text-fg">{rider.currentDelivery.dropoffAddress}</span>
                        </div>
                      )}
                      {rider.currentDelivery.etaMin != null && (
                        <div>
                          <span className="text-faint">ETA: </span>
                          <span className="text-fg">{rider.currentDelivery.etaMin} min</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm">
                      <p className="font-medium text-fg">Viaje en curso</p>
                      <p className="mt-0.5 text-xs text-faint">
                        El detalle del pedido (recogida/entrega) no lo expone la API de flotas de Uber.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {rider.location && (
                <div className="font-mono text-xs text-faint">
                  Posición {rider.location.lat.toFixed(5)}, {rider.location.lng.toFixed(5)}
                  {rider.approxLocation ? ' · aprox. por región' : ''}
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {rider.phone && (
                <a
                  href={`tel:${rider.phone.replace(/\s/g, '')}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  <Phone className="h-4 w-4" /> Llamar
                </a>
              )}
              {rider.email && (
                <a
                  href={`mailto:${rider.email}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-line bg-inset py-2.5 text-sm font-medium text-fg transition hover:border-accent/40"
                >
                  <Mail className="h-4 w-4" /> Escribir Mail
                </a>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
