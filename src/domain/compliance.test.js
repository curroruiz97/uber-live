import { describe, it, expect } from 'vitest'
import {
  computeDailyCompliance,
  deriveAlerts,
  aggregateCompliance,
  buildRanking,
} from './compliance'

// Turno de referencia: 10:00–14:00 (4h = 240 min) en epoch ms.
const D = '2026-06-01'
const start = Date.parse(`${D}T10:00:00Z`)
const end = Date.parse(`${D}T14:00:00Z`)
const schedule = { plannedStart: start, plannedEnd: end, plannedMinutes: 240 }
const cfg = { grace_in_min: 5, grace_out_min: 5, min_compliance_pct: 90 }

const at = (h, m) => Date.parse(`${D}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`)

describe('computeDailyCompliance', () => {
  it('cumple cuando entra a su hora y trabaja la jornada', () => {
    const r = computeDailyCompliance(schedule, { firstOnlineAt: at(10, 0), lastOnlineAt: at(14, 0), workedMinutes: 240 }, cfg)
    expect(r.attended).toBe(true)
    expect(r.late).toBe(false)
    expect(r.status).toBe('cumple')
    expect(r.compliancePct).toBe(100)
    expect(r.checkInDelayMin).toBe(0)
  })

  it('entrada dentro del margen de cortesía sigue siendo cumple', () => {
    const r = computeDailyCompliance(schedule, { firstOnlineAt: at(10, 4), lastOnlineAt: at(14, 0), workedMinutes: 236 }, cfg)
    expect(r.late).toBe(false)
    expect(r.status).toBe('cumple')
  })

  it('marca tarde cuando supera el margen de entrada', () => {
    const r = computeDailyCompliance(schedule, { firstOnlineAt: at(10, 20), lastOnlineAt: at(14, 0), workedMinutes: 220 }, cfg)
    expect(r.late).toBe(true)
    expect(r.checkInDelayMin).toBe(20)
    expect(r.status).toBe('tarde')
  })

  it('ausente cuando no hay actividad', () => {
    const r = computeDailyCompliance(schedule, null, cfg)
    expect(r.attended).toBe(false)
    expect(r.status).toBe('ausente')
    expect(r.compliancePct).toBe(0)
    expect(r.checkInDelayMin).toBeNull()
  })

  it('incompleto cuando trabaja muy por debajo de lo planificado', () => {
    const r = computeDailyCompliance(schedule, { firstOnlineAt: at(10, 0), lastOnlineAt: at(12, 0), workedMinutes: 120 }, cfg)
    expect(r.attended).toBe(true)
    expect(r.late).toBe(false)
    expect(r.compliancePct).toBe(50)
    expect(r.status).toBe('incompleto')
  })

  it('detecta salida anticipada', () => {
    const r = computeDailyCompliance(schedule, { firstOnlineAt: at(10, 0), lastOnlineAt: at(13, 0), workedMinutes: 180 }, cfg)
    expect(r.checkOutEarlyMin).toBe(60)
    // 75% < 90% -> incompleto
    expect(r.status).toBe('incompleto')
  })

  it('% acotado a 100 aunque trabaje de más', () => {
    const r = computeDailyCompliance(schedule, { firstOnlineAt: at(9, 50), lastOnlineAt: at(14, 30), workedMinutes: 280 }, cfg)
    expect(r.compliancePct).toBe(100)
    expect(r.checkInDelayMin).toBe(-10) // entró antes
  })
})

describe('deriveAlerts', () => {
  it('ausencia genera un aviso crítico', () => {
    const daily = computeDailyCompliance(schedule, null, cfg)
    const alerts = deriveAlerts(daily)
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ type: 'ausencia', severity: 'critical' })
  })

  it('tarde genera aviso de tarde', () => {
    const daily = computeDailyCompliance(schedule, { firstOnlineAt: at(10, 30), lastOnlineAt: at(14, 0), workedMinutes: 210 }, cfg)
    const alerts = deriveAlerts(daily)
    expect(alerts.some((a) => a.type === 'tarde')).toBe(true)
  })

  it('salida anticipada genera su aviso', () => {
    const daily = computeDailyCompliance(schedule, { firstOnlineAt: at(10, 0), lastOnlineAt: at(13, 0), workedMinutes: 180 }, cfg)
    const alerts = deriveAlerts(daily)
    expect(alerts.some((a) => a.type === 'salida_anticipada')).toBe(true)
  })
})

describe('aggregateCompliance', () => {
  it('agrega asistencia, puntualidad y medias', () => {
    const rows = [
      { attended: true, late: false, checkInDelayMin: 0, plannedMinutes: 240, workedMinutes: 240, compliancePct: 100 },
      { attended: true, late: true, checkInDelayMin: 20, plannedMinutes: 240, workedMinutes: 220, compliancePct: 85 },
      { attended: false, late: false, checkInDelayMin: null, plannedMinutes: 240, workedMinutes: 0, compliancePct: 0 },
    ]
    const agg = aggregateCompliance(rows)
    expect(agg.days).toBe(3)
    expect(agg.attendancePct).toBe(67) // 2/3
    expect(agg.punctualityPct).toBe(50) // 1 puntual de 2 asistencias
    expect(agg.absences).toBe(1)
    expect(agg.lates).toBe(1)
    expect(agg.avgCheckInDelayMin).toBe(10) // (0 + 20) / 2
    expect(agg.workedMinutes).toBe(460)
  })

  it('rango vacío devuelve ceros', () => {
    const agg = aggregateCompliance([])
    expect(agg.days).toBe(0)
    expect(agg.attendancePct).toBe(0)
  })
})

describe('buildRanking', () => {
  it('ordena por % de cumplimiento descendente y asigna rank', () => {
    const rows = [
      { riderKey: 'a', name: 'Ana', attended: true, late: false, checkInDelayMin: 0, plannedMinutes: 240, workedMinutes: 240, compliancePct: 100 },
      { riderKey: 'b', name: 'Beto', attended: true, late: true, checkInDelayMin: 30, plannedMinutes: 240, workedMinutes: 180, compliancePct: 60 },
      { riderKey: 'a', name: 'Ana', attended: true, late: false, checkInDelayMin: 2, plannedMinutes: 240, workedMinutes: 240, compliancePct: 100 },
    ]
    const ranking = buildRanking(rows)
    expect(ranking[0].riderKey).toBe('a')
    expect(ranking[0].rank).toBe(1)
    expect(ranking[0].avgCompliancePct).toBe(100)
    expect(ranking[1].riderKey).toBe('b')
    expect(ranking[1].rank).toBe(2)
  })
})
