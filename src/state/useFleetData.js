import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { POLL_INTERVAL_MS } from '../config/constants'
import { createMockSource } from '../mock/mockEngine'
import { createUberClient } from '../api/uberClient'
import { createGlovoClient } from '../api/glovoClient'
import { normalizeFleet, normalizeGlovoFleet } from '../api/normalize'

export const FleetContext = createContext(null)

export function useFleet() {
  const ctx = useContext(FleetContext)
  if (!ctx) throw new Error('useFleet debe usarse dentro de <FleetContext.Provider>')
  return ctx
}

// Fuente real de un proveedor concreto. Misma interfaz que la demo (start/poll).
// Uber -> Vehicle Solutions (normalizeFleet); Glovo -> Live Ops (normalizeGlovoFleet).
function createProviderSource(connection, provider) {
  if (provider === 'glovo') {
    const client = createGlovoClient(connection)
    return {
      mode: 'real',
      async start(signal) {
        return { ...normalizeGlovoFleet(await client.getFleet(signal)), baselineKpis: { completedToday: 0, avgSumMin: 0, avgCountN: 0 } }
      },
      async poll(signal) {
        return normalizeGlovoFleet(await client.getFleet(signal))
      },
    }
  }
  const client = createUberClient(connection)
  return {
    mode: 'real',
    async start(signal) {
      // normalizeFleet ya incluye meta (métricas reales); no sobrescribir.
      return { ...normalizeFleet(await client.getFleet(signal)), baselineKpis: { completedToday: 0, avgSumMin: 0, avgCountN: 0 } }
    },
    async poll(signal) {
      return normalizeFleet(await client.getFleet(signal))
    },
  }
}

// Combina varias fuentes en una sola flota (vista "Todos"). Hace los fetch en
// paralelo y concatena riders/deliveries; las métricas se suman campo a campo.
// Si una fuente falla (p. ej. Glovo sin configurar), se ignora y se muestra el resto.
function mergeSnapshots(snaps) {
  const ok = snaps.filter(Boolean)
  const riders = ok.flatMap((s) => s.riders || [])
  const deliveries = ok.flatMap((s) => s.deliveries || [])
  const meta = {}
  for (const s of ok) {
    for (const [k, v] of Object.entries(s.meta || {})) {
      if (typeof v === 'number') meta[k] = (meta[k] || 0) + v
    }
  }
  return { riders, deliveries, meta }
}

function createCombinedSource(sources) {
  async function gather(method, signal) {
    const results = await Promise.all(
      sources.map((s) => Promise.resolve(s[method](signal)).catch(() => null)),
    )
    return mergeSnapshots(results)
  }
  return {
    mode: 'combined',
    async start(signal) {
      return { ...(await gather('start', signal)), baselineKpis: { completedToday: 0, avgSumMin: 0, avgCountN: 0 } }
    },
    poll(signal) {
      return gather('poll', signal)
    },
  }
}

// Construye la fuente activa según demo/proveedor. 'all' fusiona uber + glovo.
function buildSource(connection, provider) {
  const make = (p) => (connection.demoMode ? createMockSource(p) : createProviderSource(connection, p))
  if (provider === 'all') return createCombinedSource([make('uber'), make('glovo')])
  return make(provider)
}

function makeEvent(type, d, now) {
  const messages = {
    assignment: `${d.courierName ?? 'Rider'} aceptó un pedido${d.dropoffAddress ? ` · ${d.dropoffAddress}` : ''}`,
    completed: `${d.courierName ?? 'Rider'} completó la entrega${d.durationMin ? ` en ${d.durationMin} min` : ''}`,
    cancellation: `Pedido cancelado${d.courierName ? ` · ${d.courierName}` : ''}`,
  }
  return {
    id: `${type}-${d.id}-${now}`,
    ts: now,
    type,
    riderName: d.courierName ?? null,
    deliveryId: d.id,
    durationMin: d.durationMin ?? null,
    message: messages[type],
  }
}

