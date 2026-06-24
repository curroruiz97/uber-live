import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Eye, Phone, AlertCircle } from 'lucide-react'
import StatusBadge from '../common/StatusBadge'
import Avatar from '../common/Avatar'
import WhatsAppIcon from '../common/WhatsAppIcon'
import { useApp } from '../../state/AppContext'
import { useWhatsApp } from '../../state/whatsapp'
import { waLink, buildMessage } from '../../utils/whatsapp'
import { formatRouteTime, formatRelative } from '../../utils/time'
import { impactLight, selection } from '../../native/haptics'

export default function RiderRow({ rider, now, selected, onSelect, index = 0, shiftInfo }) {
  const { activeProvider } = useApp()
  const { settings, logSent, selectedIds, toggleSelect } = useWhatsApp()
  const checked = selectedIds.has(rider.id)
  // En la vista combinada ("Todos") mostramos de qué proveedor es cada rider.
  const showProvider = activeProvider === 'all' && rider.provider

  const sig = `${rider.status}|${rider.currentDelivery?.id ?? ''}`
  const prevSig = useRef(sig)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (prevSig.current !== sig) {
      prevSig.current = sig
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 1400)
      return () => clearTimeout(t)
    }
    return undefined
  }, [sig])

  const waMsg = buildMessage(settings.contactMessage, rider)

  return (
    <tr
      onClick={() => {
        selection()
        onSelect(rider.id)
      }}
      className={clsx(
        'cursor-pointer border-b border-line transition-colors active:bg-inset',
        // Stagger de entrada solo en las primeras filas (mola, no marea).
        index < 8 && 'animate-rise-in',
        selected ? 'bg-accent/10' : 'hover:bg-inset',
        flash && 'animate-row-flash',
      )}
      style={index < 8 ? { animationDelay: `${index * 28}ms` } : undefined}
    >
      <td className="w-9 px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => toggleSelect(rider.id)}
          className="h-4 w-4 cursor-pointer accent-accent"
          aria-label={`Seleccionar ${rider.name}`}
        />
      </td>

      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Avatar name={rider.name} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate text-sm font-medium text-fg">
              {rider.name}
              {shiftInfo && rider.status === 'offline' && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400" title={`Turno ${shiftInfo.inicio}–${shiftInfo.fin}`}>
                  <AlertCircle className="h-2.5 w-2.5" /> Turno
                </span>
              )}
              {shiftInfo && rider.status !== 'offline' && (
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400" title={`Turno ${shiftInfo.inicio}–${shiftInfo.fin}`}>
                  En turno
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <StatusBadge status={rider.status} size="sm" />
              <span className="text-[11px] text-faint">{rider.vehicleType}</span>
              {showProvider && (
                <span className="rounded-full bg-inset px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                  {rider.provider === 'glovo' ? 'Glovo' : 'Uber'}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      <td className="hidden px-3 py-2 sm:table-cell">
        <StatusBadge status={rider.status} size="sm" />
      </td>

      <td className="hidden max-w-[200px] px-3 py-2 sm:table-cell">
        {rider.currentDelivery ? (
          <div
            className="truncate text-sm text-muted"
            title={rider.currentDelivery.dropoffAddress || 'Viaje en curso'}
          >
            <span className="text-faint">→ </span>
            {rider.currentDelivery.dropoffAddress || 'Viaje en curso'}
          </div>
        ) : (
          <span className="text-sm text-faint">—</span>
        )}
      </td>

      <td className="hidden whitespace-nowrap px-3 py-2 md:table-cell">
        <span className="font-mono text-sm tabular-nums text-muted">
          {rider.routeStartedAt ? formatRouteTime(rider.routeStartedAt, now) : '—'}
        </span>
      </td>

      <td className="hidden whitespace-nowrap px-3 py-2 lg:table-cell">
        <div className="text-sm text-muted">{rider.zone?.label ?? '—'}</div>
        <div className="text-xs text-faint">{formatRelative(rider.lastSeenAt, now)}</div>
      </td>

      <td className="whitespace-nowrap px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              selection()
              onSelect(rider.id)
            }}
            className="tappable rounded-lg p-1.5 text-muted transition hover:bg-inset hover:text-fg"
            title="Ver detalle"
            aria-label="Ver detalle"
          >
            <Eye className="h-4 w-4" />
          </button>

          {rider.phone ? (
            <a
              href={waLink(rider.phone, waMsg)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                e.stopPropagation()
                impactLight()
                logSent({
                  riderId: rider.id,
                  riderName: rider.name,
                  phone: rider.phone,
                  message: waMsg,
                  status: 'abierto',
                  channel: 'wa.me',
                })
              }}
              className="tappable rounded-lg p-1.5 text-[#25D366] transition hover:bg-inset hover:opacity-80"
              title={`WhatsApp · ${rider.phone}`}
              aria-label="WhatsApp"
            >
              <WhatsAppIcon className="h-4 w-4" />
            </a>
          ) : (
            <span
              className="cursor-not-allowed rounded-md p-1.5 text-faint/40"
              title="Sin teléfono asignado"
            >
              <WhatsAppIcon className="h-4 w-4" />
            </span>
          )}

          <a
            href={`tel:${(rider.phone ?? '').replace(/\s/g, '')}`}
            onClick={(e) => {
              e.stopPropagation()
              impactLight()
            }}
            className="tappable rounded-lg p-1.5 text-muted transition hover:bg-inset hover:text-green-500 dark:hover:text-green-400"
            title={`Llamar · ${rider.phone ?? ''}`}
            aria-label="Llamar"
          >
            <Phone className="h-4 w-4" />
          </a>
        </div>
      </td>
    </tr>
  )
}
