import { describe, it, expect } from 'vitest'
import { parseGlovoFilenameTs, aggregateGlovoRows, buildPayloadFromCsv, digits } from './glovoDaily'

describe('parseGlovoFilenameTs', () => {
  it('extrae el timestamp de exportación del nombre', () => {
    expect(parseGlovoFilenameTs('COURIER_DAILY_SAPIENS_20260616_165445.csv')).toBe('2026-06-16T16:54:45')
  })
  it('devuelve null si el nombre no encaja', () => {
    expect(parseGlovoFilenameTs('otro.csv')).toBeNull()
  })
})

describe('digits', () => {
  it('deja solo dígitos', () => {
    expect(digits('+34 611 222 333')).toBe('34611222333')
  })
  it('quita la parte decimal de exportaciones float (".0")', () => {
    expect(digits('698870966.0')).toBe('698870966')
    expect(digits('698870966')).toBe('698870966')
    expect(digits('614563367,0')).toBe('614563367')
  })
})

describe('aggregateGlovoRows · teléfono float', () => {
  it('un teléfono con ".0" se fusiona con su versión limpia (mismo rider_key)', () => {
    const rows = [
      { driver_number: '614563367', datestr: '2026-06-09 00:00:00.000', driver_name: 'ALEX', online_hours: '2' },
      { driver_number: '614563367.0', datestr: '2026-06-09 00:00:00.000', driver_name: 'ALEX', online_hours: '3' },
    ]
    const agg = aggregateGlovoRows(rows)
    expect(agg).toHaveLength(1)
    expect(agg[0].rider_key).toBe('614563367')
    expect(agg[0].online_hours).toBe(5)
  })
})

describe('aggregateGlovoRows', () => {
  it('suma los mercados de un mismo rider/día en una fila', () => {
    const rows = [
      { driver_number: '611', datestr: '2026-06-09 00:00:00.000', driver_name: 'ANA', market_name: 'SANTANDER', online_hours: '2', active_hours: '1.5', num_of_trips: '5', accept_trips: '5' },
      { driver_number: '611', datestr: '2026-06-09 00:00:00.000', driver_name: 'ANA', market_name: 'RESTO DE SANTANDER', online_hours: '1', active_hours: '0.5', num_of_trips: '3', accept_trips: '3' },
    ]
    const agg = aggregateGlovoRows(rows)
    expect(agg).toHaveLength(1)
    expect(agg[0].rider_key).toBe('611')
    expect(agg[0].work_date).toBe('2026-06-09')
    expect(agg[0].online_hours).toBe(3)
    expect(agg[0].active_hours).toBe(2)
    expect(agg[0].num_of_trips).toBe(8)
    expect(agg[0].markets.sort()).toEqual(['RESTO DE SANTANDER', 'SANTANDER'])
  })
  it('separa por día distinto', () => {
    const rows = [
      { driver_number: '611', datestr: '2026-06-09 00:00:00.000', online_hours: '2' },
      { driver_number: '611', datestr: '2026-06-10 00:00:00.000', online_hours: '4' },
    ]
    expect(aggregateGlovoRows(rows)).toHaveLength(2)
  })
  it('ignora filas sin teléfono o sin fecha', () => {
    const rows = [
      { driver_number: '', datestr: '2026-06-09 00:00:00.000', online_hours: '2' },
      { driver_number: '611', datestr: '', online_hours: '2' },
    ]
    expect(aggregateGlovoRows(rows)).toHaveLength(0)
  })
  it('conserva source_exported_at por fila si está presente (histórico)', () => {
    const rows = [{ driver_number: '611', datestr: '2026-06-09 00:00:00.000', online_hours: '2', exported_at: '2026-06-16T16:54:45' }]
    expect(aggregateGlovoRows(rows)[0].source_exported_at).toBe('2026-06-16T16:54:45')
  })
})

describe('buildPayloadFromCsv', () => {
  it('parsea un CSV completo a payload con rango de fechas', () => {
    const csv = [
      'datestr,driver_uuid,driver_name,driver_number,market_name,online_hours,active_hours,num_of_trips',
      '2026-06-09 00:00:00.000,uuid-1,ANA,611,SANTANDER,2,1.5,5',
      '2026-06-10 00:00:00.000,uuid-1,ANA,611,SANTANDER,3,2,7',
    ].join('\n')
    const res = buildPayloadFromCsv(csv, 'COURIER_DAILY_SAPIENS_20260611_065644.csv')
    expect(res.rows).toHaveLength(2)
    expect(res.exportedAt).toBe('2026-06-11T06:56:44')
    expect(res.dateMin).toBe('2026-06-09')
    expect(res.dateMax).toBe('2026-06-10')
    expect(res.riders).toBe(1)
  })
})
