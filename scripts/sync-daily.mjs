#!/usr/bin/env node
// Auto-importa CSVs de COURIER_DAILY desde la carpeta de Google Drive local.
// Uso: node scripts/sync-daily.mjs [ruta_carpeta]
//   o: npm run sync-daily

import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

// Carga .env manualmente (sin dotenv como dependencia)
const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
const envText = readFileSync(join(ROOT, '.env'), 'utf-8')
const env = {}
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([^#=]+?)\s*=\s*(.+?)\s*$/)
  if (m) env[m[1]] = m[2]
}
const get = (k) => process.env[k] || env[k] || ''

// --- CSV parsing (inline, sin depender de Vite) ---

function detectDelimiter(headerLine) {
  const semis = (headerLine.match(/;/g) || []).length
  const commas = (headerLine.match(/,/g) || []).length
  return semis >= commas ? ';' : ','
}

function parseLine(line, delim) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQ = false
      else cur += ch
    } else if (ch === '"') inQ = true
    else if (ch === delim) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function parseCsv(text) {
  const clean = String(text || '').replace(/\r\n?/g, '\n').replace(/^﻿/, '')
  const lines = clean.split('\n').filter((l) => l.trim() !== '')
  if (!lines.length) return { headers: [], rows: [] }
  const delim = detectDelimiter(lines[0])
  const headers = parseLine(lines[0], delim).map((h) => h.toLowerCase())
  const rows = lines.slice(1).map((line) => {
    const cells = parseLine(line, delim)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = cells[i] ?? '' })
    return obj
  })
  return { headers, rows }
}

// --- Glovo aggregation (inline) ---

const SUM_FIELDS = [
  'online_hours', 'active_hours', 'open_hours', 'enroute_p2_hours', 'ontrip_p3_hours', 'unavailable_hours',
  'num_of_trips', 'single_trips_total', 'late_p2_trips', 'late_p3_trips', 'accept_trips', 'reject_trips',
  'cancel_trips', 'cancel_not_at_fault_trips', 'p2_km', 'p2_min', 'p3_km', 'p3_min', 'total_km', 'total_min',
]
const INT_FIELDS = new Set([
  'num_of_trips', 'single_trips_total', 'late_p2_trips', 'late_p3_trips', 'accept_trips', 'reject_trips',
  'cancel_trips', 'cancel_not_at_fault_trips',
])

function digits(s) {
  return String(s || '').trim().replace(/[.,]\d+$/, '').replace(/\D/g, '')
}
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }

