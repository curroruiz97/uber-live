import { describe, it, expect } from 'vitest'
import { normName, repairMojibake, matchKey, suggestMatches, autoLinkPairs } from './identityMatch'

describe('normName', () => {
  it('quita acentos, mayúsculas y colapsa espacios', () => {
    expect(normName('  José  Pérez  ')).toBe('JOSE PEREZ')
    expect(normName('BRICEÑO')).toBe('BRICENO')
  })
})

describe('repairMojibake', () => {
  it('repara UTF-8 leído como Latin-1', () => {
    expect(repairMojibake('PÃ‰REZ')).toBe('PÉREZ')
    expect(repairMojibake('JIMÃ‰NEZ')).toBe('JIMÉNEZ')
  })
  it('no toca texto ya correcto', () => {
    expect(repairMojibake('PÉREZ')).toBe('PÉREZ')
    expect(repairMojibake('ANA LOPEZ')).toBe('ANA LOPEZ')
  })
  it('matchKey normaliza tras reparar', () => {
    expect(matchKey('PÃ‰REZ')).toBe('PEREZ')
  })
})

describe('suggestMatches', () => {
  const candidates = [
    { rider_key: '611', name: 'ANDRE ALEXANDER CUZCANO QUESNAY', phone: '+34611' },
    { rider_key: '622', name: 'BRYAN STEVE MARTINEZ PEREA', phone: '+34622' },
    { rider_key: '633', name: 'JOSE PEREZ FLORES', phone: '+34633' },
  ]
  it('coincidencia exacta normalizada', () => {
    const s = suggestMatches([{ rider_name: 'José Pérez Flores' }], candidates)
    expect(s[0].suggestions[0]).toMatchObject({ rider_key: '633', method: 'auto_exact', confidence: 1 })
  })
  it('coincidencia por subconjunto de tokens (nombre parcial)', () => {
    const s = suggestMatches([{ rider_name: 'ANDRE CUZCANO' }], candidates)
    expect(s[0].suggestions[0].rider_key).toBe('611')
    expect(s[0].suggestions[0].method).toBe('auto_token')
  })
  it('sin coincidencia deja sugerencias vacías', () => {
    expect(suggestMatches([{ rider_name: 'NOMBRE INEXISTENTE TOTAL' }], candidates)[0].suggestions).toHaveLength(0)
  })
})

describe('autoLinkPairs', () => {
  it('empareja solo coincidencias únicas y fuertes', () => {
    const candidates = [
      { rider_key: '611', name: 'ANDRE ALEXANDER CUZCANO QUESNAY', phone: '+34611' },
      { rider_key: '633', name: 'JOSE PEREZ FLORES', phone: '+34633' },
    ]
    const pairs = autoLinkPairs([{ rider_name: 'José Pérez Flores', provider: 'uber' }, { rider_name: 'ANDRE CUZCANO', provider: 'uber' }], candidates)
    expect(pairs).toHaveLength(2)
    const jose = pairs.find((p) => p.rider_key === '633')
    expect(jose).toMatchObject({ method: 'auto_exact', rider_name: 'José Pérez Flores', name_norm: 'JOSE PEREZ FLORES' })
  })
})
