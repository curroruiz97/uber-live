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
