import { describe, it, expect } from 'vitest'
import {
  diaOfIso,
  expandSchedule,
  expandAbsences,
  computeDayCompliance,
  buildDaily,
  DEFAULT_CFG,
} from './compliance'

const cfg = { ...DEFAULT_CFG, hours_metric: 'active', min_compliance_pct: 100, presence_threshold_hours: 0.5 }

// Fila de actividad real (snake_case, como en rider_daily_stats).
const stat = (over = {}) => ({
  rider_key: 'a', work_date: '2026-06-01', driver_name: 'ANA',
  online_hours: 0, active_hours: 0, num_of_trips: 0, accept_trips: 0, reject_trips: 0,
  cancel_trips: 0, late_p2_trips: 0, late_p3_trips: 0, total_km: 0, ...over,
})

describe('diaOfIso', () => {
  it('2026-06-01 es lunes', () => {
    expect(diaOfIso('2026-06-01')).toBe('lunes')
  })
  it('2026-06-07 es domingo', () => {
    expect(diaOfIso('2026-06-07')).toBe('domingo')
  })
})

describe('computeDayCompliance', () => {
  it('cumple al trabajar el 100% del turno (umbral 100)', () => {
    const r = computeDayCompliance(240, stat({ active_hours: 4 }), cfg)
    expect(r.status).toBe('cumple')
    expect(r.workedMin).toBe(240)
    expect(r.compliancePct).toBe(100)
    expect(r.attended).toBe(true)
  })
  it('parcial por debajo del umbral', () => {
    const r = computeDayCompliance(240, stat({ active_hours: 3 }), cfg)
    expect(r.status).toBe('parcial')
    expect(r.compliancePct).toBe(75)
  })
  it('ausente cuando no llega al umbral de presencia', () => {
    const r = computeDayCompliance(240, stat({ active_hours: 0.2 }), cfg)
    expect(r.status).toBe('ausente')
    expect(r.compliancePct).toBe(0)
    expect(r.attended).toBe(false)
  })
  it('ausente cuando no hay actividad', () => {
    expect(computeDayCompliance(240, null, cfg).status).toBe('ausente')
  })
  it('justificado cuando hay ausencia que cubre el día', () => {
    const r = computeDayCompliance(240, null, cfg, 'vacaciones')
    expect(r.status).toBe('justificado')
    expect(r.absenceTipo).toBe('vacaciones')
  })
  it('extra: trabaja sin turno planificado', () => {
    const r = computeDayCompliance(0, stat({ active_hours: 3 }), cfg)
    expect(r.status).toBe('extra')
    expect(r.scheduled).toBe(false)
  })
  it('no_programado: ni turno ni actividad relevante', () => {
    expect(computeDayCompliance(0, stat({ active_hours: 0.1 }), cfg).status).toBe('no_programado')
  })
  it('respeta la métrica de horas (online vs active)', () => {
    const s = stat({ online_hours: 4, active_hours: 2 })
    expect(computeDayCompliance(240, s, { ...cfg, hours_metric: 'online' }).status).toBe('cumple')
    expect(computeDayCompliance(240, s, { ...cfg, hours_metric: 'active' }).status).toBe('parcial')
  })
  it('rawPct refleja sobre-cumplimiento sin tope', () => {
    const r = computeDayCompliance(240, stat({ active_hours: 6 }), cfg)
    expect(r.compliancePct).toBe(100) // acotado para medias
    expect(r.rawPct).toBe(150)
  })
})

describe('expandSchedule', () => {
  const plans = [
    { rider_key: 'a', rider_name: 'ANA', provider: 'uber', city: 'ZARAGOZA', dia: 'lunes', hora_inicio: '09:00', hora_fin: '14:00' },
    { rider_key: 'a', rider_name: 'ANA', provider: 'uber', city: 'ZARAGOZA', dia: 'lunes', hora_inicio: '16:00', hora_fin: '20:00' },
    { rider_key: null, rider_name: 'SIN VINCULAR', provider: 'uber', city: 'ZARAGOZA', dia: 'lunes', hora_inicio: '09:00', hora_fin: '14:00' },
  ]
  it('suma los turnos del mismo día y excluye los no vinculados', () => {
    const rows = expandSchedule(plans, [], '2026-06-01', '2026-06-01') // lunes
    expect(rows).toHaveLength(1)
    expect(rows[0].riderKey).toBe('a')
    expect(rows[0].plannedMin).toBe(300 + 240)
  })
  it('no programa días sin turno (martes)', () => {
    expect(expandSchedule(plans, [], '2026-06-02', '2026-06-02')).toHaveLength(0)
  })
  it('marca el día cubierto por una ausencia', () => {
    const abs = [{ rider_key: 'a', tipo: 'vacaciones', fecha_inicio: '2026-06-01', dias: 3 }]
    const rows = expandSchedule(plans, abs, '2026-06-01', '2026-06-01')
    expect(rows[0].absenceTipo).toBe('vacaciones')
  })
})

describe('expandAbsences', () => {
  it('expande por dias y por fecha_fin, acotando al rango', () => {
    const m = expandAbsences([{ rider_key: 'a', tipo: 'baja_laboral', fecha_inicio: '2026-06-01', dias: 3 }], '2026-06-01', '2026-06-10')
    expect(m.get('a|2026-06-01')).toBe('baja_laboral')
    expect(m.get('a|2026-06-03')).toBe('baja_laboral')
    expect(m.has('a|2026-06-04')).toBe(false)
  })
})

describe('buildDaily', () => {
  const plans = [{ rider_key: 'a', rider_name: 'ANA', provider: 'uber', city: 'ZARAGOZA', dia: 'lunes', hora_inicio: '10:00', hora_fin: '14:00' }]
  it('cruza turnos con actividad y añade extras', () => {
    const stats = [
      stat({ rider_key: 'a', work_date: '2026-06-01', active_hours: 4 }), // cumple
      stat({ rider_key: 'b', work_date: '2026-06-01', driver_name: 'BETO', active_hours: 5 }), // extra (sin turno)
    ]
    const daily = buildDaily(plans, [], stats, '2026-06-01', '2026-06-01', cfg)
    const a = daily.find((r) => r.riderKey === 'a')
    const b = daily.find((r) => r.riderKey === 'b')
    expect(a.status).toBe('cumple')
    expect(b.status).toBe('extra')
  })
})
