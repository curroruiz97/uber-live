// Reglas puras de cumplimiento de riders v2. Sin React, sin red: solo cálculo, para
// poder testearlas a fondo. Modelo: PRESENCIA + HORAS TRABAJADAS + PRODUCTIVIDAD.
//
// La actividad real viene del CSV diario (formato COURIER_DAILY) con AGREGADOS por día
// (no hay marcas por evento), así que NO se mide puntualidad al minuto. Se cruzan los
// turnos planificados (shift_plans, semanales recurrentes) con la actividad real por día.

// Estados de cumplimiento de un día.
export const COMPLIANCE_STATUS = {
  cumple: { id: 'cumple', label: 'Cumple', tone: 'emerald' },
  parcial: { id: 'parcial', label: 'Parcial', tone: 'amber' },
  ausente: { id: 'ausente', label: 'Ausente', tone: 'red' },
  justificado: { id: 'justificado', label: 'Justificado', tone: 'sky' },
  extra: { id: 'extra', label: 'Extra', tone: 'violet' },
  sin_datos: { id: 'sin_datos', label: 'Sin datos', tone: 'zinc' },
}
export const STATUS_LIST = ['cumple', 'parcial', 'ausente', 'justificado', 'extra', 'sin_datos']

export const ALERT_TYPE = {
  ausente: { id: 'ausente', label: 'Ausencia', severity: 'critical' },
  parcial: { id: 'parcial', label: 'Jornada parcial', severity: 'warning' },
  baja_aceptacion: { id: 'baja_aceptacion', label: 'Aceptación baja', severity: 'warning' },
  cancelaciones: { id: 'cancelaciones', label: 'Cancelaciones altas', severity: 'warning' },
}

export const DEFAULT_CFG = {
  timezone: 'Europe/Madrid',
  week_starts_on: 1,
  hours_metric: 'online', // métrica que puntúa: 'active' | 'online'
  min_compliance_pct: 100, // % de horas planificadas para considerar "cumple"
  presence_threshold_hours: 0.5, // horas mínimas para contar como presente
  target_acceptance_pct: 90,
  max_cancel_pct: 5,
}

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const round = (n, d = 0) => {
  const f = 10 ** d
  return Math.round((Number(n) || 0) * f) / f
}

// Canonicaliza el nombre de ciudad para agrupar/mostrar: sin acentos, MAYÚSCULAS,
// sin sufijo de país (", SPAIN"/", ESPAÑA") y espacios simples. Así "Zaragoza",
// "ZARAGOZA" y "SALAMANCA, SPAIN" / "Salamanca" caen en un único grupo.
export function canonCity(s) {
  if (!s) return null
  const x = String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/,\s*(SPAIN|ESPANA)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return x || null
}

// 'HH:MM' -> minutos desde medianoche.
function hmToMin(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number)
  if (!Number.isFinite(h)) return 0
  return h * 60 + (Number.isFinite(m) ? m : 0)
}

// ISO 'YYYY-MM-DD' -> id de día (lunes..domingo).
export function diaOfIso(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  const wd = new Date(y, m - 1, d).getDay() // 0=domingo..6=sábado
  return DIAS[(wd + 6) % 7]
}

function isoOf(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return isoOf(dt)
}

// Lista de fechas ISO inclusivas en [from, to].
export function eachDateIso(from, to) {
  if (!from || !to || from > to) return []
  const out = []
  let cur = from
  let guard = 0
  while (cur <= to && guard < 4000) {
    out.push(cur)
    cur = addDays(cur, 1)
    guard += 1
  }
  return out
}

// Mapa `${riderKey}|${date}` -> tipo de ausencia, para [from,to]. Solo ausencias vinculadas.
export function expandAbsences(absences, from, to) {
  const map = new Map()
  for (const a of absences || []) {
    const key = a.rider_key
    const tipo = a.tipo
    const start = a.fecha_inicio
    if (!key || !tipo || !start) continue
    const end = a.fecha_fin || (a.dias ? addDays(start, Math.max(0, Number(a.dias) - 1)) : start)
    let cur = start < from ? from : start
    const last = end > to ? to : end
    let guard = 0
    while (cur <= last && guard < 4000) {
      map.set(`${key}|${cur}`, tipo)
      cur = addDays(cur, 1)
      guard += 1
    }
  }
  return map
}