function parseGlovoFilenameTs(name) {
  const m = /_(\d{8})_(\d{6})\.csv$/i.exec(String(name || ''))
  if (!m) return null
  const d = m[1], t = m[2]
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`
}

function aggregateGlovoRows(rows) {
  const map = new Map()
  for (const r of rows || []) {
    const phone = digits(r.driver_number)
    const date = String(r.datestr || '').slice(0, 10)
    if (!phone || !date) continue
    const key = `${phone}|${date}`
    let a = map.get(key)
    if (!a) {
      a = { rider_key: phone, work_date: date, driver_uuid: '', driver_name: '', driver_email: '', driver_phone: '', city: '', city_id: '', form_factor: '', markets: new Set(), source_exported_at: null, sum: {} }
      map.set(key, a)
    }
    for (const f of SUM_FIELDS) a.sum[f] = (a.sum[f] || 0) + num(r[f])
    const mk = String(r.market_name || '').trim()
    if (mk) for (const part of mk.split('|')) if (part.trim()) a.markets.add(part.trim())
    a.driver_uuid = r.driver_uuid || a.driver_uuid
    a.driver_name = r.driver_name || a.driver_name
    a.driver_email = r.driver_email || a.driver_email
    a.driver_phone = r.driver_number || a.driver_phone
    a.city = r.city_name || a.city
    a.city_id = r.city_id || a.city_id
    a.form_factor = r.form_factor || a.form_factor
    if (r.exported_at) a.source_exported_at = r.exported_at
  }
  return [...map.values()].map((a) => {
    const out = {
      rider_key: a.rider_key, work_date: a.work_date, driver_uuid: a.driver_uuid, driver_name: a.driver_name,
      driver_email: a.driver_email, driver_phone: a.driver_phone, city: a.city, city_id: a.city_id,
      form_factor: a.form_factor, markets: [...a.markets],
    }
    for (const f of SUM_FIELDS) {
      const v = a.sum[f] || 0
      out[f] = INT_FIELDS.has(f) ? Math.round(v) : Math.round(v * 10000) / 10000
    }
    if (a.source_exported_at) out.source_exported_at = a.source_exported_at
    return out
  })
}

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// --- Config ---
const SUPABASE_URL = get('VITE_SUPABASE_URL') || get('SUPABASE_URL')
const SUPABASE_KEY = get('VITE_SUPABASE_ANON_KEY') || get('SUPABASE_ANON_KEY')
const EMAIL = get('SYNC_EMAIL')
const PASSWORD = get('SYNC_PASSWORD')
const GDRIVE_PATH = process.argv[2] || get('GDRIVE_DAILY_PATH')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env')
  process.exit(1)
}
if (!EMAIL || !PASSWORD) {
  console.error('Falta SYNC_EMAIL y SYNC_PASSWORD en .env (cuenta Supabase para el sync)')
  process.exit(1)
}
if (!GDRIVE_PATH) {
  console.error('Falta ruta de Google Drive. Pásala como argumento o define GDRIVE_DAILY_PATH en .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (authErr || !auth.user) {
    console.error('Login fallido:', authErr?.message || 'sin usuario')
    process.exit(1)
  }
  console.log(`Autenticado como ${auth.user.email}`)

  const { data: membership } = await supabase.from('org_members').select('org_id').order('created_at', { ascending: true }).limit(1).maybeSingle()
  const orgId = membership?.org_id
  if (!orgId) {
    console.error('El usuario no pertenece a ninguna organización')
    process.exit(1)
  }
  console.log(`Organización: ${orgId}`)

  const { data: imported } = await supabase.from('glovo_imports').select('filename').eq('org_id', orgId)
  const importedSet = new Set((imported || []).map((r) => r.filename))
  console.log(`Archivos ya importados: ${importedSet.size}`)

  let files
  try {
    files = readdirSync(GDRIVE_PATH).filter((f) => /^COURIER_DAILY.*\.csv$/i.test(f)).sort()
  } catch (e) {
    console.error(`No se puede leer la carpeta: ${GDRIVE_PATH}\n${e.message}`)
    process.exit(1)
  }
  const newFiles = files.filter((f) => !importedSet.has(f))
  console.log(`CSVs en carpeta: ${files.length} | Nuevos: ${newFiles.length}`)

  if (!newFiles.length) {
    console.log('Nada que importar.')
    return
  }

  let totalUpserted = 0
  let totalNew = 0
  let totalSkipped = 0
  for (let i = 0; i < newFiles.length; i++) {
    const filename = newFiles[i]
    const filepath = join(GDRIVE_PATH, filename)
    console.log(`[${i + 1}/${newFiles.length}] ${filename}`)

    const text = readFileSync(filepath, 'utf-8')
    const { rows: rawRows } = parseCsv(text)
    const rows = aggregateGlovoRows(rawRows)
    if (!rows.length) {
      console.log('  (vacío, saltando)')
      continue
    }
    const exportedAt = parseGlovoFilenameTs(filename)

    const batches = chunk(rows, 500)
    for (let b = 0; b < batches.length; b++) {
      const { data, error } = await supabase.rpc('import_glovo_daily', {
        p_org: orgId,
        p_rows: batches[b],
        p_exported_at: exportedAt || null,
        p_filename: filename,
      })
      if (error) {
        console.error(`  Error en lote ${b + 1}: ${error.message}`)
        break
      }
      totalUpserted += data?.rows_upserted || 0
      totalNew += data?.new_riders || 0
      totalSkipped += data?.rows_skipped_older || 0
    }
    console.log(`  ${rows.length} filas procesadas`)
  }

  console.log(`\nResumen: ${totalUpserted} filas upserted, ${totalNew} riders nuevos, ${totalSkipped} filas saltadas (más antiguas)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
