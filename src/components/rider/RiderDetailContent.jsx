import clsx from 'clsx'
import { Phone, MapPin, Package, Clock, Bike, Hash, Mail, Route } from 'lucide-react'
import MiniRouteMap from '../map/MiniRouteMap'
import { formatRouteTime, formatRelative } from '../../utils/time'
import { impactMedium } from '../../native/haptics'

// Contenido del detalle de rider, compartido por el drawer de escritorio y la hoja
// inferior arrastrable de móvil. Solo presentación: no toca datos ni lógica.

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

// Bloque con entrada escalonada (stagger) al abrir.
function Block({ i, className, children }) {
  return (
    <div className={clsx('animate-rise-in', className)} style={{ animationDelay: `${i * 45}ms` }}>
      {children}
    </div>
  )
}

export function RiderDetailBody({ rider, delivery, now }) {
  return (
    <>
      <Block i={0}>
        <MiniRouteMap rider={rider} pickup={delivery?.pickup} dropoff={delivery?.dropoff} />
      </Block>

      <Block i={1} className="space-y-3">
        <InfoRow icon={Bike} label="Vehículo" value={rider.vehicleType ?? '—'} />
        {rider.licensePlate && <InfoRow icon={Hash} label="Matrícula" value={rider.licensePlate} mono />}
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
      </Block>

      {rider.currentDelivery && (
        <Block i={2}>
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
        </Block>
      )}

      {rider.location && (
        <Block i={3}>
          <div className="font-mono text-xs text-faint">
            Posición {rider.location.lat.toFixed(5)}, {rider.location.lng.toFixed(5)}
            {rider.approxLocation ? ' · aprox. por región' : ''}
          </div>
        </Block>
      )}
    </>
  )
}

export function RiderDetailActions({ rider }) {
  if (!rider.phone && !rider.email) return null
  return (
    <div className="flex gap-2">
      {rider.phone && (
        <a
          href={`tel:${rider.phone.replace(/\s/g, '')}`}
          onClick={() => impactMedium()}
          className="tappable flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-elev-1 transition hover:opacity-90"
        >
          <Phone className="h-4 w-4" /> Llamar
        </a>
      )}
      {rider.email && (
        <a
          href={`mailto:${rider.email}`}
          onClick={() => impactMedium()}
          className="tappable flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-inset py-3 text-sm font-medium text-fg transition hover:border-line-strong"
        >
          <Mail className="h-4 w-4" /> Escribir Mail
        </a>
      )}
    </div>
  )
}
