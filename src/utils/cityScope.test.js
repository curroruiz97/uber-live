import { describe, it, expect } from 'vitest'
import { normalizeScope, cityInScope, cityFilterFor } from './cityScope'

describe('normalizeScope', () => {
  it('canoniza, deduplica y descarta vacíos', () => {
    expect(normalizeScope(['Bilbao', 'bilbao', 'TENERIFE'])).toEqual(['BILBAO', 'TENERIFE'])
  })
  it('quita el sufijo de país', () => {
    expect(normalizeScope(['Salamanca, Spain'])).toEqual(['SALAMANCA'])
  })
  it('null/[] => null (sin restricción)', () => {
    expect(normalizeScope(null)).toBeNull()
    expect(normalizeScope([])).toBeNull()
    expect(normalizeScope(['  '])).toBeNull()
  })
})

describe('cityInScope', () => {
  const scope = ['BILBAO', 'TENERIFE']
  it('permite ciudades dentro del ámbito (insensible a mayúsculas/acentos)', () => {
    expect(cityInScope('Bilbao', scope)).toBe(true)
    expect(cityInScope('TENERIFE', scope)).toBe(true)
  })
  it('bloquea ciudades fuera del ámbito', () => {
    expect(cityInScope('Madrid', scope)).toBe(false)
    expect(cityInScope('Zaragoza', scope)).toBe(false)
  })
  it('sin ámbito => todo permitido', () => {
    expect(cityInScope('Madrid', null)).toBe(true)
    expect(cityInScope('Madrid', [])).toBe(true)
  })
  it('con ámbito activo, ciudad desconocida NO se muestra (evita fugas)', () => {
    expect(cityInScope('', scope)).toBe(false)
    expect(cityInScope(null, scope)).toBe(false)
  })
})

describe('cityFilterFor', () => {
  it('devuelve null cuando no hay restricción', () => {
    expect(cityFilterFor(null)).toBeNull()
    expect(cityFilterFor([])).toBeNull()
  })
  it('devuelve un predicado que respeta el ámbito', () => {
    const f = cityFilterFor(['Bilbao'])
    expect(f('BILBAO')).toBe(true)
    expect(f('Madrid')).toBe(false)
    expect(f(null)).toBe(false)
  })
})
