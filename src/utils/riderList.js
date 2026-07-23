// Lectura de un listado de riders (Excel .xlsx o CSV/TXT) para darlos de BAJA
// (o, en el futuro, altas). Solo necesita el NOMBRE; opcionalmente teléfono/email.
// Resuelve cada nombre contra las identidades conocidas (roster + actividad + turnos)
// reutilizando el mismo motor de cruce que la vinculación de identidades.
// Puro salvo la lectura del fichero; el import de exceljs es diferido.
import { normName, matchKey, suggestMatches } from './identityMatch'
import { digits } from './glovoDaily'

// Palabras que delatan una fila de CABECERA (no un nombre de persona).
const HEADER_RE = /\b(nombre|rider|riders|name|apellidos?|conductor|driver|empleado|despedid|listado|baja|bajas)\b/i
const PHONE_RE = /(tel[eé]fono|phone|m[oó]vil|tel\b|whatsapp)/i
const EMAIL_RE = /(email|correo|e-mail|mail)/i
const NAME_RE = /(nombre|rider|name|apellidos?|conductor|driver|empleado)/i

// Texto legible de un valor de celda de exceljs (string, número, richText, hyperlink, fórmula).
function cellText(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (v instanceof Date) return ''
  if (typeof v === 'object') {
    if (typeof v.text === 'string') return v.text
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text || '').join('')
    if (v.hyperlink && v.text != null) return String(v.text)
    if ('result' in v) return cellText(v.result)
  }
  return ''
}

// Convierte una matriz de filas (arrays de celdas ya en texto) en la lista de riders.
// Detecta cabecera y columnas de nombre/teléfono/email; si no hay cabecera, usa la col A.
export function rowsToRiders(rows) {
  const clean = (rows || []).map((r) => (r || []).map((c) => String(cellText(c)).trim()))
  if (!clean.length) return { names: [], warnings: [] }

  const header = clean[0] || []
  const hasHeader = header.some((c) => HEADER_RE.test(c))
  let nameCol = 0
  let phoneCol = -1
  let emailCol = -1
  let dataRows = clean

  if (hasHeader) {
    header.forEach((c, i) => {
      if (nameCol === 0 && NAME_RE.test(c)) nameCol = i
      if (phoneCol < 0 && PHONE_RE.test(c)) phoneCol = i
      if (emailCol < 0 && EMAIL_RE.test(c)) emailCol = i
    })
    // Si la cabecera no tenía una columna "nombre" explícita, usamos la primera no vacía.
    if (!NAME_RE.test(header[nameCol] || '')) {
      const firstNonEmpty = header.findIndex((c) => c !== '')
      nameCol = firstNonEmpty >= 0 ? firstNonEmpty : 0
    }
    dataRows = clean.slice(1)
  }

  const out = []
  const seen = new Set()
  for (const row of dataRows) {
    const raw = (row[nameCol] || '').replace(/\s+/g, ' ').trim()
    if (!raw) continue
    if (HEADER_RE.test(raw) && raw.split(' ').length <= 2) continue // línea de título suelta
    const norm = normName(raw)
    if (!norm || seen.has(norm)) continue
    seen.add(norm)
    out.push({
      raw,
      norm,
      phone: phoneCol >= 0 ? (row[phoneCol] || '').trim() || null : null,
      email: emailCol >= 0 ? (row[emailCol] || '').trim() || null : null,
    })
  }
  return { names: out, warnings: [] }
}

// Parsea texto CSV/TXT (una columna de nombres o varias con cabecera).
export function parseRidersFromText(text) {
  const cleanTxt = String(text || '').replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '')
  const lines = cleanTxt.split('\n').filter((l) => l.trim() !== '')
  if (!lines.length) return { names: [], warnings: [] }
  const semis = (lines[0].match(/;/g) || []).length
  const commas = (lines[0].match(/,/g) || []).length
  const tabs = (lines[0].match(/\t/g) || []).length
  const delim = tabs > 0 ? '\t' : semis >= commas ? ';' : ','
  const rows = lines.map((l) => l.split(delim).map((s) => s.replace(/^"|"$/g, '').trim()))
  return rowsToRiders(rows)
}

