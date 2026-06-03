import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function parseISO(s) {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function monthStart(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function sameDay(a, b) {
  return (
    a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  )
}

export default function DatePicker({ value, onChange, placeholder = 'dd/mm/aaaa', className, block = false }) {
  const selected = parseISO(value)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => monthStart(selected || new Date()))
  const ref = useRef(null)
  const today = new Date()

  useEffect(() => {
    if (open && selected) setView(monthStart(selected))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const cells = useMemo(() => {
    const first = monthStart(view)
    const offset = (first.getDay() + 6) % 7 // semana empieza en lunes
    const start = new Date(first)
    start.setDate(1 - offset)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [view])

  const label = view.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const display = selected
    ? selected.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''

  return (
    <div ref={ref} className={clsx('relative', block && 'w-full', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'flex items-center gap-2 rounded-lg border bg-inset px-2.5 py-1.5 text-xs outline-none transition',
          block && 'w-full',
          open ? 'border-accent/60' : 'border-line hover:border-accent/40',
          selected ? 'text-fg' : 'text-faint',
        )}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0" />
        <span>{display || placeholder}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 animate-scale-in rounded-xl border border-line bg-panel p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
              className="rounded-md p-1 text-muted transition hover:bg-inset hover:text-fg"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium capitalize text-fg first-letter:uppercase">{label}</span>
            <button
              onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
              className="rounded-md p-1 text-muted transition hover:bg-inset hover:text-fg"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] text-faint">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              const inMonth = d.getMonth() === view.getMonth()
              const isToday = sameDay(d, today)
              const isSel = sameDay(d, selected)
              return (
                <button
                  key={i}
                  onClick={() => {
                    onChange(toISO(d))
                    setOpen(false)
                  }}
                  className={clsx(
                    'flex h-7 w-7 items-center justify-center rounded-md text-xs transition',
                    isSel
                      ? 'bg-accent font-semibold text-white'
                      : isToday
                        ? 'text-fg ring-1 ring-accent/50 hover:bg-inset'
                        : inMonth
                          ? 'text-fg hover:bg-inset'
                          : 'text-faint/40 hover:bg-inset',
                  )}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <button
              onClick={() => {
                onChange(toISO(today))
                setOpen(false)
              }}
              className="rounded-md px-2 py-1 text-xs font-medium text-accent transition hover:bg-inset"
            >
              Hoy
            </button>
            {selected && (
              <button
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
                className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-inset hover:text-fg"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