// Expande los turnos semanales a minutos planificados por (riderKey, fecha) en [from,to].
// Devuelve [{ riderKey, name, provider, city, date, plannedMin, absenceTipo|null }].
// Excluye turnos sin rider_key (no vinculados): se gestionan aparte en la UI.
export function expandSchedule(shiftPlans, absences, from, to) {
  const dates = eachDateIso(from, to)
  if (!dates.length) return []
  const absByKeyDate = expandAbsences(absences, from, to)
  // Agrupa turnos por día de la semana.
  const byDia = new Map()
  for (const s of shiftPlans || []) {
    if (!s.rider_key) continue
    if (!byDia.has(s.dia)) byDia.set(s.dia, [])
    byDia.get(s.dia).push(s)
  }
  const acc = new Map() // `${riderKey}|${date}` -> entry
  for (const date of dates) {
    const dia = diaOfIso(date)
    const plans = byDia.get(dia)
    if (!plans) continue
    for (const s of plans) {
      let mins = hmToMin(s.hora_fin) - hmToMin(s.hora_inicio)
      if (mins < 0) mins += 1440 // turno que cruza medianoche
      if (mins <= 0) continue
      const key = `${s.rider_key}|${date}`
      const cur = acc.get(key)
      if (cur) {
        cur.plannedMin += mins
      } else {
        acc.set(key, {
          riderKey: s.rider_key,
          name: s.rider_name,
          provider: s.provider || 'uber',
          city: s.city || null,
          date,
          plannedMin: mins,
          absenceTipo: absByKeyDate.get(key) || null,
        })
      }
    }
  }
  return [...acc.values()]
}

// Extrae las métricas (camelCase) de una fila de rider_daily_stats (snake_case) o ceros.
export function metricsFrom(s) {
  if (!s) {
    return {
      onlineHours: 0, activeHours: 0, openHours: 0, enrouteP2Hours: 0, ontripP3Hours: 0, unavailableHours: 0,
      trips: 0, singleTrips: 0, lateP2: 0, lateP3: 0, accept: 0, reject: 0, cancel: 0, cancelNAF: 0,
      p2Km: 0, p2Min: 0, p3Km: 0, p3Min: 0, totalKm: 0, totalMin: 0,
    }
  }
  return {
    onlineHours: num(s.online_hours), activeHours: num(s.active_hours), openHours: num(s.open_hours),
    enrouteP2Hours: num(s.enroute_p2_hours), ontripP3Hours: num(s.ontrip_p3_hours), unavailableHours: num(s.unavailable_hours),
    trips: num(s.num_of_trips), singleTrips: num(s.single_trips_total), lateP2: num(s.late_p2_trips), lateP3: num(s.late_p3_trips),
    accept: num(s.accept_trips), reject: num(s.reject_trips), cancel: num(s.cancel_trips), cancelNAF: num(s.cancel_not_at_fault_trips),
    p2Km: num(s.p2_km), p2Min: num(s.p2_min), p3Km: num(s.p3_km), p3Min: num(s.p3_min), totalKm: num(s.total_km), totalMin: num(s.total_min),
  }
}

function workedHoursOf(m) {
  return m.onlineHours
}

// Cumplimiento de UN día. plannedMin: minutos planificados (0 = no programado).
// actual: fila rider_daily_stats | null. absenceTipo: tipo si el día está cubierto por ausencia.
export function computeDayCompliance(plannedMin, actual, cfg = DEFAULT_CFG, absenceTipo = null) {
  const c = { ...DEFAULT_CFG, ...cfg }
  const m = metricsFrom(actual)
  const workedH = workedHoursOf(m)
  const workedMin = Math.round(workedH * 60)
  const threshold = c.presence_threshold_hours ?? 0.5

  let status
  let compliancePct = null
  let attended = false
  const scheduled = plannedMin > 0

  if (scheduled) {
    if (absenceTipo) {
      status = 'justificado'
    } else if (!actual || workedH < threshold) {
      status = 'ausente'
      compliancePct = 0
    } else {
      attended = true
      compliancePct = Math.round((workedMin / plannedMin) * 100)
      status = compliancePct >= (c.min_compliance_pct ?? 100) ? 'cumple' : 'parcial'
    }
  } else {
    // Sin turno planificado ese día: solo cuenta si realmente trabajó (extra).
    if (workedH >= threshold) {
      status = 'extra'
      attended = true
    } else {
      status = 'no_programado'
    }
  }

  // % real sin tope (para mostrar sobre-cumplimiento), separado del usado en medias.
  const rawPct = scheduled && plannedMin > 0 ? Math.round((workedMin / plannedMin) * 100) : null

  return { status, scheduled, attended, plannedMin, workedMin, compliancePct, rawPct, absenceTipo: absenceTipo || null, ...m }
}

