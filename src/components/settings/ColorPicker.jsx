import { useRef } from 'react'
import { tripletToHsv, hsvToTriplet, tripletToHex, hexToTriplet, clamp } from '../../utils/color'

// Selector de color: área saturación/brillo, slider de matiz, hex y muestra.
// value/onChange usan el triplete "R G B".
export default function ColorPicker({ value, onChange }) {
  const { h, s, v } = tripletToHsv(value)
  const svRef = useRef(null)
  const hueRef = useRef(null)

  function startDrag(ref, apply) {
    return (e) => {
      e.preventDefault()
      const handle = (ev) => {
        const rect = ref.current.getBoundingClientRect()
        apply(rect, ev.clientX, ev.clientY)
      }
      handle(e)
      const up = () => {
        window.removeEventListener('pointermove', handle)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', handle)
      window.addEventListener('pointerup', up)
    }
  }

  const onSV = startDrag(svRef, (rect, cx, cy) => {
    const ns = clamp((cx - rect.left) / rect.width, 0, 1)
    const nv = clamp(1 - (cy - rect.top) / rect.height, 0, 1)
    onChange(hsvToTriplet(h, ns, nv))
  })
  const onHue = startDrag(hueRef, (rect, cx) => {
    const nh = clamp((cx - rect.left) / rect.width, 0, 1) * 360
    onChange(hsvToTriplet(nh, s || 1, v || 1))
  })

  return (
    <div className="w-full select-none">
      {/* Área saturación (x) / brillo (y) */}
      <div
        ref={svRef}
        onPointerDown={onSV}
        className="relative h-32 w-full cursor-crosshair touch-none rounded-lg ring-1 ring-line"
        style={{
          backgroundColor: `hsl(${h} 100% 50%)`,
          backgroundImage: 'linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0))',
        }}
      >
        <div
          className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-black/40"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
        />
      </div>

      {/* Slider de matiz */}
      <div
        ref={hueRef}
        onPointerDown={onHue}
        className="relative mt-2.5 h-3 w-full cursor-pointer touch-none rounded-full ring-1 ring-line"
        style={{ backgroundImage: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
      >
        <div
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-black/40"
          style={{ left: `${(h / 360) * 100}%` }}
        />
      </div>

      {/* Hex + muestra */}
      <div className="mt-2.5 flex items-center gap-2">
        <span className="h-8 w-8 shrink-0 rounded-lg ring-1 ring-line" style={{ backgroundColor: `rgb(${value})` }} />
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-faint">#</span>
          <input
            value={tripletToHex(value).replace('#', '')}
            onChange={(e) => {
              const t = hexToTriplet(e.target.value)
              if (t) onChange(t)
            }}
            maxLength={6}
            className="w-full rounded-lg border border-line bg-inset py-2 pl-6 pr-2.5 font-mono text-sm uppercase text-fg outline-none focus:border-accent/60"
          />
        </div>
      </div>
    </div>
  )
}
