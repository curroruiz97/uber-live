import { useRef, useState } from 'react'
import clsx from 'clsx'
import { Loader2, ArrowDown } from 'lucide-react'
import { impactLight } from '../../native/haptics'

// Pull-to-refresh táctil. Solo actúa cuando el scroll está arriba del todo y el gesto
// es claramente vertical hacia abajo. En escritorio no estorba (requiere touch).
const THRESHOLD = 70 // px para disparar
const MAX = 110 // tope visual

export default function PullToRefresh({ onRefresh, children, className }) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const active = useRef(false)
  const fired = useRef(false)

  function onTouchStart(e) {
    if (refreshing) return
    // Solo si estamos arriba del todo de la página.
    const top = window.scrollY === 0 && (document.scrollingElement?.scrollTop ?? 0) === 0
    if (!top) return
    active.current = true
    fired.current = false
    startY.current = e.touches[0].clientY
  }

  function onTouchMove(e) {
    if (!active.current || refreshing) return
    const dy = e.touches[0].clientY - startY.current
    if (dy <= 0) {
      setPull(0)
      return
    }
    // Resistencia: cuesta más cuanto más se estira.
    const dist = Math.min(MAX, dy * 0.5)
    setPull(dist)
    if (!fired.current && dist >= THRESHOLD) {
      fired.current = true
      impactLight()
    }
  }

  async function onTouchEnd() {
    if (!active.current) return
    active.current = false
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true)
      setPull(THRESHOLD)
      try {
        await onRefresh?.()
      } finally {
        setTimeout(() => {
          setRefreshing(false)
          setPull(0)
        }, 450)
      }
    } else {
      setPull(0)
    }
  }

  const ready = pull >= THRESHOLD
  return (
    <div
      className={className}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex items-center justify-center overflow-hidden text-faint"
        style={{
          height: pull,
          transition: active.current ? 'none' : 'height 0.25s ease',
        }}
      >
        {refreshing ? (
          <span className="flex items-center gap-2 text-xs font-medium text-accent">
            <Loader2 className="h-4 w-4 animate-spin" /> Actualizando flota…
          </span>
        ) : pull > 0 ? (
          <span className="flex items-center gap-2 text-xs font-medium">
            <ArrowDown className={clsx('h-4 w-4 transition-transform', ready && 'rotate-180 text-accent')} />
            {ready ? 'Suelta para actualizar' : 'Desliza para actualizar'}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  )
}
