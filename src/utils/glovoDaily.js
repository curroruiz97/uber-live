// Parseo y agregación de los CSV diarios de actividad (formato COURIER_DAILY de Glovo)
// para importarlos vía el RPC import_glovo_daily. Puro (testeable), sin red.
import { parseCsv } from './csv'

// Campos numéricos aditivos (se suman al colapsar los mercados de un mismo rider/día).
export const SUM_FIELDS = [
  'online_hours', 'active_hours', 'open_hours', 'enroute_p2_hours', 'ontrip_p3_hours', 'unavailable_hours',
  'num_of_trips', 'single_trips_total', 'late_p2_trips', 'late_p3_trips', 'accept_trips', 'reject_trips',
  'cancel_trips', 'cancel_not_at_fault_trips', 'p2_km', 'p2_min', 'p3_km', 'p3_min', 'total_km', 'total_min',
]
const INT_FIELDS = new Set([
  'num_of_trips', 'single_trips_total', 'late_p2_trips', 'late_p3_trips', 'accept_trips', 'reject_trips',
  'cancel_trips', 'cancel_not_at_fault_trips',
])

// Teléfono normalizado: quita la parte decimal de exportaciones tipo "698870966.0"
// (float) ANTES de quedarse con los dígitos, para no generar un "0" final espurio
// que crearía un rider_key duplicado por persona.
export function digits(s) {
  return String(s || '').trim().replace(/[.,]\d+$/, '').replace(/\D/g, '')
}
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

// Extrae la hora de exportación del nombre COURIER_DAILY_SAPIENS_YYYYMMDD_HHMMSS.csv -> ISO.
export function parseGlovoFilenameTs(name) {
  const m = /_(\d{8})_(\d{6})\.csv$/i.exec(String(name || ''))
  if (!m) return null
  const d = m[1]
  const t = m[2]
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`
}

// Agrega filas de CSV (cabeceras en minúscula, vía parseCsv) en una fila por (teléfono, día),
// SUMANDO las métricas de las filas que comparten mercado. Respeta una columna opcional
// `exported_at` por fila (la trae el histórico consolidado).
export function aggregateGlovoRows(rows) {
  const map = new Map()
  for (const r of rows || []) {
    const phone = digits(r.driver_number)
    const date = String(r.datestr || '').slice(0, 10)
    if (!phone || !date) continue
    const key = `${phone}|${date}`
    let a = map.get(key)
    if (!a) {
      a = { rider_key: phone, work_date: date, driver_uuid: '', driver_name: '', driver_email: '', driver_phone: '', city: '', city_id: '', form_factor: '', markets: new Set(), source_exported_at: null, sum: {} }
      map.set(key, a)
    }
    for (const f of SUM_FIELDS) a.sum[f] = (a.sum[f] || 0) + num(r[f])
    const mk = String(r.market_name || '').trim()
    if (mk) for (const part of mk.split('|')) if (part.trim()) a.markets.add(part.trim())
    a.driver_uuid = r.driver_uuid || a.driver_uuid
    a.driver_name = r.driver_name || a.driver_name
    a.driver_email = r.driver_email || a.driver_email
    a.driver_phone = r.driver_number || a.driver_phone
    a.city = r.city_name || a.city
    a.city_id = r.city_id || a.city_id
    a.form_factor = r.form_factor || a.form_factor
    if (r.exported_at) a.source_exported_at = r.exported_at
  }
  return [...map.values()].map((a) => {
    const out = {
      rider_key: a.rider_key, work_date: a.work_date, driver_uuid: a.driver_uuid, driver_name: a.driver_name,
      driver_email: a.driver_email, driver_phone: a.driver_phone, city: a.city, city_id: a.city_id,
      form_factor: a.form_factor, markets: [...a.markets],
    }
    for (const f of SUM_FIELDS) {
      const v = a.sum[f] || 0
      out[f] = INT_FIELDS.has(f) ? Math.round(v) : Math.round(v * 10000) / 10000
    }
    if (a.source_exported_at) out.source_exported_at = a.source_exported_at
    return out
  })
}

// Detecta filas con online_hours congeladas: muchos viajes pero horas imposiblemente bajas.
// Uber a veces exporta el día más reciente con horas sin procesar.
export function isSuspectRow(r) {
  const trips = r.num_of_trips || 0
  const hours = r.online_hours || 0
  if (trips < 5) return false
  return hours <= 0 || trips / hours > 10
}

// Parsea un fichero (texto + nombre) en payload listo para el RPC.
// Devuelve { rows, exportedAt, dateMin, dateMax, riders, perRowTs, suspect }.
export function buildPayloadFromCsv(text, filename) {
  const { rows } = parseCsv(text)
  const agg = aggregateGlovoRows(rows)
  const exportedAt = parseGlovoFilenameTs(filename)
  const suspect = agg.filter(isSuspectRow)
  const clean = agg.filter((r) => !isSuspectRow(r))
  const dates = clean.map((r) => r.work_date).filter(Boolean).sort()
  const perRowTs = clean.some((r) => r.source_exported_at)
  return {
    rows: clean,
    exportedAt,
    perRowTs,
    dateMin: dates[0] || null,
    dateMax: dates[dates.length - 1] || null,
    riders: new Set(clean.map((r) => r.rider_key)).size,
    suspect: suspect.length,
    suspectDates: [...new Set(suspect.map((r) => r.work_date))],
  }
}

// Divide un array en lotes de tamaño n.
export function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}
