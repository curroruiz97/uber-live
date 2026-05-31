import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import StatusBadge from '../common/StatusBadge'
import Avatar from '../common/Avatar'
import { RiderDetailBody, RiderDetailActions } from './RiderDetailContent'
import { pushBackHandler } from '../../native/backStack'
import { impactLight, selection } from '../../native/haptics'

// Hoja inferior arrastrable con snap points (full / half / peek), física de resorte
// al asentar y descarte por velocidad. Solo móvil; el escritorio usa el drawer lateral.
const SNAPS = ['full', 'half', 'peek'] // de más abierto a menos
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export default function RiderSheet({ rider, delivery, now, open, onClose }) {
  const sheetRef = useRef(null)
  const backdropRef = useRef(null)
  const H = useRef(0) // alto de la hoja en px
  const translate = useRef(0) // translateY actual
  const snapIdx = useRef(1) // arranca en "half"
  const drag = useRef(null)
  const [mounted, setMounted] = useState(open)

  function snapY(snap) {
    const h = H.current
    if (snap === 'full') return 0
    if (snap === 'half') return h * 0.45
    if (snap === 'peek') return h * 0.66
    return h // cerrado
  }

  function applyTransform(y, withTransition) {
    const el = sheetRef.current
    if (!el) return
    el.style.transition = withTransition ? 'transform 0.42s var(--ease-spring)' : 'none'
    el.style.transform = `translateY(${y}px)`
    translate.current = y
    const bd = backdropRef.current
    if (bd) {
      const openness = 1 - y / (H.current || 1)
      bd.style.opacity = String(clamp(openness, 0, 1) * 0.6)
    }
  }

  function snapToIndex(idx, haptic = true) {
    const i = clamp(idx, 0, SNAPS.length - 1)
    snapIdx.current = i
    applyTransform(snapY(SNAPS[i]), true)
    if (haptic) selection()
  }

  function requestClose() {
    impactLight()
    applyTransform(H.current, true)
    window.setTimeout(() => onClose?.(), 240)
  }

  // Montaje/desmontaje con animación de salida.
  useEffect(() => {
    if (open) {
      setMounted(true)
      return undefined
    }
    const t = setTimeout(() => setMounted(false), 320)
    return () => clearTimeout(t)
  }, [open])

  // Entrada: mide el alto, parte de "cerrado" y sube a "half".
  useLayoutEffect(() => {
    if (!mounted) return
    const h = sheetRef.current?.offsetHeight || window.innerHeight * 0.92
    H.current = h
    applyTransform(h, false)
    const raf = requestAnimationFrame(() => snapToIndex(1, false))
    return () => cancelAnimationFrame(raf)
  }, [mounted])

  // Bloquea el scroll del fondo mientras está abierta.
  useEffect(() => {
    if (!mounted) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mounted])

  // Botón atrás: baja un snap; en el más bajo, cierra.
  useEffect(() => {
    if (!open) return undefined
    return pushBackHandler(() => {
      if (snapIdx.current < SNAPS.length - 1) snapToIndex(snapIdx.current + 1)
      else requestClose()
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function onPointerDown(e) {
    drag.current = {
      startY: e.clientY,
      startT: translate.current,
      lastY: e.clientY,
      lastT: performance.now(),
      v: 0,
    }
    sheetRef.current?.setPointerCapture?.(e.pointerId)
    applyTransform(translate.current, false)
  }
  function onPointerMove(e) {
    if (!drag.current) return
    const y = clamp(drag.current.startT + (e.clientY - drag.current.startY), 0, H.current)
    applyTransform(y, false)
    const t = performance.now()
    drag.current.v = (e.clientY - drag.current.lastY) / (t - drag.current.lastT + 1)
    drag.current.lastY = e.clientY
    drag.current.lastT = t
  }
  function onPointerUp() {
    if (!drag.current) return
    const v = drag.current.v
    const cur = translate.current
    drag.current = null
    // Proyecta con la velocidad y elige el snap (incluido cerrado) más cercano.
    const adj = cur + v * 130
    const candidates = [
      { i: 0, y: snapY('full') },
      { i: 1, y: snapY('half') },
      { i: 2, y: snapY('peek') },
      { i: 3, y: H.current },
    ]
    const best = candidates.reduce((a, b) => (Math.abs(b.y - adj) < Math.abs(a.y - adj) ? b : a))
    if (best.i === 3) requestClose()
    else snapToIndex(best.i)
  }

  if (!mounted || !rider) return null

  return (
    <div className="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true">
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        style={{ opacity: 0 }}
        onClick={requestClose}
      />
      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 flex h-[92vh] flex-col rounded-t-2xl border-t border-line-strong bg-elevated shadow-elev-3 will-change-transform"
        style={{ transform: 'translateY(100%)' }}
      >
        {/* Zona de arrastre: grabber + cabecera (el cuerpo hace scroll aparte). */}
        <div
          className="shrink-0 touch-none pt-safe"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="flex flex-col items-center pb-1 pt-2">
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          <RiderDetailBody rider={rider} delivery={delivery} now={now} />
        </div>

        <div className="shrink-0 border-t border-line px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <RiderDetailActions rider={rider} />
        </div>
      </div>
    </div>
  )
}
