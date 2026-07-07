import { describe, it, expect } from 'vitest'
import { hMM, hoursToHMM, dayLabel, acceptPct, resultado, buildSeguimiento } from './seguimiento'

describe('formatos', () => {
  it('hMM', () => {
    expect(hMM(0)).toBe('0:00')
    expect(hMM(90)).toBe('1:30')
    expect(hMM(330)).toBe('5:30')
  })
  it('hoursToHMM', () => {
    expect(hoursToHMM(4)).toBe('4:00')
    expect(hoursToHMM(5.5)).toBe('5:30')
  })
  it('dayLabel', () => {
    expect(dayLabel('2026-07-04')).toBe('SÁB 04/07') // 4 jul 2026 = sábado
    expect(dayLabel('2026-07-13')).toBe('LUN 13/07')
  })
  it('acceptPct', () => {
    expect(acceptPct({ accept: 9, reject: 1 })).toBe(90)
    expect(acceptPct({ accept: 0, reject: 0 })).toBeNull()
  })
})

const day = (over = {}) => ({
  riderKey: '600', name: 'ANA', city: 'BILBAO', date: '2026-07-04',
  scheduled: true, attended: true, status: 'cumple', plannedMin: 240, onlineHours: 4,
  accept: 10, reject: 0, cancel: 0, trips: 12, ...over,
})

describe('resultado', () => {
  it('CUMPLE cuando online = plan', () => {
    expect(resultado(day({ onlineHours: 4, plannedMin: 240 }))).toEqual({ text: 'CUMPLE', tone: 'cumple' })
  })
  it('EXCESO cuando hace más horas', () => {
    expect(resultado(day({ onlineHours: 5, plannedMin: 240 }))).toEqual({ text: '+1h EXCESO', tone: 'exceso' })
  })
  it('DÉFICIT cuando hace menos horas', () => {
    expect(resultado(day({ onlineHours: 2.5, plannedMin: 240, status: 'parcial' }))).toEqual({ text: '-1.5h DÉFICIT', tone: 'deficit' })
  })
  it('AUSENTE cuando no se conecta en su turno', () => {
    expect(resultado(day({ status: 'ausente', attended: false, onlineHours: 0 }))).toEqual({ text: 'AUSENTE', tone: 'ausente' })
  })
  it('JUSTIF. cuando hay ausencia justificada', () => {
    expect(resultado(day({ status: 'justificado', absenceTipo: 'vacaciones' }))).toEqual({ text: 'JUSTIF.', tone: 'justif' })
  })
  it('DÍA LIBRE cuando trabaja sin turno', () => {
    expect(resultado(day({ scheduled: false, status: 'extra', plannedMin: 0, onlineHours: 3 }))).toEqual({ text: 'DÍA LIBRE', tone: 'libre' })
  })
  it('vacío cuando ni turno ni trabajo', () => {
    expect(resultado(day({ scheduled: false, attended: false, status: 'no_programado', plannedMin: 0, onlineHours: 0 }))).toEqual({ text: '', tone: 'none' })
  })
})

describe('buildSeguimiento', () => {
  const daily = [
    day({ riderKey: '600', date: '2026-07-04', onlineHours: 4, plannedMin: 240, trips: 12, accept: 10, reject: 0 }),
    day({ riderKey: '600', date: '2026-07-05', onlineHours: 2, plannedMin: 240, status: 'parcial', trips: 5, accept: 4, reject: 1, cancel: 1 }),
    day({ riderKey: '601', name: 'LUIS', city: 'TENERIFE', date: '2026-07-04', status: 'ausente', attended: false, onlineHours: 0, trips: 0, accept: 0, reject: 0 }),
  ]
  const roster = new Map([['600', { name: 'ANA', phone: '+34600', city: 'BILBAO' }]])

  it('una fila por rider, con teléfono del roster y días ordenados', () => {
    const { dates, riders } = buildSeguimiento(daily, roster, { dates: ['2026-07-04', '2026-07-05'], cities: null })
    expect(dates).toEqual(['2026-07-04', '2026-07-05'])
    expect(riders).toHaveLength(2)
    const ana = riders.find((r) => r.name === 'ANA')
    expect(ana.phone).toBe('+34600')
    expect(ana.days).toHaveLength(2)
    expect(ana.summary.planHMM).toBe('8:00') // 240+240 min
    expect(ana.summary.onlineHMM).toBe('6:00') // 4+2 h
    expect(ana.summary.dif).toBe(-2)
    expect(ana.summary.diasOk).toBe(1) // día 04 cumple
    expect(ana.summary.diasInc).toBe(1) // día 05 déficit
    expect(ana.summary.cancel).toBe(1)
    expect(ana.summary.trips).toBe(17)
  })
  it('filtra por ciudad', () => {
    const { riders } = buildSeguimiento(daily, roster, { dates: ['2026-07-04', '2026-07-05'], cities: ['TENERIFE'] })
    expect(riders).toHaveLength(1)
    expect(riders[0].name).toBe('LUIS')
    expect(riders[0].summary.diasInc).toBe(1) // ausente cuenta como incidencia
    expect(riders[0].summary.diasIncTone).toBe('ausente')
  })
})
