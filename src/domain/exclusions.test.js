import { describe, it, expect } from 'vitest'
import {
  buildExclusionSets,
  isRiderExcluded,
  filterExcludedShiftPlans,
  filterExcludedStats,
  filterExcludedRoster,
} from './exclusions'
import { matchKey } from '../utils/identityMatch'

describe('buildExclusionSets', () => {
  it('reúne rider_key y name_norm de exclusiones activas', () => {
    const sets = buildExclusionSets([
      { name_norm: 'JUAN PEREZ', rider_key: '34611222333', active: true },
      { name_norm: 'ANA LOPEZ', rider_key: null, active: true },
    ])
    expect(sets.keys.has('34611222333')).toBe(true)
    expect(sets.names.has('JUAN PEREZ')).toBe(true)
    expect(sets.names.has('ANA LOPEZ')).toBe(true)
  })

  it('ignora exclusiones con active=false (restauradas)', () => {
    const sets = buildExclusionSets([
      { name_norm: 'JUAN PEREZ', rider_key: '34611222333', active: false },
    ])
    expect(sets.keys.size).toBe(0)
    expect(sets.names.size).toBe(0)
  })

  it('active undefined cuenta como activa', () => {
    const sets = buildExclusionSets([{ name_norm: 'JUAN PEREZ' }])
    expect(sets.names.has('JUAN PEREZ')).toBe(true)
  })

  it('tolera entradas nulas y arrays vacíos', () => {
    expect(buildExclusionSets(null).names.size).toBe(0)
    expect(buildExclusionSets([null, undefined]).names.size).toBe(0)
  })
})

describe('isRiderExcluded', () => {
  const sets = buildExclusionSets([
    { name_norm: matchKey('José Juan Giménez Pérez'), rider_key: '34611222333', active: true },
  ])

  it('cruza por rider_key (teléfono)', () => {
    expect(isRiderExcluded('34611222333', 'Cualquier Nombre', sets)).toBe(true)
  })

  it('cruza por nombre normalizado aunque cambien acentos/mayúsculas', () => {
    expect(isRiderExcluded(null, 'JOSE JUAN GIMENEZ PEREZ', sets)).toBe(true)
    expect(isRiderExcluded('otro', 'josé juan giménez pérez', sets)).toBe(true)
  })

  it('no excluye a quien no está en los conjuntos', () => {
    expect(isRiderExcluded('99999', 'Otra Persona', sets)).toBe(false)
  })

  it('sin sets devuelve false', () => {
    expect(isRiderExcluded('34611222333', 'x', null)).toBe(false)
  })
})

describe('filtros de lectura', () => {
  const sets = buildExclusionSets([
    { name_norm: matchKey('Juan Perez'), rider_key: '34600000001', active: true },
  ])

  it('filterExcludedShiftPlans quita turnos por nombre o teléfono', () => {
    const rows = [
      { rider_name: 'JUAN PEREZ', rider_key: null },
      { rider_name: 'Otro', rider_key: '34600000001' },
      { rider_name: 'Ana', rider_key: '34600000009' },
    ]
    const out = filterExcludedShiftPlans(rows, sets)
    expect(out).toHaveLength(1)
    expect(out[0].rider_name).toBe('Ana')
  })

  it('filterExcludedStats quita actividad por driver_name o rider_key', () => {
    const rows = [
      { driver_name: 'Juan Perez', rider_key: '34600000001' },
      { driver_name: 'Ana', rider_key: '34600000009' },
    ]
    const out = filterExcludedStats(rows, sets)
    expect(out).toHaveLength(1)
    expect(out[0].driver_name).toBe('Ana')
  })

  it('filterExcludedRoster usa clave camelCase riderKey', () => {
    const rows = [
      { name: 'Juan Perez', riderKey: null },
      { name: 'Ana', riderKey: '34600000009' },
    ]
    const out = filterExcludedRoster(rows, sets)
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('Ana')
  })

  it('con conjuntos vacíos devuelve las listas intactas (mismo contenido)', () => {
    const empty = buildExclusionSets([])
    const rows = [{ rider_name: 'A' }, { rider_name: 'B' }]
    expect(filterExcludedShiftPlans(rows, empty)).toHaveLength(2)
    expect(filterExcludedStats(rows, empty)).toBe(rows)
    expect(filterExcludedRoster(rows, empty)).toBe(rows)
  })
})
