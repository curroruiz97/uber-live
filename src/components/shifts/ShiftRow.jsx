import { useState } from 'react'
import clsx from 'clsx'
import { ChevronUp, ChevronDown, Trash2, Check, X } from 'lucide-react'
import { DAYS, PLATFORMS } from './platforms'

// Estilo de campo editable inline coherente con los inputs del proyecto.
const FIELD = 'rounded-lg border border-line bg-inset px-2.5 py-1.5 text-sm text-fg outline-none transition focus:border-accent/60'

// Una fila de turno 100% editable: día, hora inicio/fin y notas inline; reordenar
// (flechas) y eliminar con confirmación en dos pasos.
export default function ShiftRow({ shift, showBadge = false, canReorder = false, isFirst, isLast, onUpdate, onRemove, onMove }) {
  const [confirming, setConfirming] = useState(false)
  const plat = PLATFORMS[shift.plataforma]
  const Icon = plat.Icon

  return (
    <div
      className={clsx(
        'rounded-xl border border-line p-3 shadow-elev-1 transition',
        showBadge ? clsx(plat.tint, 'border-l-4', plat.edge) : 'bg-panel',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {showBadge && (
          <span className={clsx('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold', plat.badge)}>
            <Icon className="h-3.5 w-3.5" />
            {plat.label}
          </span>
        )}

        <select aria-label="Día" value={shift.dia} onChange={(e) => onUpdate(shift.id, { dia: e.target.value })} className={clsx(FIELD, 'w-32')}>
          {DAYS.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>

        <input aria-label="Hora de inicio" type="time" value={shift.horaInicio} onChange={(e) => onUpdate(shift.id, { horaInicio: e.target.value })} className={clsx(FIELD, 'w-[7.5rem] tabular-nums')} />
        <span className="text-faint">–</span>
        <input aria-label="Hora de fin" type="time" value={shift.horaFin} onChange={(e) => onUpdate(shift.id, { horaFin: e.target.value })} className={clsx(FIELD, 'w-[7.5rem] tabular-nums')} />

        <input aria-label="Notas" type="text" value={shift.notas} onChange={(e) => onUpdate(shift.id, { notas: e.target.value })} placeholder="Notas (opcional)" className={clsx(FIELD, 'min-w-[8rem] flex-1')} />

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {canReorder && (
            <>
              <button type="button" onClick={() => onMove(shift.id, 'up')} disabled={isFirst} aria-label="Subir turno" className="tappable rounded-lg p-1.5 text-muted transition hover:bg-inset hover:text-fg disabled:opacity-30">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onMove(shift.id, 'down')} disabled={isLast} aria-label="Bajar turno" className="tappable rounded-lg p-1.5 text-muted transition hover:bg-inset hover:text-fg disabled:opacity-30">
                <ChevronDown className="h-4 w-4" />
              </button>
            </>
          )}

          {confirming ? (
            <div className="flex items-center gap-1">
              <span className="hidden text-xs text-muted sm:inline">¿Eliminar?</span>
              <button type="button" onClick={() => onRemove(shift.id)} aria-label="Confirmar eliminación" className="tappable rounded-lg bg-red-500/10 p-1.5 text-red-600 transition hover:bg-red-500/20 dark:text-red-400">
                <Check className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setConfirming(false)} aria-label="Cancelar" className="tappable rounded-lg p-1.5 text-muted transition hover:bg-inset hover:text-fg">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} aria-label="Eliminar turno" className="rounded-lg p-1.5 text-muted transition hover:bg-red-500/10 hover:text-red-500">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
