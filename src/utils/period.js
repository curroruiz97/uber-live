// Helpers de periodo para los reportes (día / semana / mes). Trabajan con fechas
// 'YYYY-MM-DD' en hora local del navegador (suficiente para la demo y la UI).

export function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Devuelve { from, to } (YYYY-MM-DD inclusive) para el periodo que contiene `ref`.
export function periodRange(period, ref = new Date()) {
  const d = new Date(ref)
  d.setHours(0, 0, 0, 0)
  if (period === 'day') {
    const s = isoLocal(d)
    return { from: s, to: s }
  }
  if (period === 'week') {
    // Semana ISO: empieza en lunes.
    const dow = (d.getDay() + 6) % 7 // 0 = lunes
    const start = new Date(d)
    start.setDate(d.getDate() - dow)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { from: isoLocal(start), to: isoLocal(end) }
  }
  // month
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { from: isoLocal(start), to: isoLocal(end) }
}

export function inRange(dateIso, from, to) {
  return dateIso >= from && dateIso <= to
}

export function periodLabel(period, ref = new Date()) {
  const { from, to } = periodRange(period, ref)
  const fmt = (s) => {
    const [y, m, d] = s.split('-')
    return `${d}/${m}/${y}`
  }
  if (period === 'day') return fmt(from)
  return `${fmt(from)} – ${fmt(to)}`
}

// Minutos -> "Xh Ym".
export function fmtMinutes(min) {
  const m = Math.max(0, Math.round(min || 0))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h <= 0) return `${r}m`
  return `${h}h ${String(r).padStart(2, '0')}m`
}
