import { useEffect, useRef, useState } from 'react'

// Anima el cambio de un valor numérico (count-up) con easing suave.
export default function CountUp({ value, decimals = 0, duration = 550, className }) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (from === to) return undefined
    const start = performance.now()
    cancelAnimationFrame(rafRef.current)

    const step = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (to - from) * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  const formatted =
    decimals > 0
      ? Number(display).toFixed(decimals)
      : Math.round(display).toLocaleString('es-ES')

  return <span className={className}>{formatted}</span>
}
