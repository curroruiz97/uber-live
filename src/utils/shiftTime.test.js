import { describe, it, expect } from 'vitest'
import { shiftDelaySeconds, fmtDelay, toHHMM, connectDeltaMin } from './shiftTime'

// Fecha local a una hora concreta de hoy.
function at(h, m, s = 0) {
  const d = new Date()
  d.setHours(h, m, s, 0)
  return d
}

describe('shiftDelaySeconds', () => {
  it('segundos desde el inicio del turno hasta ahora', () => {
    expect(shiftDelaySeconds('10:30', at(10, 47))).toBe(17 * 60)
    expect(shiftDelaySeconds('10:30', at(10, 30, 45))).toBe(45)
  })
  it('0 si aún no debía entrar', () => {
    expect(shiftDelaySeconds('10:30', at(10, 0))).toBe(0)
  })
  it('null si la hora no es válida', () => {
    expect(shiftDelaySeconds('', at(10, 0))).toBeNull()
  })
})

describe('fmtDelay', () => {
  it('segundos sueltos', () => {
    expect(fmtDelay(45)).toBe('45 s')
  })
  it('minutos + segundos conservando segundos', () => {
    expect(fmtDelay(1020)).toBe('17 min (1020 s)')
    expect(fmtDelay(90)).toBe('1 min 30s (90 s)')
  })
  it('horas', () => {
    expect(fmtDelay(3700)).toBe('1h 1m (3700 s)')
  })
})

describe('connectDeltaMin', () => {
  it('positivo si se conecta tarde', () => {
    expect(connectDeltaMin('10:30', at(10, 47))).toBe(17)
  })
  it('negativo si se conecta antes', () => {
    expect(connectDeltaMin('10:30', at(10, 25))).toBe(-5)
  })
  it('null sin datos', () => {
    expect(connectDeltaMin('10:30', null)).toBeNull()
  })
})

describe('toHHMM', () => {
  it('formatea HH:MM', () => {
    expect(toHHMM(at(9, 5))).toBe('09:05')
    expect(toHHMM(at(18, 30))).toBe('18:30')
  })
  it('vacío si inválido', () => {
    expect(toHHMM(null)).toBe('')
  })
})
