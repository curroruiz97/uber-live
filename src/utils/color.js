// Conversión entre hex (#rrggbb) y el triplete "R G B" que usan las variables CSS
// del tema (--c-accent: 249 115 22). Permite el selector de color de marca.
export function hexToTriplet(hex) {
  const h = String(hex || '').replace('#', '').trim()
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (n.length !== 6) return null
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return null
  return `${r} ${g} ${b}`
}

export function tripletToHex(triplet) {
  const parts = String(triplet || '').trim().split(/\s+/).map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return '#000000'
  const to = (x) => Math.max(0, Math.min(255, x | 0)).toString(16).padStart(2, '0')
  return `#${to(parts[0])}${to(parts[1])}${to(parts[2])}`
}

// Aclara un triplete (para derivar la variante oscura del acento, más viva sobre negro).
export function lighten(triplet, amt = 0.14) {
  const parts = String(triplet || '').trim().split(/\s+/).map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return triplet
  const L = (x) => Math.round(x + (255 - x) * amt)
  return `${L(parts[0])} ${L(parts[1])} ${L(parts[2])}`
}

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x))

export function tripletToRgbArr(t) {
  const p = String(t || '').trim().split(/\s+/).map(Number)
  return p.length === 3 && !p.some(Number.isNaN) ? p : [0, 0, 0]
}
export function rgbArrToTriplet([r, g, b]) {
  return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`
}

// RGB (0-255) -> HSV (h 0-360, s/v 0-1)
export function rgbToHsv(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}
// HSV -> RGB (0-255)
export function hsvToRgb(h, s, v) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) { r = c; g = x } else if (h < 120) { r = x; g = c } else if (h < 180) { g = c; b = x } else if (h < 240) { g = x; b = c } else if (h < 300) { r = x; b = c } else { r = c; b = x }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}
export function tripletToHsv(t) {
  const [r, g, b] = tripletToRgbArr(t)
  return rgbToHsv(r, g, b)
}
export function hsvToTriplet(h, s, v) {
  return rgbArrToTriplet(hsvToRgb(h, s, v))
}

// Luminancia relativa -> ¿texto blanco o negro encima de este color?
export function readableOn(triplet) {
  const [r, g, b] = tripletToRgbArr(triplet)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#18181b' : '#ffffff'
}
