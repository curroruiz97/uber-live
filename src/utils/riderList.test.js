import { describe, it, expect } from 'vitest'
import {
  rowsToRiders,
  parseRidersFromText,
  buildRiderCandidates,
  resolveRiderNames,
  toExclusionRecord,
} from './riderList'
import { matchKey } from './identityMatch'

describe('rowsToRiders', () => {
  it('lee una sola columna de nombres sin cabecera (col A)', () => {
    const { names } = rowsToRiders([['Juan Perez'], ['Ana Lopez']])
    expect(names.map((n) => n.raw)).toEqual(['Juan Perez', 'Ana Lopez'])
  })

  it('detecta cabecera "RIDER DESPEDIDOS" y no la trata como nombre', () => {
    const { names } = rowsToRiders([['RIDER DESPEDIDOS'], ['Juan Perez'], ['Ana Lopez']])
    expect(names).toHaveLength(2)
    expect(names[0].raw).toBe('Juan Perez')
  })

  it('mapea columnas nombre/teléfono/email por cabecera', () => {
    const { names } = rowsToRiders([
      ['Nombre', 'Teléfono', 'Email'],
      ['Juan Perez', '+34 611 222 333', 'juan@x.com'],
    ])
    expect(names[0]).toMatchObject({ raw: 'Juan Perez', phone: '+34 611 222 333', email: 'juan@x.com' })
  })

  it('deduplica por nombre normalizado', () => {
    const { names } = rowsToRiders([['Juan Perez'], ['JUAN  PEREZ'], ['juan perez']])
    expect(names).toHaveLength(1)
  })

  it('ignora filas vacías', () => {
    const { names } = rowsToRiders([['Juan Perez'], [''], ['   ']])
    expect(names).toHaveLength(1)
  })
})

describe('parseRidersFromText', () => {
  it('CSV con coma y cabecera', () => {
    const txt = 'Nombre,Telefono\nJuan Perez,611222333\nAna Lopez,600111222'
    const { names } = parseRidersFromText(txt)
    expect(names).toHaveLength(2)
    expect(names[1]).toMatchObject({ raw: 'Ana Lopez', phone: '600111222' })
  })

  it('detecta delimitador punto y coma', () => {
    const { names } = parseRidersFromText('Juan Perez;x\nAna Lopez;y')
    expect(names.map((n) => n.raw)).toEqual(['Juan Perez', 'Ana Lopez'])
  })

  it('quita BOM y comillas', () => {
    const { names } = parseRidersFromText('\uFEFF"Juan Perez"\n"Ana Lopez"')
    expect(names.map((n) => n.raw)).toEqual(['Juan Perez', 'Ana Lopez'])
  })
})

describe('buildRiderCandidates', () => {
  it('une roster + actividad + turnos, sintetiza clave name: sin teléfono', () => {
    const cands = buildRiderCandidates({
      roster: [{ riderKey: '34600000001', name: 'Juan Perez', phone: '34600000001' }],
      rawStats: [{ rider_key: '34600000002', driver_name: 'Ana Lopez', driver_phone: '34600000002' }],
      shiftPlans: [{ rider_key: null, rider_name: 'Pedro Gomez', rider_phone: null }],
    })
    const byName = Object.fromEntries(cands.map((c) => [c.name, c]))
    expect(byName['Juan Perez'].rider_key).toBe('34600000001')
    expect(byName['Ana Lopez'].rider_key).toBe('34600000002')
    expect(byName['Pedro Gomez'].rider_key).toBe(`name:${matchKey('Pedro Gomez')}`)
  })

  it('completa teléfono ausente al fusionar por rider_key', () => {
    const cands = buildRiderCandidates({
      roster: [{ riderKey: '34600000001', name: 'Juan', phone: null }],
      shiftPlans: [{ rider_key: '34600000001', rider_name: 'Juan', rider_phone: '34600000001' }],
    })
    expect(cands).toHaveLength(1)
    expect(cands[0].phone).toBe('34600000001')
  })
})

describe('resolveRiderNames', () => {
  const candidates = [
    { rider_key: '34600000001', name: 'Juan Perez', phone: '34600000001' },
    { rider_key: '34600000002', name: 'Ana Lopez', phone: '34600000002' },
  ]

  it('match por nombre exacto', () => {
    const { matched, ambiguous, unmatched } = resolveRiderNames(
      [{ raw: 'JUAN PEREZ', phone: null, email: null }],
      candidates,
    )
    expect(matched).toHaveLength(1)
    expect(matched[0].match.rider_key).toBe('34600000001')
    expect(ambiguous).toHaveLength(0)
    expect(unmatched).toHaveLength(0)
  })

  it('match directo por teléfono aunque el nombre difiera', () => {
    const { matched } = resolveRiderNames(
      [{ raw: 'Nombre Distinto', phone: '+34 600 000 002', email: null }],
      candidates,
    )
    expect(matched[0].match.method).toBe('phone')
    expect(matched[0].match.rider_key).toBe('34600000002')
  })

  it('sin coincidencia va a unmatched', () => {
    const { unmatched } = resolveRiderNames(
      [{ raw: 'Persona Inexistente', phone: null, email: null }],
      candidates,
    )
    expect(unmatched).toHaveLength(1)
    expect(unmatched[0].raw).toBe('Persona Inexistente')
  })
})

describe('toExclusionRecord', () => {
  it('usa el rider_key real y el nombre del sistema', () => {
    const rec = toExclusionRecord('Juan Perez', { rider_key: '34600000001', name: 'Juan Pérez' })
    expect(rec).toEqual({
      name_norm: matchKey('Juan Pérez'),
      rider_key: '34600000001',
      display_name: 'Juan Pérez',
      reason: 'despedido',
    })
  })

  it('descarta la clave sintética name: (deja rider_key null)', () => {
    const rec = toExclusionRecord('Pedro Gomez', { rider_key: `name:${matchKey('Pedro Gomez')}`, name: 'Pedro Gomez' })
    expect(rec.rider_key).toBeNull()
    expect(rec.name_norm).toBe(matchKey('Pedro Gomez'))
  })

  it('sin match usa solo el nombre mostrado', () => {
    const rec = toExclusionRecord('Persona Suelta', null, 'baja')
    expect(rec).toEqual({
      name_norm: matchKey('Persona Suelta'),
      rider_key: null,
      display_name: 'Persona Suelta',
      reason: 'baja',
    })
  })
})
