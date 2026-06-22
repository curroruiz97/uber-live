import { zoneForLocation } from '../config/constants'

// ============================================================================
// ÚNICO punto de acoplamiento al payload real de Uber.
// La 3PL Consumer Delivery API está en early-access y su esquema no es público,
// así que esto mapea de forma defensiva la forma documentada de Uber Direct (DaaS)
// y variantes. Si el spec real difiere, AJUSTA SOLO ESTE ARCHIVO.
// ============================================================================

// Estado crudo de Uber -> { internal: estado de rider, outcome: resultado de la entrega }
const STATUS_MAP = {
  // variante en minúsculas (DaaS /customers/.../deliveries)
  pending: { internal: 'disponible', outcome: 'active' },
  pickup: { internal: 'en_ruta', outcome: 'active' },
  pickup_complete: { internal: 'en_ruta', outcome: 'active' },
  dropoff: { internal: 'en_entrega', outcome: 'active' },
  delivered: { internal: 'disponible', outcome: 'completed' },
  canceled: { internal: 'disponible', outcome: 'incident' },
  cancelled: { internal: 'disponible', outcome: 'incident' },
  returned: { internal: 'disponible', outcome: 'incident' },
  // variante en MAYÚSCULAS (Direct/Eats orders)
  scheduled: { internal: 'disponible', outcome: 'active' },
  en_route_to_pickup: { internal: 'en_ruta', outcome: 'active' },
  arrived_at_pickup: { internal: 'en_ruta', outcome: 'active' },
  en_route_to_dropoff: { internal: 'en_entrega', outcome: 'active' },
  arrived_at_dropoff: { internal: 'en_entrega', outcome: 'active' },
  completed: { internal: 'disponible', outcome: 'completed' },
  failed: { internal: 'disponible', outcome: 'incident' },
  courier_cancel: { internal: 'disponible', outcome: 'incident' },
}

export function normalizeStatus(raw) {
  const key = String(raw ?? '').toLowerCase()
  return STATUS_MAP[key] ?? { internal: 'disponible', outcome: 'active' }
}

function pickArray(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.deliveries)) return payload.deliveries
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.results)) return payload.results
  return []
}

function coord(obj) {
  if (!obj) return null
  const lat = obj.lat ?? obj.latitude
  const lng = obj.lng ?? obj.lon ?? obj.longitude
  if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng }
  return null
}

function fallbackId() {
  return 'd_' + Math.random().toString(36).slice(2, 10)
}

export function normalizeDelivery(raw) {
  const id = raw.id ?? raw.delivery_id ?? raw.uuid ?? fallbackId()
  const rawStatus = raw.status ?? raw.state ?? 'pending'
  const { internal, outcome } = normalizeStatus(rawStatus)
  const courier = raw.courier ?? raw.courier_info ?? null
  const pickup = raw.pickup ?? raw.pickup_info ?? {}
  const dropoff = raw.dropoff ?? raw.dropoff_info ?? {}

  return {
    id: String(id),
    rawStatus: String(rawStatus),
    internalStatus: internal,
    outcome, // 'active' | 'completed' | 'incident'
    courierId: courier ? String(courier.id ?? courier.uuid ?? courier.name ?? id) : null,
    courierName: courier?.name ?? null,
    courierPhone: courier?.phone_number ?? courier?.phone ?? null,
    vehicleType: courier?.vehicle_type ?? courier?.vehicle?.type ?? null,
    courierLocation: coord(courier?.location),
    pickup: {
      name: pickup.name ?? pickup.business_name ?? 'Recogida',
      address: pickup.address ?? '',
      ...coord(pickup.location ?? pickup),
    },
    dropoff: {
      address: dropoff.address ?? '',
      ...coord(dropoff.location ?? dropoff),
    },
    createdAt: raw.created ?? raw.created_at ?? null,
    pickupEta: raw.pickup_eta ?? raw.pickup_ready_dt ?? null,
    dropoffEta: raw.dropoff_eta ?? raw.dropoff_deadline_dt ?? null,
    trackingUrl: raw.tracking_url ?? raw.order_tracking_url ?? null,
  }
}