// Lee un fichero .xlsx (primera hoja). Import diferido de exceljs.
async function parseXlsx(file) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets[0]
  if (!ws) return { names: [], warnings: ['El Excel no tiene hojas.'] }
  const rows = []
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals = []
    row.eachCell({ includeEmpty: true }, (c) => { vals.push(c.value) })
    rows.push(vals)
  })
  return rowsToRiders(rows)
}

// Punto de entrada: dado un File del navegador, devuelve { names, warnings }.
export async function parseRiderFile(file) {
  const name = String(file?.name || '').toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) return parseXlsx(file)
  const text = await file.text()
  return parseRidersFromText(text)
}

// Construye la lista de candidatos (identidades conocidas) para el cruce, uniendo
// roster (con teléfono) + actividad (rider_daily_stats) + turnos (shift_plans).
// Los nombres de turno sin teléfono reciben una clave sintética `name:<norm>`.
export function buildRiderCandidates({ roster = [], rawStats = [], shiftPlans = [] } = {}) {
  const byKey = new Map()
  const add = (riderKey, name, phone) => {
    const nm = String(name || '').trim()
    if (!nm) return
    const key = riderKey ? String(riderKey) : `name:${matchKey(nm)}`
    if (key === 'name:') return
    const prev = byKey.get(key)
    if (!prev) byKey.set(key, { rider_key: key, name: nm, phone: phone || null })
    else if (!prev.phone && phone) prev.phone = phone
  }
  for (const r of roster) add(r.riderKey, r.name, r.phone)
  const seenStat = new Set()
  for (const s of rawStats) {
    if (!s.rider_key || seenStat.has(s.rider_key)) continue
    seenStat.add(s.rider_key)
    add(s.rider_key, s.driver_name, s.driver_phone)
  }
  for (const s of shiftPlans) add(s.rider_key || null, s.rider_name, s.rider_phone)
  return [...byKey.values()]
}

// Resuelve los nombres subidos contra los candidatos. Cruza por teléfono si viene,
// si no por nombre (exacto o subconjunto de tokens). Devuelve las tres categorías.
export function resolveRiderNames(parsed, candidates) {
  const byKey = new Map((candidates || []).map((c) => [String(c.rider_key), c]))
  const matched = []
  const ambiguous = []
  const unmatched = []
  const needName = []
  const needSrc = []

  for (const src of parsed || []) {
    const ph = src.phone ? digits(src.phone) : ''
    if (ph && byKey.has(ph)) {
      const c = byKey.get(ph)
      matched.push({ raw: src.raw, phone: src.phone || null, email: src.email || null, match: { rider_key: c.rider_key, name: c.name, phone: c.phone, method: 'phone', confidence: 1 } })
    } else {
      needName.push({ rider_name: src.raw })
      needSrc.push(src)
    }
  }

  const res = suggestMatches(needName, candidates)
  res.forEach((r, i) => {
    const src = needSrc[i]
    const item = { raw: src.raw, phone: src.phone || null, email: src.email || null }
    if (r.best) matched.push({ ...item, match: r.best })
    else if (r.suggestions && r.suggestions.length) ambiguous.push({ ...item, options: r.suggestions })
    else unmatched.push(item)
  })
  return { matched, ambiguous, unmatched }
}

// Construye el registro de baja para el RPC exclude_riders a partir de un nombre + su
// match elegido (o null si se da de baja solo por nombre). Descarta la clave sintética.
export function toExclusionRecord(displayName, match, reason = 'despedido') {
  const rk = match && match.rider_key && !String(match.rider_key).startsWith('name:') ? String(match.rider_key) : null
  const systemName = (match && match.name) || displayName
  return {
    name_norm: matchKey(systemName),
    rider_key: rk,
    display_name: systemName,
    reason,
  }
}
