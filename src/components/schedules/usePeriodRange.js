import { useMemo, useState } from 'react'
import { periodRange, periodLabel, isoLocal } from '../../utils/period'

function addDaysIso(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return isoLocal(dt)
}
function fmtEs(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Ventana inmediatamente anterior y de la misma longitud que [from,to] (para deltas).
export function previousWindow({ from, to }) {
  if (!from || !to) return { from, to }
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const len = Math.round((new Date(ty, tm - 1, td) - new Date(fy, fm - 1, fd)) / 86400000) + 1
  const prevTo = addDaysIso(from, -1)
  const prevFrom = addDaysIso(prevTo, -(len - 1))
  return { from: prevFrom, to: prevTo }
}

const WIDE = { from: '0000-01-01', to: '9999-12-31' }

// Estado de periodo reutilizable: presets (day/week/month/all) + rango personalizado.
export function usePeriodRange(initial = 'week') {
  const [period, setPeriod] = useState(initial)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const range = useMemo(() => {
    if (period === 'all') return WIDE
    if (period === 'custom') {
      const today = isoLocal(new Date())
      let f = customFrom || customTo || today
      let t = customTo || customFrom || today
      if (f > t) {
        const tmp = f
        f = t
        t = tmp
      }
      return { from: f, to: t }
    }
    return periodRange(period)
  }, [period, customFrom, customTo])

  const label = useMemo(() => {
    if (period === 'all') return 'histórico'
    if (period === 'custom') return `${fmtEs(range.from)} – ${fmtEs(range.to)}`
    return periodLabel(period)
  }, [period, range])

  const isFinite = period !== 'all'

  return { period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo, range, label, isFinite }
}
