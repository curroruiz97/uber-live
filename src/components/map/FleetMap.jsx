import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { Maximize2, Minimize2 } from 'lucide-react'
import {
  MAP_TILES,
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  STATUS,
  STATUS_ORDER,
} from '../../config/constants'
import { useApp, filterRiders } from '../../state/AppContext'
import { useFleet } from '../../state/useFleetData'
import { useSchedules } from '../../state/schedules'
import { getRidersOnShiftNow } from '../../domain/compliance'
import { digits } from '../../utils/glovoDaily'
import { useTheme } from '../../state/ThemeContext'
import { impactLight } from '../../native/haptics'
import RiderMarker from './RiderMarker'

function FitBounds({ riders }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    const pts = riders.filter((r) => r.location).map((r) => [r.location.lat, r.location.lng])
    if (pts.length) {
      map.fitBounds(pts, { padding: [48, 48], maxZoom: 13 })
      done.current = true
    }
  }, [riders, map])
  return null
}

function FlyToSelected({ riders, selectedId }) {
  const map = useMap()
  useEffect(() => {
    if (!selectedId) return
    const r = riders.find((x) => x.id === selectedId)
    if (r?.location) {
      map.flyTo([r.location.lat, r.location.lng], Math.max(map.getZoom(), 14), { duration: 0.8 })
    }
  }, [selectedId, riders, map])
  return null
}

// Recalcula el tamaño del mapa cuando cambia el contenedor (p.ej. al entrar/salir de fullscreen).
function InvalidateSize({ trigger }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 220)
    return () => clearTimeout(t)
  }, [trigger, map])
  return null
}

function MapLegend({ fullscreen }) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-col gap-1 rounded-xl border border-line-strong bg-elevated/80 px-2.5 py-2 text-[11px] shadow-elev-2 backdrop-blur-xl" style={fullscreen ? { bottom: 'calc(var(--sab, env(safe-area-inset-bottom)) + 0.75rem)', left: 'calc(var(--sal, env(safe-area-inset-left)) + 0.75rem)' } : undefined}>
      {STATUS_ORDER.map((id) => {
        const s = STATUS[id]
        return (
          <div key={id} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.hex }} />
            <span className="text-muted">{s.label}</span>
          </div>
        )
      })}
      <div className="mt-0.5 flex items-center gap-1.5 border-t border-line-strong pt-1">
        <span className="h-2 w-2 rounded-full" style={{ background: '#ef4444' }} />
        <span className="text-muted">Debería estar conectado</span>
      </div>
    </div>
  )
}

export default function FleetMap({ height = 'h-[360px] md:h-[440px]' }) {
  const { filters, selectedRiderId, selectRider } = useApp()
  const { riders } = useFleet()
  const schedules = useSchedules()
  const shiftPlans = schedules?.shiftPlans || []
  const { resolved } = useTheme()
  const [fullscreen, setFullscreen] = useState(false)
  const visible = useMemo(() => filterRiders(riders, filters), [riders, filters])

  const shiftByPhone = useMemo(() => {
    if (!shiftPlans?.length) return new Map()
    const onShift = getRidersOnShiftNow(shiftPlans, new Date())
    const map = new Map()
    for (const s of onShift) map.set(s.riderKey, s)
    return map
  }, [shiftPlans])

  useEffect(() => {
    if (!fullscreen) return undefined
    function onKey(e) {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [fullscreen])

  return (
    <div
      className={clsx(
        // `isolate` contiene los z-index internos de Leaflet para que no tapen overlays (palette, drawer…)
        'isolate overflow-hidden border-line shadow-soft',
        fullscreen
          ? 'fixed inset-0 z-[60] rounded-none border-0'
          : `relative ${height} rounded-2xl border shadow-elev-1`,
      )}
    >
      <MapContainer
        center={MAP_DEFAULT_CENTER}
        zoom={MAP_DEFAULT_ZOOM}
        className="h-full w-full"
        zoomControl
        attributionControl
      >
        <TileLayer
          key={resolved}
          url={resolved === 'light' ? MAP_TILES.light : MAP_TILES.dark}
          attribution={MAP_TILES.attribution}
          maxZoom={MAP_TILES.maxZoom}
          subdomains="abcd"
        />
        <FitBounds riders={riders} />
        <FlyToSelected riders={riders} selectedId={selectedRiderId} />
        <InvalidateSize trigger={fullscreen} />
        {visible.map((r) => (
          <RiderMarker
            key={r.id}
            rider={r}
            selected={r.id === selectedRiderId}
            onSelect={selectRider}
            shiftInfo={r.phone && shiftByPhone.size ? shiftByPhone.get(digits(String(r.phone))) : null}
          />
        ))}
      </MapContainer>

      <MapLegend fullscreen={fullscreen} />

      <div className="pointer-events-none absolute right-3 top-3 z-[500] flex items-center gap-2" style={fullscreen ? { top: 'calc(var(--sat, env(safe-area-inset-top)) + 0.75rem)', right: 'calc(var(--sar, env(safe-area-inset-right)) + 0.75rem)' } : undefined}>
        <span className="rounded-full border border-line-strong bg-elevated/80 px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted shadow-elev-2 backdrop-blur-xl">
          {visible.length} riders visibles
        </span>
        <button
          onClick={() => {
            impactLight()
            setFullscreen((f) => !f)
          }}
          title={fullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
          aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          className="tappable pointer-events-auto rounded-xl border border-line-strong bg-elevated/80 p-2 text-muted shadow-elev-2 backdrop-blur-xl transition hover:text-fg"
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