// payload de Uber -> { deliveries[], riders[] } del modelo interno.
// Los riders se DERIVAN de los couriers asignados a entregas (Uber no expone un roster propio).
export function normalizeDeliveries(payload) {
  const deliveries = pickArray(payload).map(normalizeDelivery)
  const ridersById = new Map()

  for (const d of deliveries) {
    if (!d.courierId) continue
    const isActive = d.outcome === 'active'
    const existing = ridersById.get(d.courierId)
    // Si ya hay una entrega activa para este courier, no la pises con una inactiva.
    if (existing && existing._active && !isActive) continue

    ridersById.set(d.courierId, {
      id: d.courierId,
      provider: 'uber',
      name: d.courierName ?? `Courier ${d.courierId.slice(0, 6)}`,
      phone: d.courierPhone,
      vehicleType: d.vehicleType,
      status: isActive ? d.internalStatus : 'disponible',
      location: d.courierLocation,
      zone:
        d.courierLocation && zoneForLocation(d.courierLocation.lat, d.courierLocation.lng),
      currentDelivery: isActive
        ? {
            id: d.id,
            status: d.rawStatus,
            pickupName: d.pickup.name,
            dropoffAddress: d.dropoff.address,
            etaMin: null,
          }
        : null,
      routeStartedAt: d.createdAt ? new Date(d.createdAt).getTime() : null,
      lastSeenAt: Date.now(),
      _active: isActive,
    })
  }

  return { deliveries, riders: Array.from(ridersById.values()) }
}

// ============================================================================
// Vehicle Solutions API: mapea conductores (drivers) -> modelo Rider.
// Esta es la API real de SAPIENS TELCO SL (flota). El proxy entrega ya
// fusionado { orgs, riders[] } desde orgs -> drivers -> live-location.
// ============================================================================

const REGION_CENTROIDS = {
  madrid: { city: 'Madrid', lat: 40.4168, lng: -3.7038 },
  bilbao: { city: 'Bilbao', lat: 43.263, lng: -2.935 },
  salamanca: { city: 'Salamanca', lat: 40.9651, lng: -5.664 },
  zaragoza: { city: 'Zaragoza', lat: 41.6488, lng: -0.8891 },
  pamplona: { city: 'Pamplona', lat: 42.8125, lng: -1.6458 },
  navarra: { city: 'Pamplona', lat: 42.8125, lng: -1.6458 },
  santander: { city: 'Santander', lat: 43.4623, lng: -3.8100 },
  tenerife: { city: 'Tenerife', lat: 28.4636, lng: -16.2518 },
  canarias: { city: 'Tenerife', lat: 28.4636, lng: -16.2518 },
  norte: { city: 'Santander', lat: 43.4623, lng: -3.8100 },
}

function regionForOrg(orgName) {
  const n = (orgName || '').toLowerCase()
  for (const key of Object.keys(REGION_CENTROIDS)) {
    if (n.includes(key)) return { id: key, label: orgName, ...REGION_CENTROIDS[key] }
  }
  return { id: 'otros', label: orgName || 'Otros', city: 'España', lat: 40.4, lng: -3.7 }
}

function hashStr(s) {
  let h = 0
  for (let i = 0; i < String(s).length; i += 1) h = (h * 31 + String(s).charCodeAt(i)) | 0
  return Math.abs(h)
}

// Dispersión estable alrededor del centroide de la región (fallback sin GPS real).
function scatterAround(center, seedStr) {
  const h = hashStr(seedStr)
  const dLat = ((h % 1000) / 1000 - 0.5) * 0.06
  const dLng = ((Math.floor(h / 1000) % 1000) / 1000 - 0.5) * 0.08
  return { lat: center.lat + dLat, lng: center.lng + dLng }
}

const DRIVER_STATUS_PATTERNS = [
  [/offline|inactive|logged_?out/i, 'offline'],
  [/on_?trip|on_?job|dropoff|delivering|busy/i, 'en_entrega'],
  [/en_?route|pickup|accepted|dispatch/i, 'en_ruta'],
  [/online|available|idle|active/i, 'disponible'],
]

function mapDriverStatus(raw) {
  if (!raw) return 'offline' // sin entrada de estado en 7 días -> inactivo
  for (const [re, st] of DRIVER_STATUS_PATTERNS) if (re.test(raw)) return st
  return 'offline'
}

function titleCase(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}

// Tipo de vehículo normalizado a solo "Moto" o "Bicicleta".
// Matrícula española (4 dígitos + 3 letras) => vehículo a motor; el resto (códigos
// internos tipo SAPMAD###, "BIKE", etc.) => bicicleta.
function inferVehicleType(plate) {
  const p = String(plate || '').trim()
  if (/^\d{4}\s?[a-z]{3}$/i.test(p)) return 'Moto'
  return 'Bicicleta'
}

// Matrícula/ID a mostrar en el detalle (solo si parece un identificador real, no la palabra "BIKE").
function cleanPlate(plate) {
  const p = String(plate || '').trim()
  if (!p || !/\d/.test(p)) return null
  return p.toUpperCase()
}

