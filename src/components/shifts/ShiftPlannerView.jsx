import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { CalendarDays, Plus, CalendarClock } from 'lucide-react'
import { selection } from '../../native/haptics'
import { useShiftPlanner } from './useShiftPlanner'
import { DAY_INDEX, PLATFORMS, PLATFORM_IDS } from './platforms'
import ShiftRow from './ShiftRow'

const TABS = [
  { id: 'uber', label: 'Uber' },
  { id: 'glovo', label: 'Glovo' },
  { id: 'todos', label: 'Todos' },
]

function AddButton({ plataforma, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-sm font-medium text-muted transition hover:border-accent/50 hover:text-fg"
    >
      <Plus className="h-4 w-4" /> Añadir turno {PLATFORMS[plataforma].label}
    </button>
  )
}

// Estado vacío con ilustración y CTA para crear el primer turno.
function EmptyShifts({ onAdd, plataforma }) {
  return (
    <div className="flex animate-fade-in flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-panel/50 px-4 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-inset text-faint">
        <CalendarClock className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-fg">Aún no hay turnos</p>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">
          Crea el primer turno {plataforma ? `de ${PLATFORMS[plataforma].label}` : ''} y edítalo directamente aquí: día, horas y notas.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {(plataforma ? [plataforma] : PLATFORM_IDS).map((p) => (
          <AddButton key={p} plataforma={p} onClick={() => onAdd(p)} />
        ))}
      </div>
    </div>
  )
}

export default function ShiftPlannerView() {
  const [tab, setTab] = useState('uber')
  const { shifts, byPlatform, ready, addShift, updateShift, removeShift, moveShift } = useShiftPlanner()

  // Vista combinada ("Todos"): ordenada por día (lun→dom) y luego por hora de inicio.
  const combined = useMemo(
    () => [...shifts].sort((a, b) => DAY_INDEX[a.dia] - DAY_INDEX[b.dia] || a.horaInicio.localeCompare(b.horaInicio)),
    [shifts],
  )

  const single = tab === 'uber' || tab === 'glovo'
  const list = single ? byPlatform[tab] : combined

  return (
    <div className="space-y-4">
      {/* Cabecera de la sección */}
      <div className="overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-accent/10 via-panel to-panel p-4 shadow-elev-1 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <CalendarDays className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-fg">Horarios</h2>
            <p className="text-xs text-muted">Planifica y edita los turnos semanales de Uber y Glovo. Los cambios se guardan automáticamente.</p>
          </div>
          {ready && (
            <span className="ml-auto hidden shrink-0 items-center rounded-full border border-line bg-panel/60 px-2.5 py-1 text-[11px] text-muted sm:inline-flex">
              <span className="font-semibold tabular-nums text-fg">{shifts.length}</span>&nbsp;turnos
            </span>
          )}
        </div>
      </div>

      {/* Pestañas: dropdown en móvil, segmented a ancho completo en escritorio */}
      <div>
        <select
          value={tab}
          onChange={(e) => {
            selection()
            setTab(e.target.value)
          }}
          aria-label="Plataforma"
          className="w-full rounded-lg border border-line bg-inset px-3 py-2.5 text-sm font-medium text-fg outline-none focus:border-accent/60 sm:hidden"
        >
          {TABS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>

        <div className="hidden w-full grid-cols-3 gap-1.5 rounded-xl bg-inset p-1.5 sm:grid">
          {TABS.map((t) => {
            const on = tab === t.id
            const plat = PLATFORMS[t.id]
            const Icon = plat?.Icon
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (t.id !== tab) {
                    selection()
                    setTab(t.id)
                  }
                }}
                aria-pressed={on}
                className={clsx(
                  'flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition',
                  on ? 'bg-panel text-fg shadow-sm ring-1 ring-line' : 'text-muted hover:bg-panel/50 hover:text-fg',
                )}
              >
                {Icon && <Icon className="h-5 w-5" />}
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Contenido con animación suave al cambiar de pestaña (re-monta por key) */}
      <div key={tab} className="animate-fade-in space-y-3">
        {!ready ? null : list.length === 0 ? (
          <EmptyShifts onAdd={addShift} plataforma={single ? tab : null} />
        ) : (
          <>
            {list.map((s, i) => (
              <ShiftRow
                key={s.id}
                shift={s}
                showBadge={!single}
                canReorder={single}
                isFirst={i === 0}
                isLast={i === list.length - 1}
                onUpdate={updateShift}
                onRemove={removeShift}
                onMove={moveShift}
              />
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              {(single ? [tab] : PLATFORM_IDS).map((p) => (
                <AddButton key={p} plataforma={p} onClick={() => addShift(p)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
