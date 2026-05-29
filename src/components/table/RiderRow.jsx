import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Eye, Phone } from 'lucide-react'
import StatusBadge from '../common/StatusBadge'
import WhatsAppIcon from '../common/WhatsAppIcon'
import { useWhatsApp } from '../../state/whatsapp'
import { waLink, buildMessage } from '../../utils/whatsapp'
import { formatRouteTime, formatRelative } from '../../utils/time'

export default function RiderRow({ rider, now, selected, onSelect }) {
  const { settings, logSent, selectedIds, toggleSelect } = useWhatsApp()
  const checked = selectedIds.has(rider.id)

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
      onClick={() => onSelect(rider.id)}
      className={clsx(
        'cursor-pointer border-b border-line transition-colors',
        selected ? 'bg-accent/10' : 'hover:bg-inset',
        flash && 'animate-row-flash',
      )}
    >
      <td className="w-9 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => toggleSelect(rider.id)}
          className="h-4 w-4 cursor-pointer accent-orange-500"
          aria-label={`Seleccionar ${rider.name}`}
        />
      </td>

      <td className="whitespace-nowrap px-3 py-2.5">
        <div className="font-medium text-fg">{rider.name}</div>
        <div className="text-xs text-faint">{rider.vehicleType}</div>
      </td>

      <td className="px-3 py-2.5">
        <StatusBadge status={rider.status} size="sm" />
      </td>

      <td className="hidden max-w-[200px] px-3 py-2.5 sm:table-cell">
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

      <td className="hidden whitespace-nowrap px-3 py-2.5 md:table-cell">
        <span className="font-mono text-sm tabular-nums text-muted">
          {rider.routeStartedAt ? formatRouteTime(rider.routeStartedAt, now) : '—'}
        </span>
      </td>

      <td className="hidden whitespace-nowrap px-3 py-2.5 lg:table-cell">
        <div className="text-sm text-muted">{rider.zone?.label ?? '—'}</div>
        <div className="text-xs text-faint">{formatRelative(rider.lastSeenAt, now)}</div>
      </td>

      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSelect(rider.id)
            }}
            className="rounded-md p-1.5 text-muted transition hover:bg-inset hover:text-fg"
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
                logSent({
                  riderId: rider.id,
                  riderName: rider.name,
                  phone: rider.phone,
                  message: waMsg,
                  status: 'abierto',
                  channel: 'wa.me',
                })
              }}
              className="rounded-md p-1.5 text-[#25D366] transition hover:bg-inset hover:opacity-80"
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
            onClick={(e) => e.stopPropagation()}
            className="rounded-md p-1.5 text-muted transition hover:bg-inset hover:text-emerald-500 dark:hover:text-emerald-400"
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
