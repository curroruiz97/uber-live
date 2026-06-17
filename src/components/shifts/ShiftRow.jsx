import { useState } from 'react'
import clsx from 'clsx'
import { Trash2, Check, X } from 'lucide-react'
import { DAYS } from './platforms'

const FIELD = 'rounded-lg border border-line bg-inset px-2 py-1.5 text-sm text-fg outline-none transition focus:border-accent/60'

const TURNOS = [
  { id: 'manana', label: 'Mañana' },
  { id: 'tarde', label: 'Tarde' },
]

// Una fila de turno editable inline (turno, hora inicio/fin, notas) + eliminar.
// El día se muestra/edita aquí salvo que hideDay sea true (cuando las filas van agrupadas
// bajo un único día). Al cambiar la hora de inicio se reasigna el turno (mañana < 14:00).
export default function ShiftRow({ shift, onUpdate, onRemove, hideDay = false }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-app/40 p-2">
      {!hideDay && (
        <select aria-label="Día" value={shift.dia} onChange={(e) => onUpdate(shift.id, { dia: e.target.value })} className={clsx(FIELD, 'w-28')}>
          {DAYS.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      )}
      <select aria-label="Turno" value={shift.turno} onChange={(e) => onUpdate(shift.id, { turno: e.target.value })} className={clsx(FIELD, 'w-24')}>
        {TURNOS.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
      <input
        aria-label="Hora de inicio"
        type="time"
        value={shift.hora_inicio}
        onChange={(e) => onUpdate(shift.id, { hora_inicio: e.target.value, turno: Number(e.target.value.slice(0, 2)) < 14 ? 'manana' : 'tarde' })}
        className={clsx(FIELD, 'w-[6.5rem] tabular-nums')}
      />
      <span className="text-faint">–</span>
      <input aria-label="Hora de fin" type="time" value={shift.hora_fin} onChange={(e) => onUpdate(shift.id, { hora_fin: e.target.value })} className={clsx(FIELD, 'w-[6.5rem] tabular-nums')} />
      <input aria-label="Notas" type="text" value={shift.notas || ''} onChange={(e) => onUpdate(shift.id, { notas: e.target.value })} placeholder="Notas" className={clsx(FIELD, 'min-w-[6rem] flex-1')} />

      {confirming ? (
        <span className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => onRemove(shift.id)} aria-label="Confirmar" className="tappable rounded-lg bg-red-500/10 p-1.5 text-red-600 transition hover:bg-red-500/20 dark:text-red-400">
            <Check className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setConfirming(false)} aria-label="Cancelar" className="tappable rounded-lg p-1.5 text-muted transition hover:bg-inset hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} aria-label="Eliminar turno" className="tappable shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-red-500/10 hover:text-red-500">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
