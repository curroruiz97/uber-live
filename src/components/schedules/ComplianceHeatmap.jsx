import { useMemo } from 'react'
import { STATUS_META } from './statusMeta'
import { isoLocal } from '../../utils/period'

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

// Heatmap tipo calendario (semanas en columnas, días en filas) coloreado por estado.
// rows: [{ date, status, compliancePct }]. weeks = nº de semanas hacia atrás.
export default function ComplianceHeatmap({ rows = [], weeks = 12 }) {
  const byDate = useMemo(() => {
    const m = new Map()
    for (const r of rows) m.set(r.date, r)
    return m
  }, [rows])

  const cols = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dow = (today.getDay() + 6) % 7 // 0 = lunes
    const end = new Date(today)
    end.setDate(today.getDate() + (6 - dow)) // domingo de esta semana
    const start = new Date(end)
    start.setDate(end.getDate() - (weeks * 7 - 1))
    const out = []
    const cur = new Date(start)
    for (let w = 0; w < weeks; w += 1) {
      const days = []
      for (let d = 0; d < 7; d += 1) {
        days.push(new Date(cur))
        cur.setDate(cur.getDate() + 1)
      }
      out.push(days)
    }
    return out
  }, [weeks])

  const now = new Date()

  return (
    <div className="flex gap-1.5">
      <div className="flex flex-col gap-1 pt-0.5 text-[9px] leading-3 text-faint">
        {DOW.map((d, i) => (
          <span key={i} className="flex h-3 items-center">{d}</span>
        ))}
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {cols.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => {
              const iso = isoLocal(day)
              const rec = byDate.get(iso)
              const future = day > now
              const meta = rec ? STATUS_META[rec.status] : null
              return (
                <span
                  key={di}
                  title={rec ? `${iso} · ${meta?.label} · ${rec.compliancePct}%` : iso}
                  className="h-3 w-3 rounded-[3px] ring-1 ring-inset ring-line/40"
                  style={{ backgroundColor: meta ? meta.hex : future ? 'transparent' : 'rgb(var(--c-inset))' }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
