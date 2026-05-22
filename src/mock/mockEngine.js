import { buildInitialFleet, makeDelivery, lerp } from './mockData'
import { zoneForLocation } from '../config/constants'

// Proyección pública de un rider del motor (oculta el estado interno de ruta).
function publicRider(r) {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    vehicleType: r.vehicleType,
    licensePlate: r.licensePlate,
    tripsToday: r.tripsToday,
    status: r.status,
    location: r.location,
    zone: r.location ? zoneForLocation(r.location.lat, r.location.lng) : null,
    city: r.city,
    currentDelivery: r.delivery
      ? {
          id: r.delivery.id,
          status: r.delivery.phase === 'to_pickup' ? 'pickup' : 'dropoff',
          pickupName: r.delivery.pickupName,
          dropoffAddress: r.delivery.dropoffAddress,
          etaMin: Math.max(1, Math.round(r.delivery.etaMin * (1 - r.delivery.progress))),
        }
      : null,
    routeStartedAt: r.routeStartedAt,
    lastSeenAt: r.lastSeenAt,
  }
}

function activeDelivery(r) {
  const d = r.delivery
  return {
    id: d.id,
    rawStatus: d.phase === 'to_pickup' ? 'pickup' : 'dropoff',
    internalStatus: d.phase === 'to_pickup' ? 'en_ruta' : 'en_entrega',
    outcome: 'active',
    courierId: r.id,
    courierName: r.name,
    pickupName: d.pickupName,
    dropoffAddress: d.dropoffAddress,
    pickup: { name: d.pickupName, address: d.pickupAddress, ...d.pickup },
    dropoff: { address: d.dropoffAddress, ...d.dropoff },
    createdAt: d.startedAt,
    durationMin: null,
  }
}

function terminalDelivery(r) {
  const t = r.terminal
  return {
    id: t.deliveryId,
    rawStatus: t.status,
    internalStatus: 'disponible',
    outcome: t.status === 'delivered' ? 'completed' : 'incident',
    courierId: r.id,
    courierName: r.name,
    dropoffAddress: t.dropoffAddress,
    durationMin: t.durationMin,
    createdAt: null,
  }
}

function snapshot(fleet, state) {
  const riders = fleet.map(publicRider)
  const deliveries = []
  for (const r of fleet) {
    if (r.delivery) deliveries.push(activeDelivery(r))
    if (r.terminal) deliveries.push(terminalDelivery(r))
  }
  return { riders, deliveries, meta: { openIncidents: state.openIncidents } }
}

// Avanza la simulación un "tick" (un poll). Mueve riders, completa/asigna entregas,
// genera cancelaciones ocasionales y mantiene el contador de incidencias abiertas.
function advance(fleet, state) {
  const now = Date.now()
  // Limpia los flashes terminales del tick anterior (ya fueron emitidos como eventos).
  for (const r of fleet) r.terminal = null

  for (const r of fleet) {
    if (r.delivery) {
      const d = r.delivery
      d.progress += d.speed + Math.random() * 0.04
      if (d.progress >= 1) {
        if (d.phase === 'to_pickup') {
          // Recogido -> ahora hacia el dropoff
          d.phase = 'to_dropoff'
          d.from = { ...d.pickup }
          d.target = { ...d.dropoff }
          d.progress = 0
          d.speed = 0.1 + Math.random() * 0.12
          r.location = { ...d.pickup }
          r.status = 'en_entrega'
        } else {
          // Entregado
          r.location = { ...d.dropoff }
          r.terminal = {
            deliveryId: d.id,
            status: 'delivered',
            durationMin: 12 + Math.floor(Math.random() * 26),
            dropoffAddress: d.dropoffAddress,
          }
          r.delivery = null
          r.status = 'disponible'
          r.routeStartedAt = null
          r.tripsToday = (r.tripsToday || 0) + 1
        }
      } else {
        r.location = lerp(d.from, d.target, d.progress)
        r.status = d.phase === 'to_pickup' ? 'en_ruta' : 'en_entrega'
      }
      r.lastSeenAt = now
      continue
    }

    if (r.status === 'offline') {
      if (Math.random() < 0.12) {
        r.status = 'disponible'
        r.lastSeenAt = now
      }
      continue
    }

    // disponible
    r.lastSeenAt = now
    if (Math.random() < 0.35) {
      r.delivery = makeDelivery(r, now, 'to_pickup')
      r.status = 'en_ruta'
      r.routeStartedAt = now
    } else if (Math.random() < 0.05) {
      r.status = 'offline'
    }
  }

  // Cancelación ocasional de una entrega activa
  if (Math.random() < 0.22) {
    const active = fleet.filter((r) => r.delivery)
    if (active.length) {
      const r = active[Math.floor(Math.random() * active.length)]
      r.terminal = {
        deliveryId: r.delivery.id,
        status: 'canceled',
        durationMin: null,
        dropoffAddress: r.delivery.dropoffAddress,
      }
      r.delivery = null
      r.status = 'disponible'
      r.routeStartedAt = null
      state.openIncidents += 1
    }
  }

  // Resolución ocasional de incidencias abiertas
  if (state.openIncidents > 0 && Math.random() < 0.3) {
    state.openIncidents -= 1
  }
}

// Fuente de datos del modo demo. Misma interfaz que la fuente real:
//   start() -> { riders, deliveries, meta, baselineKpis }
//   poll()  -> { riders, deliveries, meta }
export function createMockSource() {
  const fleet = buildInitialFleet()
  const state = { openIncidents: 2 }
  return {
    mode: 'demo',
    start() {
      return {
        ...snapshot(fleet, state),
        // Arranque del demo afinado: ~5 completadas, tiempo medio ~22min (luego evoluciona con el polling).
        baselineKpis: { completedToday: 5, avgSumMin: 22 * 8, avgCountN: 8 },
      }
    },
    poll() {
      advance(fleet, state)
      return snapshot(fleet, state)
    },
  }
}