export function getEffectiveLastDate(stats) {
  let latest = null
  for (const s of stats || []) {
    if (s.work_date && (!latest || s.work_date > latest)) latest = s.work_date
  }
  return latest
}

// Produce el array `daily` cruzando turnos + ausencias + actividad real en [from,to].
export function buildDaily(shiftPlans, absences, stats, from, to, cfg = DEFAULT_CFG) {
  const planned = expandSchedule(shiftPlans, absences, from, to)
  const statByKey = new Map()
  const bounds = new Map()
  const statsCountByDate = new Map()
  for (const s of stats || []) {
    if (!s.work_date) continue
    statByKey.set(`${s.rider_key}|${s.work_date}`, s)
    statsCountByDate.set(s.work_date, (statsCountByDate.get(s.work_date) || 0) + 1)
    const b = bounds.get(s.rider_key)
    if (!b) bounds.set(s.rider_key, { first: s.work_date, last: s.work_date })
    else {
      if (s.work_date < b.first) b.first = s.work_date
      if (s.work_date > b.last) b.last = s.work_date
    }
  }
  const scheduledKeys = new Set((shiftPlans || []).filter((s) => s.rider_key).map((s) => s.rider_key))
  const seen = new Set()
  const out = []

  for (const p of planned) {
    const b = bounds.get(p.riderKey)
    if (!b || p.date < b.first) continue
    if (statsCountByDate.get(p.date) === undefined && p.date > b.last) continue

    const key = `${p.riderKey}|${p.date}`
    seen.add(key)
    const a = statByKey.get(key) || null
    const comp = computeDayCompliance(p.plannedMin, a, cfg, p.absenceTipo)
    out.push({
      riderKey: p.riderKey, name: p.name, provider: p.provider, city: canonCity(a?.city || p.city), date: p.date, ...comp,
    })
  }

  for (const s of stats || []) {
    if (!s.work_date || s.work_date < from || s.work_date > to) continue
    if (!scheduledKeys.has(s.rider_key)) continue
    const key = `${s.rider_key}|${s.work_date}`
    if (seen.has(key)) continue
    const comp = computeDayCompliance(0, s, cfg, null)
    if (comp.status === 'no_programado') continue
    out.push({
      riderKey: s.rider_key, name: s.driver_name || s.rider_key, provider: s.source_provider || 'glovo',
      city: canonCity(s.city), date: s.work_date, ...comp,
    })
  }
  return out
}

