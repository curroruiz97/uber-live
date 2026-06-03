// Edge Function (Deno): ROLLUP nocturno (cron, sin usuario).
// Para cada org: deriva sesiones de trabajo del día a partir de las muestras
// (rider_activity_samples), las casa con los horarios planificados (rider_schedules) y
// rellena compliance_daily + compliance_alerts. Aplica las MISMAS reglas que el front
// (src/domain/compliance.js). Idempotente: se puede re-ejecutar para un rango.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

const DEFAULT_CFG = { grace_in_min: 5, grace_out_min: 5, min_compliance_pct: 90 }

function minutesBetween(aMs: number, bMs: number) {
  return Math.round((bMs - aMs) / 60000)
}

// Misma lógica que src/domain/compliance.js (mantener en sync).
function computeDaily(schedule: any, actual: any, cfg: any) {
  const c = { ...DEFAULT_CFG, ...cfg }
  const plannedMinutes = Math.max(0, schedule.plannedMinutes)
  if (!actual || !actual.firstOnlineAt || (actual.workedMinutes ?? 0) <= 0) {
    return { plannedMinutes, workedMinutes: 0, checkInDelayMin: null, checkOutEarlyMin: null, attended: false, late: false, compliancePct: 0, status: 'ausente' }
  }
  const workedMinutes = Math.max(0, actual.workedMinutes)
  const checkInDelayMin = minutesBetween(schedule.plannedStart, actual.firstOnlineAt)
  const checkOutEarlyMin = minutesBetween(actual.lastOnlineAt, schedule.plannedEnd)
  const late = checkInDelayMin > c.grace_in_min
  const leftEarly = checkOutEarlyMin > c.grace_out_min
  let pct = plannedMinutes > 0 ? Math.min(100, (workedMinutes / plannedMinutes) * 100) : 0
  if (late) pct = Math.max(0, pct - Math.min(20, checkInDelayMin - c.grace_in_min))
  pct = Math.round(pct)
  let status = 'cumple'
  if (late) status = 'tarde'
  if (pct < c.min_compliance_pct || leftEarly) status = late ? 'tarde' : 'incompleto'
  if (pct < c.min_compliance_pct && !late) status = 'incompleto'
  return { plannedMinutes, workedMinutes, checkInDelayMin, checkOutEarlyMin, attended: true, late, compliancePct: pct, status }
}

function deriveAlerts(daily: any) {
  const alerts: any[] = []
  if (!daily.attended) return [{ type: 'ausencia', severity: 'critical' }]
  if (daily.late) alerts.push({ type: 'tarde', severity: 'warning' })
  if ((daily.checkOutEarlyMin ?? 0) > 0) alerts.push({ type: 'salida_anticipada', severity: 'warning' })
  if (daily.status === 'incompleto') alerts.push({ type: 'jornada_incompleta', severity: 'warning' })
  return alerts
}

// Fecha YYYY-MM-DD de un instante en una zona horaria dada (para agrupar por día local).
function localDate(ms: number, tz: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))
  } catch {
    return new Date(ms).toISOString().slice(0, 10)
  }
}

// Deriva la sesión real del día desde las muestras online de ese rider/día.
function deriveSession(samples: any[]) {
  const online = samples.filter((s) => s.online).map((s) => Date.parse(s.captured_at)).sort((a, b) => a - b)
  if (!online.length) return null
  const firstOnlineAt = online[0]
  const lastOnlineAt = online[online.length - 1]
  // worked = nº de muestras online * intervalo nominal (10 min), acotado al rango.
  const intervalMin = 10
  const spanMin = Math.max(intervalMin, minutesBetween(firstOnlineAt, lastOnlineAt) + intervalMin)
  const workedMinutes = Math.min(spanMin, online.length * intervalMin)
  return { firstOnlineAt, lastOnlineAt, workedMinutes }
}

