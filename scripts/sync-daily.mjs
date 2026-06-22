#!/usr/bin/env node
// Auto-importa CSVs de COURIER_DAILY desde la carpeta de Google Drive local.
// Uso: node scripts/sync-daily.mjs [ruta_carpeta]
//   o: npm run sync-daily
//
// Requiere en .env:
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
//   SYNC_EMAIL, SYNC_PASSWORD  (cuenta Supabase con acceso a la org)
//   GDRIVE_DAILY_PATH  (ruta por defecto si no se pasa argumento)

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

// --- Reutiliza las funciones puras del proyecto ---
import { parseCsv } from '../src/utils/csv.js'
import { aggregateGlovoRows, parseGlovoFilenameTs, chunk } from '../src/utils/glovoDaily.js'

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
  // 1. Login
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (authErr || !auth.user) {
    console.error('Login fallido:', authErr?.message || 'sin usuario')
    process.exit(1)
  }
  console.log(`Autenticado como ${auth.user.email}`)

  // 2. Obtener org_id del usuario
  const { data: membership } = await supabase.from('org_members').select('org_id').order('created_at', { ascending: true }).limit(1).maybeSingle()
  const orgId = membership?.org_id
  if (!orgId) {
    console.error('El usuario no pertenece a ninguna organización')
    process.exit(1)
  }
  console.log(`Organización: ${orgId}`)

  // 3. Obtener filenames ya importados
  const { data: imported } = await supabase.from('glovo_imports').select('filename').eq('org_id', orgId)
  const importedSet = new Set((imported || []).map((r) => r.filename))
  console.log(`Archivos ya importados: ${importedSet.size}`)

  // 4. Listar CSVs en la carpeta
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

  // 5. Importar cada archivo nuevo
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
