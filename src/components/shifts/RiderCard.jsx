import { useState } from 'react'
import clsx from 'clsx'
import { ChevronDown, Plus } from 'lucide-react'
import { PLATFORMS, STATES, DAY_INDEX, DAYS } from './platforms'
import ShiftRow from './ShiftRow'
import StateEditor from './StateEditor'

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()
}

// Tarjeta de rider colapsable: cabecera con resumen + cuerpo editable (turnos + estados).
export default function RiderCard({ rider, shifts, absences, showBadge, onAddShift, onUpdateShift, onRemoveShift, onAddAbsence, onUpdateAbsence, onRemoveAbsence }) {
  const [open, setOpen] = useState(false)
  const plat = PLATFORMS[rider.provider] || PLATFORMS.uber
  const sorted = [...shifts].sort((a, b) => DAY_INDEX[a.dia] - DAY_INDEX[b.dia] || a.hora_inicio.localeCompare(b.hora_inicio))
  // Agrupa por día: el día se muestra una vez y sus turnos se apilan debajo.
  const byDay = new Map()
  for (const s of sorted) {
    if (!byDay.has(s.dia)) byDay.set(s.dia, [])
    byDay.get(s.dia).push(s)
  }
  const usedDays = DAYS.filter((d) => byDay.has(d.id))
  const firstFreeDay = (DAYS.find((d) => !byDay.has(d.id)) || DAYS[0]).id

  return (
    <div className={clsx('overflow-hidden rounded-2xl border border-line shadow-elev-1', showBadge ? clsx(plat.tint, 'border-l-4', plat.edge) : 'bg-panel')}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-inset/40">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">{initials(rider.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{rider.name}</p>
          <p className="truncate text-[11px] text-faint">
            {rider.city || '—'}
            {rider.rider_phone ? ` · ${rider.rider_phone}` : ''}
          </p>
        </div>
        {showBadge && <span className={clsx('hidden shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline-flex', plat.badge)}>{plat.label}</span>}
        <span className="flex shrink-0 items-center gap-1">
          {absences.map((a) => {
            const m = STATES[a.tipo]
            return <span key={a.id} title={m?.label} className={clsx('h-2 w-2 rounded-full', m?.dot)} />
          })}
        </span>
        <span className="shrink-0 rounded-full bg-inset px-2 py-0.5 text-[11px] tabular-nums text-muted">{shifts.length}t</span>
        <ChevronDown className={clsx('h-4 w-4 shrink-0 text-faint transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="animate-fade-in space-y-4 border-t border-line p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-faint">Turnos</h4>
              <button onClick={() => onAddShift(rider.name, rider.city, rider.provider, { dia: firstFreeDay, turno: 'manana' })} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line px-2.5 py-1 text-xs font-medium text-muted transition hover:border-accent/50 hover:text-fg">
                <Plus className="h-3.5 w-3.5" /> Añadir turno
              </button>
            </div>
            {usedDays.length === 0 ? (
              <p className="text-xs text-faint">Sin turnos planificados.</p>
            ) : (
              <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {usedDays.map((d) => (
                  <div key={d.id} className="flex gap-3 p-2">
                    <div className="w-20 shrink-0 pt-2 text-sm font-medium text-fg">{d.label}</div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {byDay.get(d.id).map((s) => (
                        <ShiftRow key={s.id} shift={s} hideDay onUpdate={onUpdateShift} onRemove={onRemoveShift} />
                      ))}
                      <button
                        onClick={() => onAddShift(rider.name, rider.city, rider.provider, { dia: d.id, turno: 'tarde' })}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted transition hover:bg-inset hover:text-fg"
                      >
                        <Plus className="h-3 w-3" /> turno
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-faint">Estados</h4>
            <StateEditor riderName={rider.name} city={rider.city} provider={rider.provider} absences={absences} onAdd={onAddAbsence} onUpdate={onUpdateAbsence} onRemove={onRemoveAbsence} />
          </div>
        </div>
      )}
    </div>
  )
}
