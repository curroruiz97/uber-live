import { describe, it, expect } from 'vitest'
import {
  diaOfIso,
  expandSchedule,
  expandAbsences,
  computeDayCompliance,
  buildDaily,
  canonCity,
  isSuspectMetrics,
  DEFAULT_CFG,
} from './compliance'

const cfg = { ...DEFAULT_CFG, min_compliance_pct: 100, presence_threshold_hours: 0.5 }

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
    const r = computeDayCompliance(240, stat({ online_hours: 4 }), cfg)
    expect(r.status).toBe('cumple')
    expect(r.workedMin).toBe(240)
    expect(r.compliancePct).toBe(100)
    expect(r.attended).toBe(true)
  })
  it('parcial por debajo del umbral', () => {
    const r = computeDayCompliance(240, stat({ online_hours: 3 }), cfg)
    expect(r.status).toBe('parcial')
    expect(r.compliancePct).toBe(75)
  })
  it('ausente cuando no llega al umbral de presencia', () => {
    const r = computeDayCompliance(240, stat({ online_hours: 0.2 }), cfg)
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
    const r = computeDayCompliance(0, stat({ online_hours: 3 }), cfg)
    expect(r.status).toBe('extra')
    expect(r.scheduled).toBe(false)
  })
  it('no_programado: ni turno ni actividad relevante', () => {
    expect(computeDayCompliance(0, stat({ online_hours: 0.1 }), cfg).status).toBe('no_programado')
  })
  it('siempre usa horas online para el cálculo', () => {
    const s = stat({ online_hours: 4, active_hours: 2 })
    expect(computeDayCompliance(240, s, cfg).status).toBe('cumple')
    expect(computeDayCompliance(240, s, cfg).workedMin).toBe(240)
  })
  it('rawPct refleja sobre-cumplimiento sin tope', () => {
    const r = computeDayCompliance(240, stat({ online_hours: 6 }), cfg)
    expect(r.compliancePct).toBe(150)
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

describe('isSuspectMetrics', () => {
  it('detecta horas congeladas del CSV de Uber', () => {
    expect(isSuspectMetrics({ num_of_trips: 21, online_hours: 0.11 })).toBe(true)
    expect(isSuspectMetrics({ num_of_trips: 10, online_hours: 0 })).toBe(true)
  })
  it('no marca datos normales', () => {
    expect(isSuspectMetrics({ num_of_trips: 21, online_hours: 8.4 })).toBe(false)
    expect(isSuspectMetrics(null)).toBe(false)
    expect(isSuspectMetrics({ num_of_trips: 0, online_hours: 0 })).toBe(false)
  })
})

describe('canonCity', () => {
  it('unifica mayúsculas, acentos y sufijo de país', () => {
    expect(canonCity('Zaragoza')).toBe('ZARAGOZA')
    expect(canonCity('ZARAGOZA')).toBe('ZARAGOZA')
    expect(canonCity('SALAMANCA, SPAIN')).toBe('SALAMANCA')
    expect(canonCity('Salamanca')).toBe('SALAMANCA')
  })
})

describe('buildDaily', () => {
  const plans = [
    { rider_key: 'a', rider_name: 'ANA', provider: 'uber', city: 'Zaragoza', dia: 'lunes', hora_inicio: '10:00', hora_fin: '14:00' },
    { rider_key: 'a', rider_name: 'ANA', provider: 'uber', city: 'Zaragoza', dia: 'martes', hora_inicio: '10:00', hora_fin: '14:00' },
  ]
  it('cruza turnos con actividad y normaliza la ciudad (sin duplicar)', () => {
    const stats = [stat({ rider_key: 'a', work_date: '2026-06-01', city: 'ZARAGOZA', online_hours: 4 })] // lunes
    const a = buildDaily(plans, [], stats, '2026-06-01', '2026-06-01', cfg).find((r) => r.date === '2026-06-01')
    expect(a.status).toBe('cumple')
    expect(a.city).toBe('ZARAGOZA')
  })
  it('no inventa ausencias fuera de la ventana de actividad del rider', () => {
    // 'a' solo tiene actividad el 06-01; el martes 06-02 queda fuera de [06-01,06-01].
    const stats = [stat({ rider_key: 'a', work_date: '2026-06-01', online_hours: 4 })]
    const daily = buildDaily(plans, [], stats, '2026-06-01', '2026-06-02', cfg)
    expect(daily.find((r) => r.date === '2026-06-02')).toBeUndefined()
  })
  it('marca ausente un día programado SIN actividad dentro de la ventana', () => {
    const stats = [
      stat({ rider_key: 'a', work_date: '2026-06-01', online_hours: 4 }),
      stat({ rider_key: 'a', work_date: '2026-06-08', online_hours: 4 }),
    ]
    const mar = buildDaily(plans, [], stats, '2026-06-01', '2026-06-08', cfg).find((r) => r.date === '2026-06-02')
    expect(mar.status).toBe('ausente') // martes programado, en ventana [06-01,06-08], sin actividad
  })
  it('marca como suspect y excluye del cálculo datos con horas congeladas', () => {
    const stats = [stat({ rider_key: 'a', work_date: '2026-06-01', online_hours: 0.1, num_of_trips: 20 })]
    const daily = buildDaily(plans, [], stats, '2026-06-01', '2026-06-01', cfg)
    const d = daily.find((r) => r.date === '2026-06-01')
    expect(d.suspect).toBe(true)
    expect(d.status).toBe('ausente')
    expect(d.workedMin).toBe(0)
  })
  it('ignora la actividad de riders sin turno (no son de la flota)', () => {
    const stats = [
      stat({ rider_key: 'a', work_date: '2026-06-01', online_hours: 4 }),
      stat({ rider_key: 'z', work_date: '2026-06-01', driver_name: 'AJENO', online_hours: 5 }),
    ]
    const daily = buildDaily(plans, [], stats, '2026-06-01', '2026-06-01', cfg)
    expect(daily.find((r) => r.riderKey === 'z')).toBeUndefined()
  })
})