// Agrega un conjunto de filas diarias (de un rider o de la flota) en métricas de periodo.
export function aggregateCompliance(rows) {
  const programmed = []
  let justified = 0
  let extras = 0
  const acc = {
    onlineHours: 0, activeHours: 0, openHours: 0, trips: 0, accept: 0, reject: 0, cancel: 0,
    lateDeliveries: 0, totalKm: 0, plannedMin: 0, workedMin: 0,
  }
  for (const r of rows || []) {
    acc.onlineHours += r.onlineHours || 0
    acc.activeHours += r.activeHours || 0
    acc.openHours += r.openHours || 0
    acc.trips += r.trips || 0
    acc.accept += r.accept || 0
    acc.reject += r.reject || 0
    acc.cancel += r.cancel || 0
    acc.lateDeliveries += (r.lateP2 || 0) + (r.lateP3 || 0)
    acc.totalKm += r.totalKm || 0
    acc.workedMin += r.workedMin || 0
    if (r.status === 'justificado') justified += 1
    else if (r.status === 'extra') extras += 1
    else if (r.scheduled) {
      programmed.push(r)
      acc.plannedMin += r.plannedMin || 0
    }
  }
  const progN = programmed.length
  const present = programmed.filter((r) => r.attended).length
  const absences = programmed.filter((r) => r.status === 'ausente').length
  const partials = programmed.filter((r) => r.status === 'parcial').length
  const fulfilled = programmed.filter((r) => r.status === 'cumple').length
  const pctSum = programmed.reduce((s, r) => s + (r.compliancePct || 0), 0)
  const assigned = acc.accept + acc.reject

  return {
    days: (rows || []).length,
    programmedDays: progN,
    justifiedDays: justified,
    extraDays: extras,
    present,
    absences,
    partials,
    fulfilled,
    attendancePct: progN ? round((present / progN) * 100) : 0,
    avgCompliancePct: progN ? round(pctSum / progN) : 0,
    plannedHours: round(acc.plannedMin / 60, 1),
    workedHours: round(acc.workedMin / 60, 1),
    onlineHours: round(acc.onlineHours, 1),
    activeHours: round(acc.activeHours, 1),
    openHours: round(acc.openHours, 1),
    trips: acc.trips,
    lateDeliveries: acc.lateDeliveries,
    cancels: acc.cancel,
    acceptanceRatePct: assigned > 0 ? round((acc.accept / assigned) * 100) : null,
    cancelRatePct: acc.trips + acc.cancel > 0 ? round((acc.cancel / (acc.trips + acc.cancel)) * 100) : 0,
    productivity: round(acc.workedMin / 60, 1) > 0 ? round(acc.trips / round(acc.workedMin / 60, 1), 2) : 0,
    km: round(acc.totalKm, 1),
  }
}

// Ranking de riders por % de cumplimiento (desempate: asistencia, productividad).
export function buildRanking(rows, metaByKey = new Map()) {
  const byRider = new Map()
  for (const r of rows || []) {
    if (!byRider.has(r.riderKey)) byRider.set(r.riderKey, [])
    byRider.get(r.riderKey).push(r)
  }
  const ranking = [...byRider.entries()].map(([riderKey, list]) => {
    const meta = metaByKey.get(riderKey) || {}
    return {
      riderKey,
      name: meta.name || list[0].name || riderKey,
      provider: meta.provider || list[0].provider || null,
      ...aggregateCompliance(list),
    }
  })
  ranking.sort(
    (a, b) =>
      b.avgCompliancePct - a.avgCompliancePct ||
      b.attendancePct - a.attendancePct ||
      b.productivity - a.productivity,
  )
  return ranking.map((r, i) => ({ ...r, rank: i + 1 }))
}

// Distribución por estado.
export function statusBreakdown(rows) {
  const out = { cumple: 0, parcial: 0, ausente: 0, justificado: 0, extra: 0, total: (rows || []).length }
  for (const r of rows || []) {
    if (Object.prototype.hasOwnProperty.call(out, r.status)) out[r.status] += 1
  }
  return out
}

// Serie por fecha (para el gráfico de tendencia).
export function trendByDate(rows) {
  const byDate = new Map()
  for (const r of rows || []) {
    if (!byDate.has(r.date)) byDate.set(r.date, [])
    byDate.get(r.date).push(r)
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([date, list]) => {
      const agg = aggregateCompliance(list)
      return {
        date,
        avgCompliancePct: agg.avgCompliancePct,
        attendancePct: agg.attendancePct,
        activeHours: agg.activeHours,
        trips: agg.trips,
        present: agg.present,
        absences: agg.absences,
        total: agg.programmedDays,
      }
    })
}

