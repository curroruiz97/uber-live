import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import StatusBadge from '../common/StatusBadge'
import Avatar from '../common/Avatar'
import { RiderDetailBody, RiderDetailActions } from './RiderDetailContent'
import { pushBackHandler } from '../../native/backStack'
import { impactLight } from '../../native/haptics'

// Hoja inferior de pantalla completa con animación de entrada/salida.
// El contenido completo hace scroll. Arrastrar el handle hacia abajo cierra.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export default function RiderSheet({ rider, delivery, now, open, onClose }) {
  const sheetRef = useRef(null)
  const drag = useRef(null)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  function requestClose() {
    impactLight()
    setVisible(false)
    setTimeout(() => onClose?.(), 300)
  }

  // Montaje → visible (dos frames para la animación CSS)
  useEffect(() => {
    if (open) {
      setMounted(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
      const t = setTimeout(() => setMounted(false), 320)
      return () => clearTimeout(t)
    }
  }, [open])

  // Bloquea scroll del fondo
  useEffect(() => {
    if (!mounted) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [mounted])

  // Botón atrás de Android
  useEffect(() => {
    if (!open) return undefined
    return pushBackHandler(() => { requestClose(); return true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Drag para cerrar: solo en el handle
  function onTouchStart(e) {
    drag.current = { startY: e.touches[0].clientY, currentY: 0 }
  }
  function onTouchMove(e) {
    if (!drag.current) return
    const dy = e.touches[0].clientY - drag.current.startY
    drag.current.currentY = Math.max(0, dy)
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none'
      sheetRef.current.style.transform = `translateY(${drag.current.currentY}px)`
    }
  }
  function onTouchEnd() {
    if (!drag.current) return
    const dy = drag.current.currentY
    drag.current = null
    if (dy > 120) {
      requestClose()
    } else if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.3s cubic-bezier(.2,.9,.3,1)'
      sheetRef.current.style.transform = 'translateY(0)'
    }
  }

  if (!mounted || !rider) return null

  return (
    <div className="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={requestClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl border-t border-line-strong bg-elevated shadow-elev-3 transition-transform duration-300"
        style={{
          maxHeight: 'calc(100vh - var(--sat, env(safe-area-inset-top)) - 1rem)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transitionTimingFunction: 'cubic-bezier(.2,.9,.3,1)',
        }}
      >
        {/* Handle para arrastrar y cerrar */}
        <div
          className="shrink-0 touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex flex-col items-center pb-1 pt-3">
            <span className="h-1.5 w-10 rounded-full bg-line-strong" />
          </div>
          <div className="flex items-start justify-between gap-3 px-4 pb-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={rider.name} size="lg" />
              <div className="min-w-0">
                <h2 className="truncate text-[17px] font-semibold text-fg">{rider.name}</h2>
                <div className="mt-1.5">
                  <StatusBadge status={rider.status} size="sm" />
                </div>
              </div>
            </div>
            <button
              onClick={requestClose}
              className="tappable -mr-1.5 rounded-full p-2 text-muted transition hover:bg-inset hover:text-fg"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Contenido scrollable con todo el detalle */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4">
          <RiderDetailBody rider={rider} delivery={delivery} now={now} />
        </div>

        {/* Acciones fijas en la base con safe area */}
        <div className="shrink-0 border-t border-line bg-elevated px-4 pt-3" style={{ paddingBottom: 'max(1rem, var(--sab, env(safe-area-inset-bottom)))' }}>
          <RiderDetailActions rider={rider} />
        </div>
      </div>
    </div>
  )
}
