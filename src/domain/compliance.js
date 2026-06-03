// Reglas puras de cumplimiento de horarios. Sin React, sin red: solo cálculo, para
// poder testearlas a fondo (los números de cumplimiento no pueden fallar nunca).
//
// Convención de tiempos: las marcas reales se guardan en UTC (epoch ms). Las
// comparaciones de "hora" se hacen contra los horarios planificados, que ya vienen
// como instantes absolutos (planned_start/planned_end en UTC tras convertir desde la
// hora local de la org al subir). Aquí trabajamos con epoch ms en ambos lados.

export const COMPLIANCE_STATUS = {
  cumple: { id: 'cumple', label: 'Cumple', tone: 'emerald' },
  tarde: { id: 'tarde', label: 'Tarde', tone: 'amber' },
  incompleto: { id: 'incompleto', label: 'Incompleto', tone: 'amber' },
  ausente: { id: 'ausente', label: 'Ausente', tone: 'red' },
}

export const ALERT_TYPE = {
  ausencia: { id: 'ausencia', label: 'Ausencia', severity: 'critical' },
  tarde: { id: 'tarde', label: 'Llegó tarde', severity: 'warning' },
  salida_anticipada: { id: 'salida_anticipada', label: 'Salida anticipada', severity: 'warning' },
  jornada_incompleta: { id: 'jornada_incompleta', label: 'Jornada incompleta', severity: 'warning' },
}

const DEFAULT_CFG = { grace_in_min: 5, grace_out_min: 5, min_compliance_pct: 90 }

function minutesBetween(aMs, bMs) {
  return Math.round((bMs - aMs) / 60000)
}

// Calcula el cumplimiento de UN turno frente a la actividad real de ese día.
// schedule: { plannedStart, plannedEnd, plannedMinutes }   (epoch ms / min)
// actual:   { firstOnlineAt, lastOnlineAt, workedMinutes }  (epoch ms / min) | null si no hubo actividad
// cfg:      { grace_in_min, grace_out_min, min_compliance_pct }
// Devuelve un registro normalizado de cumplimiento del día.
export function computeDailyCompliance(schedule, actual, cfg = {}) {
  const c = { ...DEFAULT_CFG, ...cfg }
  const plannedMinutes = Math.max(0, schedule.plannedMinutes ?? minutesBetween(schedule.plannedStart, schedule.plannedEnd))

  // Sin actividad => ausente.
  if (!actual || !actual.firstOnlineAt || (actual.workedMinutes ?? 0) <= 0) {
    return {
      plannedMinutes,
      workedMinutes: 0,
      checkInDelayMin: null,
      checkOutEarlyMin: null,
      attended: false,
      late: false,
      compliancePct: 0,
      status: 'ausente',
    }
  }

  const workedMinutes = Math.max(0, actual.workedMinutes ?? 0)
  const checkInDelayMin = minutesBetween(schedule.plannedStart, actual.firstOnlineAt) // + tarde, - antes
  const checkOutEarlyMin = minutesBetween(actual.lastOnlineAt, schedule.plannedEnd) // + salió antes

  const late = checkInDelayMin > c.grace_in_min
  const leftEarly = checkOutEarlyMin > c.grace_out_min

  // % base por minutos trabajados sobre los planificados (acotado a 100).
  let pct = plannedMinutes > 0 ? Math.min(100, (workedMinutes / plannedMinutes) * 100) : 0
  // Penalización leve por impuntualidad (entrada tarde), proporcional al retraso.
  if (late) pct = Math.max(0, pct - Math.min(20, checkInDelayMin - c.grace_in_min))
  pct = Math.round(pct)

  let status = 'cumple'
  if (late) status = 'tarde'
  if (pct < c.min_compliance_pct || leftEarly) status = late ? 'tarde' : 'incompleto'
  // "tarde" y "incompleto" pueden coexistir; priorizamos mostrar el peor matiz como incompleto si el % cae mucho.
  if (pct < c.min_compliance_pct && !late) status = 'incompleto'

  return {
    plannedMinutes,
    workedMinutes,
    checkInDelayMin,
    checkOutEarlyMin,
    attended: true,
    late,
    compliancePct: pct,
    status,
  }
}

