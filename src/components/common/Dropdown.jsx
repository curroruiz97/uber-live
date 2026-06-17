import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { ChevronDown, Check } from 'lucide-react'

// Desplegable propio con el estilo del proyecto (sin el hover azul del <select> nativo).
// El menú se renderiza en un portal (fixed) para no quedar recortado por contenedores
// con overflow-hidden y para situarse por encima de cualquier capa.
// options: [{ id, label }]. dotFor(id) -> clase de color opcional para un punto.
export default function Dropdown({ value, onChange, options, placeholder = 'Seleccionar', className, ariaLabel, dotFor }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const current = options.find((o) => o.id === value)

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.max(r.width, 200)
    let left = r.left
    if (left + width > window.innerWidth - 8) left = window.innerWidth - 8 - width
    setCoords({ top: r.bottom + 6, left: Math.max(8, left), width })
  }
  useLayoutEffect(() => {
    if (open) place()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (!btnRef.current?.contains(e.target) && !menuRef.current?.contains(e.target)) setOpen(false)
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

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'flex items-center justify-between gap-2 rounded-lg border bg-inset px-2.5 py-1.5 text-sm outline-none transition',
          open ? 'border-accent/60' : 'border-line hover:border-accent/40',
          current ? 'text-fg' : 'text-faint',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {current && dotFor && <span className={clsx('h-2 w-2 shrink-0 rounded-full', dotFor(current.id))} />}
          <span className="truncate">{current ? current.label : placeholder}</span>
        </span>
        <ChevronDown className={clsx('h-3.5 w-3.5 shrink-0 text-faint transition-transform', open && 'rotate-180')} />
      </button>

      {open && coords && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width }}
          className="z-[80] max-h-64 animate-scale-in overflow-auto rounded-xl border border-line bg-panel p-1 shadow-elev-3"
        >
          {options.map((o) => {
            const on = o.id === value
            return (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => {
                  onChange(o.id)
                  setOpen(false)
                }}
                className={clsx('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition', on ? 'bg-accent/15 text-fg' : 'text-muted hover:bg-inset hover:text-fg')}
              >
                {dotFor && <span className={clsx('h-2 w-2 shrink-0 rounded-full', dotFor(o.id))} />}
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {on && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
