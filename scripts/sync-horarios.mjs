#!/usr/bin/env node
// Sincroniza los HORARIOS de la app (shift_plans) desde el Google Sheet "UBER SAPIENS"
// (hojas "<CIUDAD> CSV"). Baja la hoja por su enlace público, coge la SEMANA EN CURSO
// (lunes→domingo; si está vacía, la próxima semana con datos) y la vuelca en shift_plans.
// Idempotente: reemplaza los turnos 'uber' de la org en cada ejecución -> al actualizar
// el Excel y re-ejecutar, los horarios de la app quedan al día.
//
// Uso:
//   node scripts/sync-horarios.mjs --dry-run     → solo informa (no escribe en BD)
//   node scripts/sync-horarios.mjs               → baja el Sheet y sincroniza
//   node scripts/sync-horarios.mjs "archivo.xlsx"→ usa un .xlsx local en vez del Sheet
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
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
} catch { /* sin .env */ }
const get = (k) => process.env[k] || env[k] || ''

// ID del Google Sheet de horarios (enlace "cualquiera con el enlace"). Configurable por .env.
const SHEET_ID = get('GSHEET_HORARIOS_ID') || '1ze6IF_Qbu9ifHa8dlEcKdsNWPXfHExsfiWpCRm8qVg0'

// Códigos de ciudad del Excel -> nombre canónico (MAYÚSCULAS, sin acentos).
const CITY = { STD: 'SANTANDER', SLM: 'SALAMANCA', TFE: 'TENERIFE', TFN: 'TENERIFE', LLA: 'TENERIFE', PNA: 'PAMPLONA', PNL: 'PAMPLONA', ZAR: 'ZARAGOZA', BIL: 'BILBAO', MDC: 'MADRID', MAD: 'MADRID' }
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

const normName = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
const digits = (s) => String(s || '').replace(/\D/g, '')

function toHHMM(v) {
  if (v == null || v === '') return null
  if (v instanceof Date) return `${String(v.getUTCHours()).padStart(2, '0')}:${String(v.getUTCMinutes()).padStart(2, '0')}`
  if (typeof v === 'number') { const mins = Math.round(v * 24 * 60); return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}` }
  const m = String(v).match(/(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}
function toISODate(v) {
  if (v instanceof Date) return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`
  if (typeof v === 'number') { const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}` }
  const m = String(v || '').match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}
const weekdayOf = (iso) => { const [y, m, d] = iso.split('-').map(Number); return DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] }
const addDaysIso = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d + n)); return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}` }
// Lunes (ISO) de la semana que contiene la fecha dada.
function mondayOf(iso) { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); const off = (dt.getUTCDay() + 6) % 7; return addDaysIso(iso, -off) }
const cell = (row, i) => (row.getCell(i).value ?? '')

