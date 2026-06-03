import { describe, it, expect } from 'vitest'
import { statusBreakdown, trendByDate, buildRiderStats } from './compliance'

// Filas diarias mínimas para probar los agregados (no dependen del cálculo, solo de la forma).
const rows = [
  { riderKey: 'a', name: 'Ana', provider: 'uber', date: '2026-06-01', plannedMinutes: 240, workedMinutes: 240, checkInDelayMin: 0, attended: true, late: false, compliancePct: 100, status: 'cumple' },
  { riderKey: 'a', name: 'Ana', provider: 'uber', date: '2026-06-02', plannedMinutes: 240, workedMinutes: 200, checkInDelayMin: 12, attended: true, late: true, compliancePct: 80, status: 'tarde' },
  { riderKey: 'b', name: 'Beto', provider: 'glovo', date: '2026-06-01', plannedMinutes: 300, workedMinutes: 0, checkInDelayMin: null, attended: false, late: false, compliancePct: 0, status: 'ausente' },
  { riderKey: 'b', name: 'Beto', provider: 'glovo', date: '2026-06-02', plannedMinutes: 300, workedMinutes: 150, checkInDelayMin: 2, attended: true, late: false, compliancePct: 50, status: 'incompleto' },
]

describe('statusBreakdown', () => {
  it('cuenta cada estado y el total', () => {
    const b = statusBreakdown(rows)
    expect(b.total).toBe(4)
    expect(b.cumple).toBe(1)
    expect(b.tarde).toBe(1)
    expect(b.incompleto).toBe(1)
    expect(b.ausente).toBe(1)
  })

  it('no rompe con lista vacía', () => {
    expect(statusBreakdown([])).toEqual({ cumple: 0, tarde: 0, incompleto: 0, ausente: 0, total: 0 })
  })
})

describe('trendByDate', () => {
  it('agrupa por fecha ordenada y promedia el cumplimiento', () => {
    const t = trendByDate(rows)
    expect(t).toHaveLength(2)
    expect(t[0].date).toBe('2026-06-01')
    expect(t[1].date).toBe('2026-06-02')
    // 2026-06-01: cumple 100 + ausente 0 => media 50; asistencia 1/2 = 50%
    expect(t[0].avgCompliancePct).toBe(50)
    expect(t[0].attendancePct).toBe(50)
    expect(t[0].absences).toBe(1)
    expect(t[0].total).toBe(2)
    // 2026-06-02: 80 + 50 => media 65
    expect(t[1].avgCompliancePct).toBe(65)
  })
})

describe('buildRiderStats', () => {
  it('agrega por rider con serie y último estado, ordenado por nombre', () => {
    const meta = new Map([
      ['a', { name: 'Ana', provider: 'uber', phone: '+34600000001', vehicleType: 'Moto' }],
      ['b', { name: 'Beto', provider: 'glovo', phone: '+34600000002', vehicleType: 'Bici' }],
    ])
    const s = buildRiderStats(rows, meta)
    expect(s).toHaveLength(2)
    expect(s[0].name).toBe('Ana')
    expect(s[0].provider).toBe('uber')
    expect(s[0].trend).toEqual([100, 80]) // ordenado por fecha asc
    expect(s[0].lastStatus).toBe('tarde')
    expect(s[0].lastDate).toBe('2026-06-02')
    expect(s[0].days).toBe(2)
    expect(s[1].name).toBe('Beto')
    expect(s[1].absences).toBe(1)
  })

  it('usa el nombre de la fila si no hay meta', () => {
    const s = buildRiderStats(rows)
    const ana = s.find((r) => r.riderKey === 'a')
    expect(ana.name).toBe('Ana')
  })
})
