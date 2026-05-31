import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { pushBackHandler } from '../../native/backStack'

// Hoja inferior (bottom sheet) nativa-style: sube desde abajo, fondo oscuro, cierre
// por backdrop / arrastre hacia abajo / botón atrás. Respeta la safe area inferior.
// Patrón móvil estándar para filtros, acciones y detalles.
export default function Sheet({ open, onClose, title, children, footer }) {
  const [mounted, setMounted] = useState(open)
  const [drag, setDrag] = useState(0)
  const startY = useRef(0)
  const dragging = useRef(false)

  // Mantener montado durante la animación de salida.
  useEffect(() => {
    if (open) setMounted(true)
    else {
      const t = setTimeout(() => setMounted(false), 260)
      return () => clearTimeout(t)
    }
    return undefined
  }, [open])

  // Botón atrás (Android) cierra la hoja.
  useEffect(() => {
    if (!open) return undefined
    return pushBackHandler(() => {
      onClose?.()
      return true
    })
  }, [open, onClose])

  // Bloquea el scroll del fondo mientras está abierta.
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!mounted) return null

  function onTouchStart(e) {
    dragging.current = true
    startY.current = e.touches[0].clientY
  }
  function onTouchMove(e) {
    if (!dragging.current) return
    const dy = e.touches[0].clientY - startY.current
    setDrag(Math.max(0, dy))
  }
  function onTouchEnd() {
    dragging.current = false
    if (drag > 90) onClose?.()
    setDrag(0)
  }

  return (
    <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true">
      <div
        className={clsx(
          'absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <div
        className={clsx(
          'absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-2xl border-t border-line bg-panel shadow-2xl',
          !dragging.current && 'transition-transform duration-300',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
        style={dragging.current ? { transform: `translateY(${drag}px)` } : undefined}
      >
        {/* Asa de arrastre */}
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center pb-1 pt-2"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </div>
        {title && (
          <div className="shrink-0 px-4 pb-2 pt-1">
            <h2 className="text-base font-semibold text-fg">{title}</h2>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">{children}</div>
        {footer && <div className="shrink-0 border-t border-line px-4 py-3 pb-safe">{footer}</div>}
        {!footer && <div className="pb-safe" />}
      </div>
    </div>
  )
}
