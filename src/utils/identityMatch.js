// Cruce de identidad entre los nombres de los turnos (sin teléfono) y el roster real
// de actividad (con teléfono). Puro y testeable. La clave durable es el teléfono.

// Normaliza un nombre: quita acentos, mayúsculas, deja solo A-Z/0-9 y espacios simples.
// Replica el normName de useShiftPlanner para que el cruce sea consistente.
export function normName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Mapa inverso de los caracteres especiales de Windows-1252 (0x80–0x9F) a su byte,
// para revertir mojibake de UTF-8 leído como CP1252 (p. ej. É -> "Ã‰", siendo "‰" U+2030).
const CP1252_REV = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
}

// Reparación condicional de mojibake (UTF-8 leído como Windows-1252): "PÃ‰REZ" -> "PÉREZ".
// Solo actúa si detecta el marcador típico (Ã/Â), para no romper texto ya correcto.
export function repairMojibake(s) {
  const str = String(s || '')
  if (!/[ÃÂ]/.test(str)) return str
  const bytes = []
  for (const ch of str) {
    const code = ch.charCodeAt(0)
    if (code <= 0xff) bytes.push(code)
    else if (code in CP1252_REV) bytes.push(CP1252_REV[code])
    else return str // carácter no representable en CP1252: no es este tipo de mojibake
  }
  try {
    const dec = new TextDecoder('utf-8', { fatal: false }).decode(Uint8Array.from(bytes))
    return dec.includes('�') ? str : dec
  } catch {
    return str
  }
}

// Clave de cruce: repara mojibake (defensivo) y normaliza.
export function matchKey(s) {
  return normName(repairMojibake(s))
}

const tokensOf = (key) => key.split(' ').filter((t) => t.length > 1)

// Para cada nombre sin vincular, propone candidatos del roster (teléfono+nombre).
// unlinked: [{ rider_name, provider }]. candidates: [{ rider_key, name, phone }].
// Devuelve [{ rider_name, provider, suggestions: [{ rider_key, name, phone, method, confidence }] }].
export function suggestMatches(unlinked, candidates) {
  const cand = (candidates || []).map((c) => ({ ...c, key: matchKey(c.name), tokens: tokensOf(matchKey(c.name)) }))
  const byExact = new Map()
  for (const c of cand) if (c.key && !byExact.has(c.key)) byExact.set(c.key, c)

  return (unlinked || []).map((u) => {
    const key = matchKey(u.rider_name)
    const tokens = tokensOf(key)
    const suggestions = []

    const exact = byExact.get(key)
    if (exact) suggestions.push({ rider_key: exact.rider_key, name: exact.name, phone: exact.phone, method: 'auto_exact', confidence: 1 })

    if (tokens.length) {
      for (const c of cand) {
        if (exact && c.rider_key === exact.rider_key) continue
        const shared = tokens.filter((t) => c.tokens.includes(t)).length
        if (shared >= 2 && (shared === tokens.length || shared === c.tokens.length)) {
          const confidence = Math.round((shared / Math.max(tokens.length, c.tokens.length)) * 100) / 100
          suggestions.push({ rider_key: c.rider_key, name: c.name, phone: c.phone, method: 'auto_token', confidence })
        }
      }
    }
    // Dedup por rider_key, mejor confianza primero.
    const seen = new Set()
    const ranked = suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .filter((s) => (seen.has(s.rider_key) ? false : seen.add(s.rider_key)))
      .slice(0, 5)
    return { rider_name: u.rider_name, provider: u.provider || 'uber', suggestions: ranked }
  })
}

// Empareja automáticamente solo los nombres con UNA única coincidencia inequívoca
// (exacta o por subconjunto total de tokens). La unicidad evita falsos positivos;
// las ambigüedades (>1 candidato) se dejan para el enlace manual.
export function autoLinkPairs(unlinked, candidates) {
  const pairs = []
  for (const u of suggestMatches(unlinked, candidates)) {
    if (u.suggestions.length !== 1) continue
    const s = u.suggestions[0]
    pairs.push({
      provider: u.provider,
      rider_name: u.rider_name,
      name_norm: normName(u.rider_name),
      rider_key: s.rider_key,
      rider_phone: s.phone || null,
      method: s.method,
      confidence: s.confidence,
    })
  }
  return pairs
}
