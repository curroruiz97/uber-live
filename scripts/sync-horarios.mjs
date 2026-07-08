#!/usr/bin/env node
// Importa los HORARIOS semanales desde el Excel "UBER SAPIENS" (hojas "<CIUDAD> CSV")
// y los sincroniza en shift_plans (modelo actual: día de la semana + turno).
//
// Uso:
//   node scripts/sync-horarios.mjs --dry-run "ruta/UBER SAPIENS.xlsx"   → solo reporta (sin BD)
//   node scripts/sync-horarios.mjs ["ruta/UBER SAPIENS.xlsx"]           → sube a Supabase
//     (si no se pasa ruta, usa GDRIVE_HORARIOS_PATH del .env)
//
// El Excel cambia cada semana con fechas concretas; aquí se mapea cada fecha a su día de
// la semana (una vez por semana) para el planificador actual. Cruce nombre→teléfono contra
// rider_roster. Idempotente: reemplaza los turnos 'uber' de la org.
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import { createClient } from '@supabase/supabase-js'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
const env = {}
try {
  for (const line of readFileSync(join(ROOT, '.env'), 'utf-8').split('\n')) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.+?)\s*$/)
    if (m) env[m[1]] = m[2]
  }
} catch { /* sin .env en dry-run puro */ }
const get = (k) => process.env[k] || env[k] || ''

// Códigos de ciudad del Excel de horarios → nombre canónico (MAYÚSCULAS, sin acentos).
const CITY = { STD: 'SANTANDER', SLM: 'SALAMANCA', TFE: 'TENERIFE', PNA: 'PAMPLONA', ZAR: 'ZARAGOZA', BIL: 'BILBAO', MDC: 'MADRID' }
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

function normName(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}
const digits = (s) => String(s || '').replace(/\D/g, '')

// Normaliza una celda de hora a 'HH:MM' (acepta Date, número Excel o texto '12:30[:00]').
function toHHMM(v) {
  if (v == null || v === '') return null
  if (v instanceof Date) return `${String(v.getUTCHours()).padStart(2, '0')}:${String(v.getUTCMinutes()).padStart(2, '0')}`
  if (typeof v === 'number') { // fracción de día de Excel
    const mins = Math.round(v * 24 * 60)
    return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
  }
  const m = String(v).match(/(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

// Fecha de celda ('YYYY-MM-DD') a partir de Date, número Excel o texto.
function toISODate(v) {
  if (v instanceof Date) return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`
  if (typeof v === 'number') { const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}` }
  const s = String(v || '')
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

function weekdayOf(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

const cell = (row, i) => (row.getCell(i).value ?? '')

// Lee el Excel y devuelve turnos normalizados desde las hojas "* CSV".
export async function parseHorarios(path) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path)
  const shifts = []
  const sheetsRead = []
  for (const ws of wb.worksheets) {
    if (!/CSV\s*$/i.test(ws.name)) continue
    sheetsRead.push(ws.name)
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // cabecera
      const codigo = String(cell(row, 1) || '').trim()
      const rider = String(cell(row, 2) || '').trim()
      const iso = toISODate(cell(row, 3))
      const ini = toHHMM(cell(row, 4))
      const fin = toHHMM(cell(row, 5))
      if (!rider || !iso || !ini || !fin) return
      shifts.push({
        city: CITY[codigo] || codigo || null,
        rider_name: rider,
        work_date: iso,
        dia: weekdayOf(iso),
        turno: ini < '15:00' ? 'manana' : 'tarde',
        hora_inicio: ini,
        hora_fin: fin,
      })
    })
  }
  return { shifts, sheetsRead }
}

function report({ shifts, sheetsRead }) {
  const byCity = {}
  const dates = new Set()
  const riders = new Set()
  for (const s of shifts) {
    byCity[s.city] = (byCity[s.city] || 0) + 1
    dates.add(s.work_date)
    riders.add(normName(s.rider_name))
  }
  const ds = [...dates].sort()
  console.log(`Hojas leídas: ${sheetsRead.join(', ')}`)
  console.log(`Turnos: ${shifts.length} · Riders distintos: ${riders.size} · Ciudades: ${Object.keys(byCity).length}`)
  console.log(`Rango de fechas: ${ds[0]} → ${ds[ds.length - 1]} (${ds.length} días)`)
  console.log('Por ciudad:', Object.entries(byCity).map(([c, n]) => `${c}=${n}`).join(', '))
  console.log('Ejemplos:')
  for (const s of shifts.slice(0, 5)) console.log(`  ${s.city} · ${s.rider_name} · ${s.work_date} (${s.dia}/${s.turno}) ${s.hora_inicio}-${s.hora_fin}`)
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const path = args.find((a) => !a.startsWith('--')) || get('GDRIVE_HORARIOS_PATH')
  if (!path) { console.error('Falta la ruta del Excel (argumento o GDRIVE_HORARIOS_PATH en .env)'); process.exit(1) }

  const parsed = await parseHorarios(path)
  report(parsed)
  if (dryRun) { console.log('\n[dry-run] No se ha escrito nada en la base de datos.'); return }

  // ---- Subida a Supabase (cruce nombre→teléfono + reemplazo de turnos 'uber') ----
  const SUPABASE_URL = get('VITE_SUPABASE_URL') || get('SUPABASE_URL')
  const SUPABASE_KEY = get('VITE_SUPABASE_ANON_KEY') || get('SUPABASE_ANON_KEY')
  const EMAIL = get('SYNC_EMAIL'); const PASSWORD = get('SYNC_PASSWORD')
  if (!SUPABASE_URL || !SUPABASE_KEY || !EMAIL || !PASSWORD) { console.error('Faltan credenciales en .env (VITE_SUPABASE_URL/ANON_KEY, SYNC_EMAIL, SYNC_PASSWORD)'); process.exit(1) }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (authErr || !auth.user) { console.error('Login fallido:', authErr?.message); process.exit(1) }
  const { data: mem } = await supabase.from('org_members').select('org_id').order('created_at', { ascending: true }).limit(1).maybeSingle()
  const orgId = mem?.org_id
  if (!orgId) { console.error('El usuario no pertenece a ninguna organización'); process.exit(1) }

  const { data: roster } = await supabase.from('rider_roster').select('name, phone').eq('org_id', orgId)
  const phoneByName = new Map((roster || []).filter((r) => r.phone).map((r) => [normName(r.name), r.phone]))
  const rows = parsed.shifts.map((s) => {
    const phone = phoneByName.get(normName(s.rider_name)) || null
    return { org_id: orgId, provider: 'uber', city: s.city, rider_name: s.rider_name, rider_phone: phone, rider_key: phone ? digits(phone) : null, dia: s.dia, turno: s.turno, hora_inicio: s.hora_inicio, hora_fin: s.hora_fin, sort: 0 }
  })
  const matched = rows.filter((r) => r.rider_key).length
  console.log(`\nCruce por teléfono: ${matched}/${rows.length} turnos con rider vinculado.`)

  await supabase.from('shift_plans').delete().eq('org_id', orgId).eq('provider', 'uber')
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('shift_plans').insert(rows.slice(i, i + 500))
    if (error) { console.error(`Error insertando lote ${i}:`, error.message); process.exit(1) }
  }
  console.log(`✓ ${rows.length} turnos sincronizados en shift_plans (org ${orgId}).`)
}

main().catch((e) => { console.error(e); process.exit(1) })