export function normalizeFleet(payload) {
  const now = Date.now()
  const list = payload?.riders || []
  const riders = list.map((r) => {
    const region = regionForOrg(r.orgName)
    // Sin GPS real (live-location da 500): se dispersa de forma estable por la región.
    const location = scatterAround(region, r.driverId)
    const name = `${titleCase(r.firstName)} ${titleCase(r.lastName)}`.trim() || 'Conductor'
    const status = mapDriverStatus(r.status)
    const onTrip = status === 'en_entrega' // DRIVER_STATUS_ONTRIP
    return {
      id: r.driverId,
      provider: 'uber',
      name,
      phone: r.phone || null,
      email: r.email || null,
      vehicleType: inferVehicleType(r.licensePlate),
      licensePlate: cleanPlate(r.licensePlate),
      status,
      location,
      zone: { id: region.id, label: region.label, city: region.city },
      // Vehicle Solutions NO expone el detalle del pedido (recogida/entrega/ETA). Sí
      // sabemos que está en viaje -> indicador real "Viaje en curso" (sin direcciones).
      currentDelivery: onTrip
        ? { id: `${r.driverId}-trip`, status: 'en_viaje', pickupName: null, dropoffAddress: null, etaMin: null, live: true }
        : null,
      // Inicio del viaje (real): timestamp en que entró en estado ONTRIP.
      routeStartedAt: onTrip ? r.statusSince || null : null,
      // Última señal real: momento del último cambio de estado.
      lastSeenAt: r.statusSince || now,
      tripsToday: r.tripsToday || 0,
      approxLocation: true,
    }
  })
  // metrics (de analytics) viajan en meta -> deriveKpis los usa directamente.
  return { riders, deliveries: [], meta: payload?.metrics || {} }
}

// ============================================================================
// Glovo Live Operations API: mapea riders en vivo -> modelo Rider.
// A diferencia de Uber, Glovo SÍ expone GPS real (lat/lng) por rider, actualizado
// cada ~5 min. La Edge Function `glovo` ya entrega los riders aplanados con este
// shape (id, status, lat, lng, name, city, KPIs); aquí solo unificamos al modelo.
// ============================================================================

// Estados de Glovo Live Ops -> estados internos del rider.
const GLOVO_STATUS_MAP = {
  available: 'disponible',
  ready: 'disponible',
  working: 'en_entrega', // con pedido asignado/en curso
  delivering: 'en_entrega',
  busy: 'en_entrega',
  late: 'en_ruta',
  break: 'offline',
  ending: 'offline',
  offline: 'offline',
}

function mapGlovoStatus(raw) {
  const key = String(raw ?? '').toLowerCase()
  return GLOVO_STATUS_MAP[key] || 'disponible'
}

export function normalizeGlovoFleet(payload) {
  const now = Date.now()
  const list = payload?.riders || []
  const riders = list.map((r) => {
    const status = mapGlovoStatus(r.status)
    const hasGps = typeof r.lat === 'number' && typeof r.lng === 'number'
    const location = hasGps ? { lat: r.lat, lng: r.lng } : null
    const onTrip = status === 'en_entrega' || status === 'en_ruta'
    const name = String(r.name || '').trim() || `Rider ${String(r.id).slice(0, 6)}`
    return {
      id: `glovo-${r.id}`,
      provider: 'glovo',
      name,
      phone: r.phone || null,
      email: r.email || null,
      vehicleType: r.vehicle || r.vehicleType || null,
      licensePlate: null,
      status,
      location,
      // Glovo da el nombre de ciudad/zona; si hay GPS, zoneForLocation afina; si no, usa el label crudo.
      zone: location
        ? zoneForLocation(location.lat, location.lng)
        : { id: r.cityId ? `glovo_${r.cityId}` : 'glovo', label: r.city || r.zone || 'Glovo', city: r.city || '' },
      currentDelivery: onTrip
        ? { id: `${r.id}-trip`, status: 'en_viaje', pickupName: null, dropoffAddress: null, etaMin: null, live: true }
        : null,
      routeStartedAt: onTrip ? r.shiftStart || r.statusSince || null : null,
      lastSeenAt: r.statusSince || r.lastSeenAt || now,
      tripsToday: r.deliveries ?? r.tripsToday ?? 0,
      // GPS REAL (no disperso). Esta es la ventaja de Glovo frente a Uber.
      approxLocation: !hasGps,
    }
  })
  return { riders, deliveries: [], meta: payload?.metrics || {} }
}
