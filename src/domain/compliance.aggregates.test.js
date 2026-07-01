import { describe, it, expect } from 'vitest'
import {
  aggregateCompliance,
  statusBreakdown,
  trendByDate,
  buildRiderStats,
  buildRanking,
  rollupByGranularity,
  deriveAlerts,
} from './compliance'

// Filas diarias con la forma nueva (estados v2 + métricas crudas).
const row = (over = {}) => ({
  riderKey: 'a', name: 'Ana', provider: 'uber', date: '2026-06-01', scheduled: true, attended: true,
  plannedMin: 240, workedMin: 240, compliancePct: 100, status: 'cumple', absenceTipo: null,
  onlineHours: 4, activeHours: 4, openHours: 1, enrouteP2Hours: 1, ontripP3Hours: 1, unavailableHours: 0,
  trips: 10, singleTrips: 8, lateP2: 0, lateP3: 0, accept: 10, reject: 0, cancel: 0, cancelNAF: 0,
  p2Km: 5, p2Min: 50, p3Km: 5, p3Min: 50, totalKm: 10, totalMin: 100, ...over,
})

const rows = [
  row({ riderKey: 'a', date: '2026-06-01', status: 'cumple', compliancePct: 100, activeHours: 4, trips: 10, accept: 9, reject: 1 }),
  row({ riderKey: 'a', date: '2026-06-02', status: 'parcial', compliancePct: 60, workedMin: 144, activeHours: 2.4, trips: 6, accept: 6, reject: 0 }),
  row({ riderKey: 'b', name: 'Beto', provider: 'glovo', date: '2026-06-01', status: 'ausente', attended: false, workedMin: 0, compliancePct: 0, activeHours: 0, trips: 0, accept: 0, reject: 0 }),
  row({ riderKey: 'b', name: 'Beto', provider: 'glovo', date: '2026-06-02', status: 'justificado', attended: false, workedMin: 0, compliancePct: null, activeHours: 0, trips: 0, accept: 0, reject: 0, absenceTipo: 'vacaciones' }),
  row({ riderKey: 'c', name: 'Caro', provider: 'glovo', date: '2026-06-01', scheduled: false, status: 'extra', plannedMin: 0, compliancePct: null, activeHours: 3, trips: 5, accept: 5, reject: 0 }),
]

describe('aggregateCompliance', () => {
  it('asistencia excluye justificados y extras del denominador', () => {
    const a = aggregateCompliance(rows)
    expect(a.programmedDays).toBe(3) // 2 de Ana + 1 ausente de Beto
    expect(a.justifiedDays).toBe(1)
    expect(a.extraDays).toBe(1)
    expect(a.attendancePct).toBe(67) // 2 presentes / 3 programados
  })
  it('tasa de aceptación = accept/(accept+reject)', () => {
    expect(aggregateCompliance([row({ accept: 9, reject: 1 })]).acceptanceRatePct).toBe(90)
  })
  it('productividad = viajes/hora trabajada (workedMin)', () => {
    expect(aggregateCompliance([row({ trips: 10, workedMin: 240 })]).productivity).toBe(2.5)
  })
  it('conjunto vacío devuelve ceros', () => {
    const a = aggregateCompliance([])
    expect(a.attendancePct).toBe(0)
    expect(a.trips).toBe(0)
  })
})

describe('statusBreakdown', () => {
  it('cuenta cada estado v2 y el total', () => {
    const b = statusBreakdown(rows)
    expect(b).toMatchObject({ total: 5, cumple: 1, parcial: 1, ausente: 1, justificado: 1, extra: 1 })
  })
  it('no rompe con lista vacía', () => {
    expect(statusBreakdown([])).toMatchObject({ total: 0, cumple: 0 })
  })
})

describe('trendByDate', () => {
  it('agrupa por fecha en orden ascendente', () => {
    expect(trendByDate(rows).map((d) => d.date)).toEqual(['2026-06-01', '2026-06-02'])
  })
})

describe('buildRiderStats', () => {
  it('una entrada por rider, ordenada por nombre', () => {
    expect(buildRiderStats(rows).map((r) => r.name)).toEqual(['Ana', 'Beto', 'Caro'])
  })
})

describe('buildRanking', () => {
  it('ordena por % de cumplimiento; rider con datos por encima del ausente', () => {
    const r = buildRanking(rows)
    expect(r[0].rank).toBe(1)
    const ana = r.find((x) => x.riderKey === 'a')
    const beto = r.find((x) => x.riderKey === 'b')
    expect(ana.rank).toBeLessThan(beto.rank)
  })
})

describe('rollupByGranularity', () => {
  it('agrupa por mes', () => {
    const m = rollupByGranularity([row({ date: '2026-06-01' }), row({ date: '2026-06-15' }), row({ date: '2026-07-02' })], 'month')
    expect(m.map((b) => b.bucketKey)).toEqual(['2026-06', '2026-07'])
  })
  it('agrupa por semana (lunes)', () => {
    const w = rollupByGranularity([row({ date: '2026-06-01' }), row({ date: '2026-06-03' }), row({ date: '2026-06-08' })], 'week', { week_starts_on: 1 })
    expect(w).toHaveLength(2)
    expect(w[0].bucketKey).toBe('2026-06-01')
  })
})

describe('deriveAlerts', () => {
  it('genera ausencia (critical) y parcial (warning)', () => {
    const al = deriveAlerts(rows)
    const types = al.map((a) => a.type)
    expect(types).toContain('ausente')
    expect(types).toContain('parcial')
    expect(al.find((a) => a.type === 'ausente').severity).toBe('critical')
  })
})
