import { ZONES } from '../config/constants'

// ---- RNG con semilla para una flota inicial determinista (mejor para evaluar) ----
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NAMES = [
  'Lucía Fernández', 'Mateo Gómez', 'Sofía Rodríguez', 'Hugo Martín', 'Martina López',
  'Daniel Sánchez', 'Paula García', 'Pablo Díaz', 'Valeria Ruiz', 'Adrián Moreno',
  'Carla Jiménez', 'Álvaro Muñoz', 'Noa Álvarez', 'Marcos Romero', 'Jimena Navarro',
  'Izan Torres', 'Vega Domínguez', 'Bruno Gil', 'Aitana Vázquez', 'Leo Serrano',
  'Claudia Ramos', 'Gonzalo Castro', 'Elena Ortiz', 'Diego Rubio', 'Sara Núñez',
  'Nicolás Medina', 'Alba Cortés', 'Iván Santos', 'Lola Herrera', 'Mario Peña',
]

const VEHICLES = ['Bicicleta', 'Moto']

const PICKUPS = [
  'Goiko', 'La Tagliatella', 'Telepizza', 'Burger King', "McDonald's", 'Sushi Artist',
  'Honest Greens', 'TGB', "Foster's Hollywood", 'Tropic', 'Carrefour Express', 'Mercadona',
  'KFC', 'La Sureña', 'Pans & Company',
]

const STREETS = {
  Valladolid: ['Calle Santiago', 'Paseo Zorrilla', 'Calle Mantería', 'Plaza Mayor', 'Calle Gamazo', 'Av. de Salamanca', 'Calle Doctrinos'],
  Madrid: ['Gran Vía', 'Calle de Alcalá', 'Paseo de la Castellana', 'Calle Goya', 'Calle de Atocha', 'Calle Fuencarral', 'Calle de Serrano'],
}

const RIDER_COUNT = 26

export function pick(arr, rnd = Math.random) {
  return arr[Math.floor(rnd() * arr.length)]
}

function jitter(center, amt, rnd = Math.random) {
  return {
    lat: center.lat + (rnd() - 0.5) * amt,
    lng: center.lng + (rnd() - 0.5) * amt * 1.3,
  }
}

export function lerp(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }
}

function phone(rnd) {
  const n = () => Math.floor(rnd() * 900 + 100)
  return `+34 6${Math.floor(rnd() * 10)}${Math.floor(rnd() * 10)} ${n()} ${n()}`
}

const EMAIL_DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.es', 'icloud.com']

function slug(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos (marcas diacríticas combinantes)
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .join('.')
}

function email(name, rnd) {
  return `${slug(name)}@${pick(EMAIL_DOMAINS, rnd)}`
}

// Matrícula española actual: 4 dígitos + 3 consonantes (sin vocales). Coincide con
// inferVehicleType() del camino real -> se muestra como "Moto".
const PLATE_LETTERS = 'BCDFGHJKLMNPRSTVWXYZ'
function motoPlate(rnd) {
  const num = String(Math.floor(rnd() * 9000) + 1000)
  let letters = ''
  for (let i = 0; i < 3; i += 1) letters += PLATE_LETTERS[Math.floor(rnd() * PLATE_LETTERS.length)]
  return `${num} ${letters}`
}

function address(city, rnd = Math.random) {
  return `${pick(STREETS[city], rnd)}, ${Math.floor(rnd() * 180) + 1}`
}

let deliverySeq = 1000
function nextDeliveryId() {
  deliverySeq += 1
  return `DLV-${deliverySeq}`
}

// Crea una entrega para un rider. phase: 'to_pickup' (en ruta) | 'to_dropoff' (en entrega).
export function makeDelivery(rider, now, phase = 'to_pickup', rnd = Math.random) {
  const center = rider._zoneCenter
  const pickup = jitter(center, 0.022, rnd)
  const dropoff = jitter(center, 0.04, rnd)
  return {
    id: nextDeliveryId(),
    phase,
    pickupName: pick(PICKUPS, rnd),
    pickupAddress: address(rider.city, rnd),
    dropoffAddress: address(rider.city, rnd),
    pickup,
    dropoff,
    from: phase === 'to_pickup' ? { ...rider.location } : { ...pickup },
    target: phase === 'to_pickup' ? pickup : dropoff,
    progress: 0,
    speed: 0.1 + rnd() * 0.12,
    startedAt: now,
    etaMin: 6 + Math.floor(rnd() * 22),
  }
}

// Construye la flota inicial (~26 riders) repartida entre Valladolid y Madrid.
export function buildInitialFleet() {
  const rnd = mulberry32(20260522)
  const now = Date.now()
  const fleet = []

  for (let i = 0; i < RIDER_COUNT; i += 1) {
    // Reparte: ~40% Valladolid, ~60% Madrid
    const city = rnd() < 0.4 ? 'Valladolid' : 'Madrid'
    const cityZones = ZONES.filter((z) => z.city === city)
    const zone = pick(cityZones, rnd)

    const name = NAMES[i % NAMES.length]
    const vehicleType = pick(VEHICLES, rnd)
    const rider = {
      id: `rider-${i + 1}`,
      name,
      phone: phone(rnd),
      email: email(name, rnd),
      vehicleType,
      // Moto -> matrícula real (se ve en el detalle); Bicicleta -> sin matrícula, igual que el real.
      licensePlate: vehicleType === 'Moto' ? motoPlate(rnd) : null,
      tripsToday: Math.floor(rnd() * 12),
      city,
      _zoneCenter: zone.center,
      status: 'disponible',
      location: jitter(zone.center, 0.03, rnd),
      delivery: null,
      terminal: null,
      routeStartedAt: null,
      lastSeenAt: now,
    }

    // Estado inicial ponderado
    const roll = rnd()
    if (roll < 0.25) {
      // en entrega (camino al dropoff)
      rider.delivery = makeDelivery(rider, now - Math.floor(rnd() * 480000), 'to_dropoff', rnd)
      rider.delivery.progress = 0.15 + rnd() * 0.6
      rider.location = lerp(rider.delivery.from, rider.delivery.target, rider.delivery.progress)
      rider.status = 'en_entrega'
      rider.routeStartedAt = rider.delivery.startedAt
    } else if (roll < 0.5) {
      // en ruta (camino a recogida)
      rider.delivery = makeDelivery(rider, now - Math.floor(rnd() * 300000), 'to_pickup', rnd)
      rider.delivery.progress = 0.1 + rnd() * 0.6
      rider.location = lerp(rider.delivery.from, rider.delivery.target, rider.delivery.progress)
      rider.status = 'en_ruta'
      rider.routeStartedAt = rider.delivery.startedAt
    } else if (roll < 0.82) {
      rider.status = 'disponible'
    } else {
      rider.status = 'offline'
      rider.lastSeenAt = now - Math.floor(rnd() * 1800000) - 300000
    }

    fleet.push(rider)
  }

  return fleet
}
