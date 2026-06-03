// Utilidades CSV puras (sin dependencias): parseo e importación de horarios y
// exportación de reportes. Soporta separador ; o , y comillas básicas.

// Detecta el separador más probable (; típico en España, , en exports US).
function detectDelimiter(headerLine) {
  const semis = (headerLine.match(/;/g) || []).length
  const commas = (headerLine.match(/,/g) || []).length
  return semis >= commas ? ';' : ','
}

// Parsea una línea respetando comillas dobles.
function parseLine(line, delim) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else if (ch === '"') {
        inQ = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQ = true
    } else if (ch === delim) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

// Parsea un CSV completo a { headers, rows } (rows = array de objetos por cabecera).
export function parseCsv(text) {
  const clean = String(text || '').replace(/\r\n?/g, '\n').replace(/^﻿/, '')
  const lines = clean.split('\n').filter((l) => l.trim() !== '')
  if (!lines.length) return { headers: [], rows: [] }
  const delim = detectDelimiter(lines[0])
  const headers = parseLine(lines[0], delim).map((h) => h.toLowerCase())
  const rows = lines.slice(1).map((line) => {
    const cells = parseLine(line, delim)
    const obj = {}
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? ''
    })
    return obj
  })
  return { headers, rows }
}

// Genera y descarga un CSV en el navegador (separador ; para abrir bien en Excel ES).
export function downloadCsv(filename, headers, rows) {
  const delim = ';'
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = headers.map((h) => esc(h.label ?? h)).join(delim)
  const body = rows
    .map((r) => headers.map((h) => esc(typeof h === 'string' ? r[h] : r[h.key] ?? '')).join(delim))
    .join('\n')
  const csv = `﻿${head}\n${body}` // BOM para acentos en Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
