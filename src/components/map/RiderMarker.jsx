import { useMemo } from 'react'
import L from 'leaflet'
import { Marker, Popup } from 'react-leaflet'
import { STATUS } from '../../config/constants'
import { useWhatsApp } from '../../state/whatsapp'
import { waLink, buildMessage } from '../../utils/whatsapp'
import WhatsAppIcon from '../common/WhatsAppIcon'

function buildIcon(status, active, selected, missingShift) {
  const s = STATUS[status] ?? STATUS.offline
  const cls = ['rider-marker', active ? 'is-active' : '', selected ? 'is-selected' : '', missingShift ? 'is-missing-shift' : '']
    .filter(Boolean)
    .join(' ')
  return L.divIcon({
    className: 'rider-marker-wrap',
    html: `<div class="${cls}" style="color:${missingShift ? '#ef4444' : s.hex}"><span class="ring"></span><span class="dot"></span></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

export default function RiderMarker({ rider, selected, onSelect, shiftInfo }) {
  const { settings, logSent } = useWhatsApp()
  const s = STATUS[rider.status] ?? STATUS.offline
  const active = rider.status === 'en_ruta' || rider.status === 'en_entrega'
  const missingShift = !!shiftInfo && rider.status === 'offline'
  const icon = useMemo(() => buildIcon(rider.status, active, selected, missingShift), [rider.status, active, selected, missingShift])

  if (!rider.location) return null

  const waMsg = buildMessage(settings.contactMessage, rider)

  return (
    <Marker
      position={[rider.location.lat, rider.location.lng]}
      icon={icon}
      zIndexOffset={selected ? 1000 : active ? 200 : 0}
      eventHandlers={{ click: () => onSelect(rider.id) }}
    >
      <Popup>
        <div className="min-w-[180px]">
          <p className="text-sm font-semibold text-fg">{rider.name}</p>
          <p className="text-xs" style={{ color: s.hex }}>
            {s.label} · <span className="text-muted">{rider.vehicleType}</span>
          </p>
          {rider.currentDelivery && (
            <p className="mt-1.5 text-xs text-muted">
              → {rider.currentDelivery.dropoffAddress || 'Viaje en curso'}
            </p>
          )}
          {shiftInfo && rider.status === 'offline' && (
            <p className="mt-1.5 rounded bg-red-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">
              ⚠ Turno {shiftInfo.inicio}–{shiftInfo.fin} · No conectado
            </p>
          )}
          {shiftInfo && rider.status !== 'offline' && (
            <p className="mt-1.5 text-[11px] text-emerald-600">
              ✓ En turno {shiftInfo.inicio}–{shiftInfo.fin}
            </p>
          )}
          {rider.zone && (
            <p className="mt-1 text-[11px] text-faint">
              {rider.zone.label}
              {rider.provider ? ` · ${rider.provider === 'glovo' ? 'Glovo' : 'Uber'}` : ''}
            </p>
          )}
          {rider.phone ? (
            <a
              href={waLink(rider.phone, waMsg)}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                logSent({
                  riderId: rider.id,
                  riderName: rider.name,
                  phone: rider.phone,
                  message: waMsg,
                  status: 'abierto',
                  channel: 'wa.me',
                })
              }
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[#25D366] px-2.5 py-1 text-xs font-semibold !text-white no-underline visited:!text-white hover:!text-white"
            >
              <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
            </a>
          ) : (
            <p className="mt-2 text-[11px] text-faint">Sin teléfono asignado</p>
          )}
        </div>
      </Popup>
    </Marker>
  )
}