async function rollupOrg(admin: any, orgId: string, fromDate: string, toDate: string) {
  const { data: st } = await admin.from('org_settings').select('schedule_config').eq('org_id', orgId).maybeSingle()
  const cfg = { ...DEFAULT_CFG, ...(st?.schedule_config || {}) }
  const tz = cfg.timezone || 'Europe/Madrid'

  // Horarios del rango.
  const { data: schedules } = await admin
    .from('rider_schedules')
    .select('*')
    .eq('org_id', orgId)
    .gte('work_date', fromDate)
    .lte('work_date', toDate)
  if (!schedules || !schedules.length) return { days: 0 }

  // Muestras del rango (un margen de día por zona horaria).
  const { data: samples } = await admin
    .from('rider_activity_samples')
    .select('rider_key, captured_at, online')
    .eq('org_id', orgId)
    .gte('captured_at', `${fromDate}T00:00:00Z`)
    .lte('captured_at', `${toDate}T23:59:59Z`)

  // Agrupa muestras por (rider, día local).
  const byRiderDay = new Map<string, any[]>()
  for (const s of samples || []) {
    const d = localDate(Date.parse(s.captured_at), tz)
    const k = `${s.rider_key}|${d}`
    if (!byRiderDay.has(k)) byRiderDay.set(k, [])
    byRiderDay.get(k)!.push(s)
  }

  const complianceRows: any[] = []
  const alertRows: any[] = []
  const sessionRows: any[] = []

  for (const sch of schedules) {
    const plannedStart = Date.parse(sch.planned_start)
    const plannedEnd = Date.parse(sch.planned_end)
    const k = `${sch.rider_key}|${sch.work_date}`
    const session = deriveSession(byRiderDay.get(k) || [])
    const daily = computeDaily({ plannedStart, plannedEnd, plannedMinutes: sch.planned_minutes }, session, cfg)

    complianceRows.push({
      org_id: orgId,
      rider_key: sch.rider_key,
      work_date: sch.work_date,
      planned_minutes: daily.plannedMinutes,
      worked_minutes: daily.workedMinutes,
      check_in_delay_min: daily.checkInDelayMin,
      check_out_early_min: daily.checkOutEarlyMin,
      attended: daily.attended,
      late: daily.late,
      compliance_pct: daily.compliancePct,
      status: daily.status,
      computed_at: new Date().toISOString(),
    })
    if (session) {
      sessionRows.push({
        org_id: orgId,
        rider_key: sch.rider_key,
        work_date: sch.work_date,
        started_at: new Date(session.firstOnlineAt).toISOString(),
        ended_at: new Date(session.lastOnlineAt).toISOString(),
        first_online_at: new Date(session.firstOnlineAt).toISOString(),
        last_online_at: new Date(session.lastOnlineAt).toISOString(),
        worked_minutes: session.workedMinutes,
        source: 'samples',
        computed_at: new Date().toISOString(),
      })
    }
    for (const a of deriveAlerts(daily)) {
      alertRows.push({ org_id: orgId, rider_key: sch.rider_key, work_date: sch.work_date, type: a.type, severity: a.severity, message: null })
    }
  }

  if (sessionRows.length) await admin.from('rider_work_sessions').upsert(sessionRows, { onConflict: 'org_id,rider_key,work_date' })
  if (complianceRows.length) await admin.from('compliance_daily').upsert(complianceRows, { onConflict: 'org_id,rider_key,work_date' })
  if (alertRows.length) await admin.from('compliance_alerts').upsert(alertRows, { onConflict: 'org_id,rider_key,work_date,type', ignoreDuplicates: true })

  return { days: complianceRows.length, alerts: alertRows.length }
}

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Secreto de cron desde la BD (public.cron_config, RLS bloquea al navegador).
  const { data: cc } = await admin.from('cron_config').select('secret').maybeSingle()
  const expected = cc?.secret || ''
  const given = req.headers.get('x-cron-secret') || ''
  if (!expected || given !== expected) return json(401, { error: 'unauthorized' })

  // Rango: por defecto ayer y hoy (zona del servidor); admite override por body.
  let body: any = {}
  try { body = await req.json() } catch { body = {} }
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86400000)
  const fromDate = body.from || yesterday.toISOString().slice(0, 10)
  const toDate = body.to || today.toISOString().slice(0, 10)
  const { data: subs } = await admin.from('subscriptions').select('org_id, status')
  const activeOrgs = (subs || []).filter((s: any) => ['active', 'trialing'].includes(s.status)).map((s: any) => s.org_id)

  let totalDays = 0
  for (const orgId of activeOrgs) {
    try {
      const r = await rollupOrg(admin, orgId, fromDate, toDate)
      totalDays += r.days || 0
    } catch (e) {
      console.error(`[rollup] org=${orgId}:`, (e as Error).message)
    }
  }
  return json(200, { ok: true, from: fromDate, to: toDate, days: totalDays })
})