// Baja el Google Sheet como .xlsx a un archivo temporal y devuelve su ruta.
async function fetchSheet(id) {
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo bajar el Sheet (${res.status}). ¿Está en "cualquiera con el enlace"?`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.slice(0, 2).toString() !== 'PK') throw new Error('La respuesta no es un Excel (¿el Sheet no es público por enlace?).')
  const p = join(tmpdir(), `uber_sapiens_horarios_${id}.xlsx`)
  writeFileSync(p, buf)
  return p
}

// Lee el Excel -> turnos con fecha desde las hojas "* CSV".
export async function parseHorarios(path) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path)
  const shifts = []
  const sheetsRead = []
  for (const ws of wb.worksheets) {
    if (!/CSV\s*$/i.test(ws.name)) continue
    sheetsRead.push(ws.name)
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const codigo = String(cell(row, 1) || '').trim().toUpperCase()
      const rider = String(cell(row, 2) || '').trim()
      const iso = toISODate(cell(row, 3))
      const ini = toHHMM(cell(row, 4))
      const fin = toHHMM(cell(row, 5))
      if (!rider || !iso || !ini || !fin) return
      shifts.push({ city: CITY[codigo] || codigo || null, rider_name: rider, work_date: iso, dia: weekdayOf(iso), turno: ini < '15:00' ? 'manana' : 'tarde', hora_inicio: ini, hora_fin: fin })
    })
  }
  return { shifts, sheetsRead }
}

// Elige la semana con el HORARIO REAL: la que tiene más turnos (el Excel suele tener
// una semana "activa" llena y algún resto suelto en otras). Desempate: la más cercana a hoy.
function daysBetween(a, b) { return Math.round((Date.parse(a) - Date.parse(b)) / 86400000) }
function selectWeek(shifts, todayIso) {
  const byWeek = new Map()
  for (const s of shifts) {
    const w = mondayOf(s.work_date)
    if (!byWeek.has(w)) byWeek.set(w, [])
    byWeek.get(w).push(s)
  }
  if (!byWeek.size) { const m = mondayOf(todayIso); return { mon: m, sun: addDaysIso(m, 6), weekShifts: [] } }
  let best = null
  for (const [w, arr] of byWeek) {
    const better = !best || arr.length > best.arr.length ||
      (arr.length === best.arr.length && Math.abs(daysBetween(w, todayIso)) < Math.abs(daysBetween(best.w, todayIso)))
    if (better) best = { w, arr }
  }
  return { mon: best.w, sun: addDaysIso(best.w, 6), weekShifts: best.arr }
}

function todayIso() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const localPath = args.find((a) => !a.startsWith('--'))
  const path = localPath || (await fetchSheet(SHEET_ID))
  console.log(localPath ? `Origen: ${localPath}` : `Origen: Google Sheet ${SHEET_ID}`)

  const { shifts, sheetsRead } = await parseHorarios(path)
  const { mon, sun, weekShifts } = selectWeek(shifts, todayIso())
  const riders = new Set(weekShifts.map((s) => normName(s.rider_name)))
  const byCity = {}
  for (const s of weekShifts) byCity[s.city] = (byCity[s.city] || 0) + 1
  console.log(`Hojas: ${sheetsRead.join(', ')}`)
  console.log(`Total en el Excel: ${shifts.length} turnos. Semana elegida: ${mon} → ${sun}`)
  console.log(`Semana: ${weekShifts.length} turnos · ${riders.size} riders · por ciudad: ${Object.entries(byCity).map(([c, n]) => `${c}=${n}`).join(', ')}`)
  for (const s of weekShifts.slice(0, 5)) console.log(`  ${s.city} · ${s.rider_name} · ${s.work_date} (${s.dia}/${s.turno}) ${s.hora_inicio}-${s.hora_fin}`)
  if (dryRun) { console.log('\n[dry-run] No se ha escrito nada.'); return }

  const SUPABASE_URL = get('VITE_SUPABASE_URL') || get('SUPABASE_URL')
  const SUPABASE_KEY = get('VITE_SUPABASE_ANON_KEY') || get('SUPABASE_ANON_KEY')
  const EMAIL = get('SYNC_EMAIL'); const PASSWORD = get('SYNC_PASSWORD')
  if (!SUPABASE_URL || !SUPABASE_KEY || !EMAIL || !PASSWORD) { console.error('Faltan credenciales en .env'); process.exit(1) }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (authErr || !auth.user) { console.error('Login fallido:', authErr?.message); process.exit(1) }
  const { data: mem } = await supabase.from('org_members').select('org_id').order('created_at', { ascending: true }).limit(1).maybeSingle()
  const orgId = mem?.org_id
  if (!orgId) { console.error('Sin organización'); process.exit(1) }

  const { data: roster } = await supabase.from('rider_roster').select('name, phone').eq('org_id', orgId)
  const phoneByName = new Map((roster || []).filter((r) => r.phone).map((r) => [normName(r.name), r.phone]))
  const rows = weekShifts.map((s) => {
    const phone = phoneByName.get(normName(s.rider_name)) || null
    return { org_id: orgId, provider: 'uber', city: s.city, rider_name: s.rider_name, rider_phone: phone, rider_key: phone ? digits(phone) : null, dia: s.dia, turno: s.turno, hora_inicio: s.hora_inicio, hora_fin: s.hora_fin, sort: 0 }
  })
  console.log(`Cruce por teléfono: ${rows.filter((r) => r.rider_key).length}/${rows.length} vinculados.`)

  // Borrado por lotes pequeños: un DELETE grande con RLS por fila supera el statement
  // timeout de Supabase. Borramos por id en trozos de 100.
  const { data: existing, error: exErr } = await supabase.from('shift_plans').select('id').eq('org_id', orgId).eq('provider', 'uber')
  if (exErr) { console.error('Error leyendo turnos previos:', exErr.message); process.exit(1) }
  const ids = (existing || []).map((r) => r.id)
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await supabase.from('shift_plans').delete().in('id', ids.slice(i, i + 100))
    if (error) { console.error(`Error borrando lote (${i}): ${error.message}`); process.exit(1) }
  }
  console.log(`Borrados ${ids.length} turnos previos.`)
  let ins = 0
  for (let i = 0; i < rows.length; i += 300) {
    const { data, error } = await supabase.from('shift_plans').insert(rows.slice(i, i + 300)).select('id')
    if (error) { console.error(`Error insertando (${i}): ${error.message}`); process.exit(1) }
    ins += (data || []).length
  }
  console.log(`✓ ${ins} turnos sincronizados en shift_plans (semana ${mon}→${sun}).`)
}

main().catch((e) => { console.error(e); process.exit(1) })
