import { useState } from 'react'
import clsx from 'clsx'
import { Plus, Trash2, Check, X, CalendarOff } from 'lucide-react'
import Dropdown from '../common/Dropdown'
import DateRangePicker, { rangeDays } from '../common/DateRangePicker'
import { STATES, STATE_IDS, forecastDays, longDate } from './platforms'

const FIELD = 'rounded-lg border border-line bg-inset px-2 py-1.5 text-sm text-fg outline-none transition focus:border-accent/60'
const TYPE_OPTIONS = STATE_IDS.map((id) => ({ id, label: STATES[id].label }))

function AbsenceRow({ absence, onUpdate, onRemove }) {
  const [confirming, setConfirming] = useState(false)
  const meta = STATES[absence.tipo] || STATES.baja_laboral
  const dias = forecastDays(absence.fecha_inicio, absence.dias)
  const fechaFin = dias.length ? dias[dias.length - 1] : null

  return (
    <div className={clsx('rounded-xl border border-line p-3', meta.chip.replace(/text-[^ ]+/g, ''))}>
      <div className="flex flex-wrap items-center gap-2">
        <Dropdown
          ariaLabel="Tipo de estado"
          value={absence.tipo}
          onChange={(v) => onUpdate(absence.id, { tipo: v })}
          options={TYPE_OPTIONS}
          dotFor={(id) => STATES[id]?.dot}
          className="w-52"
        />
        <DateRangePicker
          from={absence.fecha_inicio || null}
          to={absence.fecha_fin || null}
          onChange={({ from, to }) => onUpdate(absence.id, { fecha_inicio: from, dias: from ? rangeDays(from, to) : null })}
          className="w-56"
        />
        <input aria-label="Nota" type="text" value={absence.nota || ''} onChange={(e) => onUpdate(absence.id, { nota: e.target.value })} placeholder="Nota" className={clsx(FIELD, 'min-w-[6rem] flex-1')} />

        {confirming ? (
          <span className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => onRemove(absence.id)} aria-label="Confirmar" className="tappable rounded-lg bg-red-500/10 p-1.5 text-red-600 transition hover:bg-red-500/20 dark:text-red-400"><Check className="h-4 w-4" /></button>
            <button type="button" onClick={() => setConfirming(false)} aria-label="Cancelar" className="tappable rounded-lg p-1.5 text-muted transition hover:bg-inset hover:text-fg"><X className="h-4 w-4" /></button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} aria-label="Eliminar estado" className="tappable shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-red-500/10 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
        )}
      </div>

      {/* Previsión de días no trabajables (baja/vacaciones/permiso/avería) */}
      {meta.forecast && fechaFin && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
          <CalendarOff className="h-3.5 w-3.5 shrink-0" />
          No trabajable del <span className="font-medium text-fg">{longDate(absence.fecha_inicio)}</span> al <span className="font-medium text-fg">{longDate(fechaFin)}</span>
          <span className="text-faint">· {dias.length} {dias.length === 1 ? 'día' : 'días'}</span>
        </p>
      )}
    </div>
  )
}

// Editor de estados/causas de un rider: tipo (desplegable propio), rango de fechas
// (estilo Booking, días automáticos) y previsión de días no trabajables.
export default function StateEditor({ riderName, city, provider, absences, onAdd, onUpdate, onRemove }) {
  return (
    <div className="space-y-2">
      {absences.length === 0 ? (
        <p className="text-xs text-faint">Sin estados. Añade una baja, vacaciones, permiso, etc.</p>
      ) : (
        absences.map((a) => <AbsenceRow key={a.id} absence={a} onUpdate={onUpdate} onRemove={onRemove} />)
      )}
      <button
        type="button"
        onClick={() => onAdd(riderName, city, provider)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent/50 hover:text-fg"
      >
        <Plus className="h-3.5 w-3.5" /> Añadir estado
      </button>
    </div>
  )
}