// Deriva los avisos de un registro de cumplimiento diario.
export function deriveAlerts(daily) {
  const alerts = []
  if (!daily.attended) {
    alerts.push({ type: 'ausencia', severity: 'critical' })
    return alerts
  }
  if (daily.late) alerts.push({ type: 'tarde', severity: 'warning' })
  if ((daily.checkOutEarlyMin ?? 0) > 0) alerts.push({ type: 'salida_anticipada', severity: 'warning' })
  if (daily.status === 'incompleto') alerts.push({ type: 'jornada_incompleta', severity: 'warning' })
  return alerts
}

// Agrega varios registros diarios (de un rider o de la flota) en métricas de periodo.
// rows: [{ riderKey, plannedMinutes, workedMinutes, checkInDelayMin, attended, late, compliancePct, status }]
export function aggregateCompliance(rows) {
  const n = rows.length
  if (!n) {
    return { days: 0, attendancePct: 0, punctualityPct: 0, avgCompliancePct: 0, plannedMinutes: 0, workedMinutes: 0, avgCheckInDelayMin: 0, absences: 0, lates: 0 }
  }
  let attended = 0
  let punctual = 0
  let plannedMinutes = 0
  let workedMinutes = 0
  let pctSum = 0
  let delaySum = 0
  let delayN = 0
  let absences = 0
  let lates = 0
  for (const r of rows) {
    plannedMinutes += r.plannedMinutes ?? 0
    workedMinutes += r.workedMinutes ?? 0
    pctSum += r.compliancePct ?? 0
    if (r.attended) {
      attended += 1
      if (!r.late) punctual += 1
      if (typeof r.checkInDelayMin === 'number') {
        delaySum += r.checkInDelayMin
        delayN += 1
      }
    } else {
      absences += 1
    }
    if (r.late) lates += 1
  }
  return {
    days: n,
    attendancePct: Math.round((attended / n) * 100),
    punctualityPct: attended ? Math.round((punctual / attended) * 100) : 0,
    avgCompliancePct: Math.round(pctSum / n),
    plannedMinutes,
    workedMinutes,
    avgCheckInDelayMin: delayN ? Math.round(delaySum / delayN) : 0,
    absences,
    lates,
  }
}

// Construye un ranking de riders a partir de registros diarios agrupados por rider.
// rows: [{ riderKey, name, ...daily }]. Devuelve [{ riderKey, name, ...aggregate }] ordenado.
export function buildRanking(rows) {
  const byRider = new Map()
  for (const r of rows) {
    const k = r.riderKey
    if (!byRider.has(k)) byRider.set(k, { riderKey: k, name: r.name || k, rows: [] })
    byRider.get(k).rows.push(r)
  }
  const ranking = [...byRider.values()].map((g) => ({
    riderKey: g.riderKey,
    name: g.name,
    ...aggregateCompliance(g.rows),
  }))
  // Orden: mayor % de cumplimiento; desempate por puntualidad y menor retraso medio.
  ranking.sort(
    (a, b) =>
      b.avgCompliancePct - a.avgCompliancePct ||
      b.punctualityPct - a.punctualityPct ||
      a.avgCheckInDelayMin - b.avgCheckInDelayMin,
  )
  return ranking.map((r, i) => ({ ...r, rank: i + 1 }))
}

// Distribución por estado de un conjunto de registros diarios.
// Devuelve { cumple, tarde, incompleto, ausente, total }.
export function statusBreakdown(rows) {
  const out = { cumple: 0, tarde: 0, incompleto: 0, ausente: 0, total: rows.length }
  for (const r of rows) {
    if (Object.prototype.hasOwnProperty.call(out, r.status)) out[r.status] += 1
  }
  return out
}

// Serie temporal agregada por día (para el gráfico de tendencia).
// Devuelve [{ date, avgCompliancePct, attendancePct, attended, absences, total }] ordenado por fecha ascendente.
export function trendByDate(rows) {
  const byDate = new Map()
  for (const r of rows) {
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
        attended: agg.days - agg.absences,
        absences: agg.absences,
        total: agg.days,
      }
    })
}

// Estadísticas por rider para la vista de riders: agregados + serie de % + último estado.
// metaByKey: Map(riderKey -> { name, provider, phone, vehicleType }). Ordena por nombre.
export function buildRiderStats(rows, metaByKey = new Map()) {
  const byRider = new Map()
  for (const r of rows) {
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
      ...agg,
      trend: sorted.map((d) => d.compliancePct),
      lastStatus: last ? last.status : null,
      lastDate: last ? last.date : null,
    }
  })
  stats.sort((a, b) => a.name.localeCompare(b.name))
  return stats
}
