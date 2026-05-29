import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import { MAP_TILES } from '../../config/constants'
import { useTheme } from '../../state/ThemeContext'

function dotIcon(color) {
  return L.divIcon({
    className: 'rider-marker-wrap',
    html: `<div class="rider-marker"><span class="dot" style="color:${color}"></span></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function Fit({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length) map.fitBounds(points, { padding: [26, 26], maxZoom: 15 })
  }, [points, map])
  return null
}

const hasCoords = (p) => p && typeof p.lat === 'number' && typeof p.lng === 'number'

// Mini-mapa de tracking (estático) para el drawer: rider + recogida + entrega.
export default function MiniRouteMap({ rider, pickup, dropoff }) {
  const { resolved } = useTheme()
  if (!rider?.location) return null

  const riderPt = [rider.location.lat, rider.location.lng]
  const points = [riderPt]
  const line = []
  if (hasCoords(pickup)) {
    points.push([pickup.lat, pickup.lng])
    line.push([pickup.lat, pickup.lng])
  }
  if (hasCoords(dropoff)) {
    points.push([dropoff.lat, dropoff.lng])
    line.push([dropoff.lat, dropoff.lng])
  }

  return (
    <div className="relative isolate h-44 overflow-hidden rounded-xl border border-line">
      <MapContainer
        center={riderPt}
        zoom={13}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        keyboard={false}
      >
        <TileLayer
          key={resolved}
          url={resolved === 'light' ? MAP_TILES.light : MAP_TILES.dark}
          subdomains="abcd"
          maxZoom={MAP_TILES.maxZoom}
        />
        {line.length === 2 && (
          <Polyline positions={line} pathOptions={{ color: '#f97316', weight: 3, opacity: 0.7, dashArray: '4 6' }} />
        )}
        {hasCoords(pickup) && <Marker position={[pickup.lat, pickup.lng]} icon={dotIcon('#0ea5e9')} />}
        {hasCoords(dropoff) && <Marker position={[dropoff.lat, dropoff.lng]} icon={dotIcon('#f59e0b')} />}
        <Marker position={riderPt} icon={dotIcon('#10b981')} />
        <Fit points={points} />
      </MapContainer>
    </div>
  )
}
