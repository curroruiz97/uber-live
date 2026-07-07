// Utilidades de tiempo para turnos: retraso de conexión y comparación hora real vs horario.

// Segundos de retraso desde la hora de inicio del turno ('HH:MM') hasta `now`.
// 0 si aún no debía haber entrado; null si la hora no es válida.
function parseHM(inicio) {
  const parts = String(inicio || '').split(':')
  if (parts.length < 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return { h, m }
}

export function shiftDelaySeconds(inicio, now = new Date()) {
  const hm = parseHM(inicio)
  if (!hm) return null
  const start = new Date(now)
  start.setHours(hm.h, hm.m, 0, 0)
  const sec = Math.floor((now.getTime() - start.getTime()) / 1000)
  return sec > 0 ? sec : 0
}

// Formatea segundos de retraso de forma legible, conservando el valor en segundos.
export function fmtDelay(sec) {
  if (sec == null) return ''
  if (sec < 60) return `${sec} s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m < 60) return `${m} min${s ? ` ${s}s` : ''} (${sec} s)`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m (${sec} s)`
}

// 'HH:MM' de un instante (hora local).
export function toHHMM(d) {
  if (!d) return ''
  const x = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(x.getTime())) return ''
  return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`
}

// Minutos de diferencia entre la hora real de conexión y la hora de inicio del turno.
// Positivo = se conectó tarde; negativo = se conectó antes. null si falta algún dato.
export function connectDeltaMin(inicio, connectedAt) {
  if (!connectedAt) return null
  const hm = parseHM(inicio)
  if (!hm) return null
  const c = connectedAt instanceof Date ? connectedAt : new Date(connectedAt)
  if (Number.isNaN(c.getTime())) return null
  const start = new Date(c)
  start.setHours(hm.h, hm.m, 0, 0)
  return Math.round((c.getTime() - start.getTime()) / 60000)
}
