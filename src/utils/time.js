export function formatRouteTime(startedAt, now) {
  if (!startedAt) return '—'
  const ms = Math.max(0, now - startedAt)
  const totalMin = Math.floor(ms / 60000)
  const sec = Math.floor((ms % 60000) / 1000)
  if (totalMin < 60) return `${totalMin}m ${String(sec).padStart(2, '0')}s`
  const h = Math.floor(totalMin / 60)
  return `${h}h ${totalMin % 60}m`
}

export function formatRelative(ts, now) {
  if (!ts) return '—'
  const s = Math.max(0, Math.floor((now - ts) / 1000))
  if (s < 60) return `hace ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m}m`
  const h = Math.floor(m / 60)
  return `hace ${h}h`
}

export function formatClock(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}
