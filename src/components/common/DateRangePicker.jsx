import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parseISO = (s) => {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1)
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
export const rangeDays = (from, to) => (from && to ? Math.round((parseISO(to) - parseISO(from)) / 86400000) + 1 : from ? 1 : 0)
const fmt = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Selector de rango de fechas estilo Booking: un solo calendario, eliges inicio y luego
// fin (con previsualización al pasar el ratón) y el nº de días se calcula solo.
// La selección en curso se mantiene en un "anchor" interno y onChange({ from, to }) solo
// se dispara cuando el rango está COMPLETO (ambos extremos) o al limpiar (from=to=null).
// Así el componente no depende de cómo persista el padre entre clics.
export default function DateRangePicker({ from, to, onChange, placeholder = 'Selecciona fechas', className, block = false }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const [view, setView] = useState(() => monthStart(parseISO(from) || new Date()))
  const [anchor, setAnchor] = useState(null) // inicio elegido a la espera del fin
  const [hover, setHover] = useState(null)
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const today = new Date()

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const width = 288
    let left = r.left
    if (left + width > window.innerWidth - 8) left = window.innerWidth - 8 - width
    // Si no cabe debajo, lo abrimos hacia arriba.
    const top = r.bottom + 6 + 360 > window.innerHeight ? Math.max(8, r.top - 366) : r.bottom + 6
    setCoords({ top, left: Math.max(8, left) })
  }
  useLayoutEffect(() => {
    if (open) {
      place()
      setAnchor(null)
      setHover(null)
      setView(monthStart(parseISO(from) || new Date()))
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (!btnRef.current?.contains(e.target) && !popRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  const cells = useMemo(() => {
    const first = monthStart(view)
    const off = (first.getDay() + 6) % 7
    const start = new Date(first)
    start.setDate(1 - off)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [view])

  function pick(d) {
    const iso = toISO(d)
    if (!anchor) {
      // Primer clic: fija el inicio y espera el fin (sin emitir aún).
      setAnchor(iso)
      setHover(iso)
    } else {
      // Segundo clic: completa el rango (ordenado) y emite.
      const a = iso < anchor ? iso : anchor
      const b = iso < anchor ? anchor : iso
      setAnchor(null)
      setHover(null)
      onChange({ from: a, to: b })
      setOpen(false)
    }
  }

  // Rango a resaltar: durante la selección usa el anchor + previsualización por hover;
  // ya completado usa los props from/to.
  const selFrom = anchor || from
  const selTo = anchor ? null : to
  const previewEnd = selTo || (anchor ? hover : null)
  const lo = selFrom && previewEnd ? (selFrom < previewEnd ? selFrom : previewEnd) : null
  const hi = selFrom && previewEnd ? (selFrom < previewEnd ? previewEnd : selFrom) : null

  const label = view.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const committed = rangeDays(from, to)
  const display = from ? (to ? `${fmt(from)} – ${fmt(to)}` : fmt(from)) : ''

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx('flex items-center gap-2 rounded-lg border bg-inset px-2.5 py-1.5 text-xs outline-none transition', block && 'w-full', open ? 'border-accent/60' : 'border-line hover:border-accent/40', from ? 'text-fg' : 'text-faint', className)}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{display || placeholder}</span>
        {committed > 0 && <span className="ml-auto shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">{committed}d</span>}
      </button>

      {open && coords && createPortal(
        <div ref={popRef} style={{ position: 'fixed', top: coords.top, left: coords.left, width: 288 }} className="z-[80] animate-scale-in rounded-xl border border-line bg-panel p-3 shadow-elev-3">
          <div className="mb-2 flex items-center justify-between">
            <button onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))} className="rounded-md p-1 text-muted transition hover:bg-inset hover:text-fg" aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-medium capitalize text-fg first-letter:uppercase">{label}</span>
            <button onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))} className="rounded-md p-1 text-muted transition hover:bg-inset hover:text-fg" aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></button>
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] text-faint">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5" onMouseLeave={() => anchor && setHover(anchor)}>
            {cells.map((d, i) => {
              const iso = toISO(d)
              const inMonth = d.getMonth() === view.getMonth()
              const isToday = sameDay(d, today)
              const isEdge = (selFrom && iso === selFrom) || (selTo && iso === selTo)
              const inRange = lo && hi && iso >= lo && iso <= hi
              return (
                <div key={i} className={clsx('flex justify-center', inRange && !isEdge && 'bg-accent/10', inRange && iso === lo && 'rounded-l-md', inRange && iso === hi && 'rounded-r-md')}>
                  <button
                    onClick={() => pick(d)}
                    onMouseEnter={() => {
                      if (anchor) setHover(iso)
                    }}
                    className={clsx(
                      'flex h-7 w-7 items-center justify-center rounded-md text-xs transition',
                      isEdge ? 'bg-accent font-semibold text-white' : isToday ? 'text-fg ring-1 ring-accent/50 hover:bg-inset' : inMonth ? 'text-fg hover:bg-inset' : 'text-faint/40 hover:bg-inset',
                    )}
                  >
                    {d.getDate()}
                  </button>
                </div>
              )
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-xs">
            <span className="text-muted">
              {anchor ? (
                lo && hi && lo !== hi ? (
                  <>
                    <span className="font-semibold text-fg">{rangeDays(lo, hi)}</span> días · elige el fin
                  </>
                ) : (
                  'Elige el fin'
                )
              ) : committed > 0 ? (
                <>
                  <span className="font-semibold text-fg">{committed}</span> {committed === 1 ? 'día' : 'días'}
                </>
              ) : (
                'Elige inicio y fin'
              )}
            </span>
            {(from || anchor) && (
              <button
                onClick={() => {
                  setAnchor(null)
                  setHover(null)
                  onChange({ from: null, to: null })
                }}
                className="rounded-md px-2 py-1 text-muted transition hover:bg-inset hover:text-fg"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
