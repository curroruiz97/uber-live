import { describe, it, expect } from 'vitest'
import { formatRouteTime, formatRelative } from './time'

const MIN = 60_000
const HOUR = 60 * MIN
// Base temporal realista (las funciones tratan 0/null como "sin dato" → '—').
const BASE = 1_700_000_000_000

describe('formatRouteTime', () => {
  it('devuelve — sin inicio', () => {
    expect(formatRouteTime(null, BASE)).toBe('—')
  })

  it('muestra minutos y segundos bajo una hora', () => {
    expect(formatRouteTime(BASE, BASE + 5 * MIN + 7_000)).toBe('5m 07s')
  })

  it('rellena los segundos a dos dígitos', () => {
    expect(formatRouteTime(BASE, BASE + 1 * MIN + 3_000)).toBe('1m 03s')
  })

  it('pasa a horas y minutos a partir de 60 min', () => {
    expect(formatRouteTime(BASE, BASE + 2 * HOUR + 15 * MIN)).toBe('2h 15m')
  })

  it('nunca devuelve negativos si now < startedAt', () => {
    expect(formatRouteTime(BASE + 1000, BASE)).toBe('0m 00s')
  })
})

describe('formatRelative', () => {
  it('segundos', () => {
    expect(formatRelative(BASE, BASE + 30_000)).toBe('hace 30s')
  })
  it('minutos', () => {
    expect(formatRelative(BASE, BASE + 5 * MIN)).toBe('hace 5m')
  })
  it('horas', () => {
    expect(formatRelative(BASE, BASE + 3 * HOUR)).toBe('hace 3h')
  })
  it('— sin timestamp', () => {
    expect(formatRelative(null, BASE)).toBe('—')
  })
})