// Sintetiza eventos comparando el snapshot anterior con el nuevo (simula los webhooks).
// `seen` deduplica para no contar dos veces la misma entrega terminal.
function deriveEvents(prevDeliveries, nextDeliveries, seen, now) {
  const prevMap = new Map(prevDeliveries.map((d) => [d.id, d]))
  const nextMap = new Map(nextDeliveries.map((d) => [d.id, d]))
  const events = []

  for (const d of nextDeliveries) {
    if (d.outcome === 'completed' && !seen.terminal.has(d.id)) {
      seen.terminal.add(d.id)
      events.push(makeEvent('completed', d, now))
    } else if (d.outcome === 'incident' && !seen.terminal.has(d.id)) {
      seen.terminal.add(d.id)
      events.push(makeEvent('cancellation', d, now))
    } else if (d.outcome === 'active' && !prevMap.has(d.id) && !seen.active.has(d.id)) {
      seen.active.add(d.id)
      events.push(makeEvent('assignment', d, now))
    }
  }

  // Entregas activas que desaparecen del listado: en el camino real el endpoint suele
  // soltar las completadas, así que lo tratamos como completado (best-effort).
  for (const d of prevDeliveries) {
    if (d.outcome === 'active' && !nextMap.has(d.id) && !seen.terminal.has(d.id)) {
      seen.terminal.add(d.id)
      events.push(makeEvent('completed', d, now))
    }
  }
  return events
}

// KPIs. En modo real (Vehicle Solutions) los valores vienen en `meta` (analytics);
// en demo se calculan desde baseline + eventos acumulados. avgDeliveryMin es decimal (min).
function deriveKpis(riders, deliveries, acc, baseline, meta) {
  const m = meta || {}
  const activeRiders = riders.filter((r) => r.status !== 'offline').length
  const ordersInProgress =
    typeof m.ordersInProgress === 'number'
      ? m.ordersInProgress
      : riders.filter((r) => r.currentDelivery).length
  const completedToday =
    typeof m.completedToday === 'number'
      ? m.completedToday
      : (baseline.completedToday ?? 0) + acc.completedCount
  let avgDeliveryMin
  if (typeof m.avgMinutes === 'number' && m.avgMinutes > 0) {
    avgDeliveryMin = m.avgMinutes
  } else {
    const sum = (baseline.avgSumMin ?? 0) + acc.durSum
    const cnt = (baseline.avgCountN ?? 0) + acc.durCount
    avgDeliveryMin = cnt > 0 ? sum / cnt : 0
  }
  const openIncidents =
    typeof m.openIncidents === 'number'
      ? m.openIncidents
      : deliveries.filter((d) => d.outcome === 'incident').length
  const totalRiders = riders.length
  const inactiveRiders = totalRiders - activeRiders
  return {
    activeRiders,
    inactiveRiders,
    totalRiders,
    ordersInProgress,
    completedToday,
    avgDeliveryMin,
    openIncidents,
  }
}

// Eventos del feed en modo real: detecta cambios de estado de conductor entre polls.
function makeStatusEvent(rider, before, now) {
  const s = rider.status
  let type = 'assignment'
  let message
  if (s === 'en_entrega' || s === 'en_ruta') {
    type = 'assignment'
    message = `${rider.name} inició un viaje`
  } else if ((before === 'en_entrega' || before === 'en_ruta') && s === 'disponible') {
    type = 'completed'
    message = `${rider.name} completó un viaje`
  } else if (s === 'offline') {
    type = 'cancellation'
    message = `${rider.name} se desconectó`
  } else if (before === 'offline' && s === 'disponible') {
    type = 'assignment'
    message = `${rider.name} se conectó`
  } else {
    type = 'assignment'
    message = `${rider.name} cambió de estado`
  }
  return { id: `st-${rider.id}-${now}`, ts: now, type, riderName: rider.name, deliveryId: null, durationMin: null, message }
}

function deriveStatusEvents(prevRiders, riders, now) {
  const prevMap = new Map((prevRiders || []).map((r) => [r.id, r.status]))
  const events = []
  for (const r of riders) {
    const before = prevMap.get(r.id)
    if (before !== undefined && before !== r.status) events.push(makeStatusEvent(r, before, now))
  }
  return events
}

