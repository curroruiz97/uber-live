import { describe, it, expect } from 'vitest'
import { filterRiders } from './AppContext'
import { STATUS_ORDER } from '../config/constants'

// Riders de prueba con los campos que mira filterRiders (status, zone, name).
const RIDERS = [
  { id: '1', name: 'Ana López', status: 'disponible', zone: { id: 'vll-centro' } },
  { id: '2', name: 'Bruno Díaz', status: 'en_ruta', zone: { id: 'vll-centro' } },
  { id: '3', name: 'Carla Ruiz', status: 'en_entrega', zone: { id: 'mad-centro' } },
  { id: '4', name: 'Diego Sanz', status: 'offline', zone: { id: 'mad-centro' } },
  { id: '5', name: 'Elena Mora', status: 'disponible', zone: null },
]

const allStatuses = { statuses: [...STATUS_ORDER], zone: 'all', search: '' }

describe('filterRiders', () => {
  it('sin filtros devuelve todos', () => {
    expect(filterRiders(RIDERS, allStatuses)).toHaveLength(5)
  })

  it('filtra por estado', () => {
    const out = filterRiders(RIDERS, { ...allStatuses, statuses: ['disponible'] })
    expect(out.map((r) => r.id)).toEqual(['1', '5'])
  })

  it('excluye los estados no seleccionados', () => {
    const out = filterRiders(RIDERS, { ...allStatuses, statuses: ['offline'] })
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('4')
  })

  it('filtra por zona', () => {
    const out = filterRiders(RIDERS, { ...allStatuses, zone: 'mad-centro' })
    expect(out.map((r) => r.id)).toEqual(['3', '4'])
  })

  it('un rider sin zona no coincide con una zona concreta', () => {
    const out = filterRiders(RIDERS, { ...allStatuses, zone: 'vll-centro' })
    expect(out.map((r) => r.id)).toEqual(['1', '2'])
  })

  it('busca por nombre sin distinguir mayúsculas/acentos en el caso simple', () => {
    const out = filterRiders(RIDERS, { ...allStatuses, search: 'ruiz' })
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('Carla Ruiz')
  })

  it('recorta espacios de la búsqueda', () => {
    const out = filterRiders(RIDERS, { ...allStatuses, search: '  ana ' })
    expect(out.map((r) => r.id)).toEqual(['1'])
  })

  it('combina estado + zona + búsqueda', () => {
    const out = filterRiders(RIDERS, {
      statuses: ['disponible'],
      zone: 'vll-centro',
      search: 'a',
    })
    expect(out.map((r) => r.id)).toEqual(['1'])
  })

  it('sin estados seleccionados no devuelve nada', () => {
    expect(filterRiders(RIDERS, { ...allStatuses, statuses: [] })).toHaveLength(0)
  })
})