// Estadísticas por rider para la vista de riders: agregados + serie de % + último estado.
export function buildRiderStats(rows, metaByKey = new Map()) {
  const byRider = new Map()
  for (const r of rows || []) {
    if (!byRider.has(r.riderKey)) byRider.set(r.riderKey, [])
    byRider.get(r.riderKey).push(r)
  }
  const stats = [...byRider.entries()].map(([riderKey, list]) => {
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    const meta = metaByKey.get(riderKey) || {}
    const agg = aggregateCompliance(sorted)
    const last = sorted[sorted.length - 1]
    return {
      riderKey,
      name: meta.name || list[0].name || riderKey,
      provider: meta.provider || list[0].provider || null,
      phone: meta.phone || null,
      vehicleType: meta.vehicleType || null,
      city: meta.city || list[0].city || null,
      ...agg,
      trend: sorted.filter((d) => d.scheduled && d.status !== 'justificado').map((d) => d.compliancePct || 0),
      lastStatus: last ? last.status : null,
      lastDate: last ? last.date : null,
    }
  })
  stats.sort((a, b) => a.name.localeCompare(b.name))
  return stats
}

// Agrupa las filas de un rider por granularidad (día/semana/mes) y agrega cada bucket.
export function rollupByGranularity(rows, granularity = 'day', cfg = DEFAULT_CFG) {
  const weekStartsOn = cfg.week_starts_on ?? 1
  const keyOf = (iso) => {
    if (granularity === 'month') return iso.slice(0, 7)
    if (granularity === 'week') {
      const [y, m, d] = iso.split('-').map(Number)
      const dt = new Date(y, m - 1, d)
      const diff = (dt.getDay() - weekStartsOn + 7) % 7
      dt.setDate(dt.getDate() - diff)
      return isoOf(dt)
    }
    return iso
  }
  const groups = new Map()
  for (const r of rows || []) {
    const k = keyOf(r.date)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(r)
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([key, list]) => {
      const dates = list.map((r) => r.date).sort()
      return {
        bucketKey: key,
        granularity,
        from: dates[0],
        to: dates[dates.length - 1],
        ...aggregateCompliance(list),
      }
    })
}

// Avisos derivados (cliente, sin persistencia) a partir de las filas diarias.
export function deriveAlerts(rows, cfg = DEFAULT_CFG) {
  const c = { ...DEFAULT_CFG, ...cfg }
  const out = []
  for (const r of rows || []) {
    if (!r.scheduled) continue
    if (r.status === 'ausente') {
      out.push({ id: `${r.riderKey}|${r.date}|ausente`, riderKey: r.riderKey, name: r.name, date: r.date, type: 'ausente', severity: 'critical' })
    } else if (r.status === 'parcial') {
      out.push({ id: `${r.riderKey}|${r.date}|parcial`, riderKey: r.riderKey, name: r.name, date: r.date, type: 'parcial', severity: 'warning' })
    }
    const assigned = (r.accept || 0) + (r.reject || 0)
    if (assigned >= 5 && (r.accept / assigned) * 100 < (c.target_acceptance_pct ?? 90)) {
      out.push({ id: `${r.riderKey}|${r.date}|acept`, riderKey: r.riderKey, name: r.name, date: r.date, type: 'baja_aceptacion', severity: 'warning' })
    }
    if ((r.trips || 0) + (r.cancel || 0) >= 5 && (r.cancel / ((r.trips || 0) + r.cancel)) * 100 > (c.max_cancel_pct ?? 5)) {
      out.push({ id: `${r.riderKey}|${r.date}|cancel`, riderKey: r.riderKey, name: r.name, date: r.date, type: 'cancelaciones', severity: 'warning' })
    }
  }
  // Más recientes primero.
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return out
}

// Riders que deberían estar en turno AHORA según shift_plans.
// Devuelve [{ riderKey, name, city, inicio, fin }].
export function getRidersOnShiftNow(shiftPlans, now = new Date()) {
  const dia = DIAS[(now.getDay() + 6) % 7]
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const out = []
  const seen = new Set()
  for (const s of shiftPlans || []) {
    if (!s.rider_key || s.dia !== dia) continue
    if (seen.has(s.rider_key)) continue
    const start = s.hora_inicio || '00:00'
    const end = s.hora_fin || '23:59'
    const crosses = start > end
    const inShift = crosses ? (hhmm >= start || hhmm <= end) : (hhmm >= start && hhmm <= end)
    if (!inShift) continue
    seen.add(s.rider_key)
    out.push({ riderKey: s.rider_key, name: s.rider_name, city: s.city, inicio: start, fin: end })
  }
  return out
}