const EMPTY_KPIS = {
  activeRiders: 0,
  inactiveRiders: 0,
  totalRiders: 0,
  ordersInProgress: 0,
  completedToday: 0,
  avgDeliveryMin: 0,
  openIncidents: 0,
}

const KPI_KEYS = ['activeRiders', 'ordersInProgress', 'completedToday', 'avgDeliveryMin', 'openIncidents']

// Siembra un histórico sintético para que los sparklines tengan forma desde el inicio.
function seedHistory(kpis) {
  const n = 14
  const out = {}
  for (const key of KPI_KEYS) {
    const cur = kpis[key] ?? 0
    const arr = []
    for (let i = 0; i < n; i += 1) {
      if (key === 'completedToday') {
        arr.push(Math.max(0, Math.round(cur - (n - i) * 1.3)))
      } else {
        const jitter = (Math.random() - 0.5) * Math.max(1, cur * 0.2)
        arr.push(Math.max(0, Math.round(cur + jitter)))
      }
    }
    arr.push(cur)
    out[key] = arr
  }
  return out
}

export function useFleetData(connection, provider = 'uber') {
  const { demoMode, token, environment, connected } = connection

  const [snapshot, setSnapshot] = useState({ riders: [], deliveries: [] })
  const [events, setEvents] = useState([])
  const [kpis, setKpis] = useState(EMPTY_KPIS)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(POLL_INTERVAL_MS / 1000)
  const [kpiHistory, setKpiHistory] = useState({})
  const [kpiDeltas, setKpiDeltas] = useState(null)

  const sourceRef = useRef(null)
  const prevDeliveriesRef = useRef([])
  const prevRidersRef = useRef([])
  const prevKpisRef = useRef(null)
  const accRef = useRef({ completedCount: 0, durSum: 0, durCount: 0 })
  const baselineRef = useRef({ completedToday: 0, avgSumMin: 0, avgCountN: 0 })
  const seenRef = useRef({ active: new Set(), terminal: new Set() })
  const metaRef = useRef({})
  const historyRef = useRef(null)
  const tickTimer = useRef(null)
  const countdownTimer = useRef(null)

  const applySnapshot = useCallback((snap, isInitial) => {
    const now = Date.now()
    let newEvents = []
    if (isInitial) {
      for (const d of snap.deliveries) {
        if (d.outcome === 'active') seenRef.current.active.add(d.id)
      }
    } else if (snap.deliveries.length > 0) {
      // Demo (entregas): eventos por diff de entregas + acumulación de completadas.
      newEvents = deriveEvents(prevDeliveriesRef.current, snap.deliveries, seenRef.current, now)
      for (const e of newEvents) {
        if (e.type === 'completed') {
          accRef.current.completedCount += 1
          if (e.durationMin) {
            accRef.current.durSum += e.durationMin
            accRef.current.durCount += 1
          }
        }
      }
    } else {
      // Real (flota): eventos por cambios de estado de conductor entre polls.
      newEvents = deriveStatusEvents(prevRidersRef.current, snap.riders, now)
    }
    prevDeliveriesRef.current = snap.deliveries
    prevRidersRef.current = snap.riders

    if (snap.meta) metaRef.current = snap.meta
    setSnapshot({ riders: snap.riders, deliveries: snap.deliveries })
    if (newEvents.length) {
      setEvents((prev) => [...newEvents.reverse(), ...prev].slice(0, 60))
    }

    const nextKpis = deriveKpis(snap.riders, snap.deliveries, accRef.current, baselineRef.current, metaRef.current)
    if (isInitial || !historyRef.current) {
      historyRef.current = seedHistory(nextKpis)
    } else {
      const h = historyRef.current
      for (const k of KPI_KEYS) h[k] = [...(h[k] ?? []), nextKpis[k]].slice(-24)
    }

    // Deltas (↑↓) vs el ciclo anterior.
    const prevK = prevKpisRef.current
    setKpiDeltas(
      prevK
        ? {
            activeRiders: nextKpis.activeRiders - prevK.activeRiders,
            ordersInProgress: nextKpis.ordersInProgress - prevK.ordersInProgress,
            completedToday: nextKpis.completedToday - prevK.completedToday,
            avgDeliveryMin: nextKpis.avgDeliveryMin - prevK.avgDeliveryMin,
            openIncidents: nextKpis.openIncidents - prevK.openIncidents,
          }
        : null,
    )
    prevKpisRef.current = nextKpis

    setKpiHistory({ ...historyRef.current })
    setKpis(nextKpis)
    setLastUpdated(now)
  }, [])

  const refreshNow = useCallback(() => {
    const source = sourceRef.current
    if (!source) return
    Promise.resolve(source.poll())
      .then((snap) => {
        applySnapshot(snap, false)
        setSecondsUntilRefresh(POLL_INTERVAL_MS / 1000)
        setError(null)
      })
      .catch((e) => setError(e?.message ?? 'Error al actualizar.'))
  }, [applySnapshot])

  useEffect(() => {
    if (!connected) return undefined
    let cancelled = false

    setLoading(true)
    setError(null)
    setEvents([])
    // Limpia los datos visibles al cambiar de proveedor/conexión: si la nueva fuente
    // falla o no está configurada (p. ej. Glovo sin credenciales), NO debe quedarse
    // mostrando los riders/KPIs del proveedor anterior.
    setSnapshot({ riders: [], deliveries: [] })
    setKpis(EMPTY_KPIS)
    setKpiHistory({})
    setLastUpdated(null)
    accRef.current = { completedCount: 0, durSum: 0, durCount: 0 }
    seenRef.current = { active: new Set(), terminal: new Set() }
    prevDeliveriesRef.current = []
    prevRidersRef.current = []
    prevKpisRef.current = null
    metaRef.current = {}
    historyRef.current = null
    setKpiDeltas(null)

    const source = buildSource({ demoMode, token, environment }, provider)
    sourceRef.current = source

    ;(async () => {
      try {
        const snap = await source.start()
        if (cancelled) return
        baselineRef.current = snap.baselineKpis ?? { completedToday: 0, avgSumMin: 0, avgCountN: 0 }
        applySnapshot(snap, true)
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setError(e?.message ?? 'Error al cargar los datos.')
        setLoading(false)
      }
    })()

    let backoffMs = POLL_INTERVAL_MS
    let consecutiveErrors = 0

    async function doPoll() {
      try {
        const snap = await source.poll()
        if (cancelled) return
        applySnapshot(snap, false)
        setError(null)
        consecutiveErrors = 0
        backoffMs = POLL_INTERVAL_MS
      } catch (e) {
        if (!cancelled) setError(e?.message ?? 'Error al actualizar.')
        consecutiveErrors += 1
        const base = Math.min(POLL_INTERVAL_MS * Math.pow(2, consecutiveErrors), 5 * 60_000)
        backoffMs = base + Math.round(Math.random() * base * 0.3)
      } finally {
        if (!cancelled) {
          setSecondsUntilRefresh(Math.round(backoffMs / 1000))
          clearTimeout(tickTimer.current)
          tickTimer.current = setTimeout(() => {
            if (!document.hidden) doPoll()
          }, backoffMs)
        }
      }
    }

    let polling = false
    const origDoPoll = doPoll
    doPoll = async () => {
      if (polling) return
      polling = true
      try { await origDoPoll() } finally { polling = false }
    }

    tickTimer.current = setTimeout(() => {
      if (!document.hidden) doPoll()
    }, POLL_INTERVAL_MS)

    setSecondsUntilRefresh(POLL_INTERVAL_MS / 1000)
    countdownTimer.current = setInterval(() => {
      setSecondsUntilRefresh((s) => (s <= 1 ? POLL_INTERVAL_MS / 1000 : s - 1))
    }, 1000)

    function onVisible() {
      if (!document.hidden) doPoll()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearTimeout(tickTimer.current)
      clearInterval(countdownTimer.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [connected, demoMode, token, environment, provider, applySnapshot])

  return {
    riders: snapshot.riders,
    deliveries: snapshot.deliveries,
    events,
    kpis,
    kpiHistory,
    kpiDeltas,
    lastUpdated,
    loading,
    error,
    secondsUntilRefresh,
    refreshNow,
    isDemo: demoMode,
  }
}
