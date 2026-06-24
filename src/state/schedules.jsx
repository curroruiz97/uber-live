import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from './AppContext'
import { useOrg } from './OrgContext'
import { buildDaily, deriveAlerts, canonCity, DEFAULT_CFG } from '../domain/compliance'
import { buildPayloadFromCsv, chunk } from '../utils/glovoDaily'
import { suggestMatches, autoLinkPairs, normName } from '../utils/identityMatch'
import { isoLocal } from '../utils/period'

const SchedulesContext = createContext(null)

export function useSchedules() {
  const ctx = useContext(SchedulesContext)
  if (!ctx) throw new Error('useSchedules debe usarse dentro de <SchedulesProvider>')
  return ctx
}

// Ventana de actividad cargada por defecto (cubre día/semana/mes e histórico reciente).
const WINDOW_DAYS = 220

function todayIso() {
  return isoLocal(new Date())
}
function spanFromIso() {
  const d = new Date()
  d.setDate(d.getDate() - WINDOW_DAYS)
  return isoLocal(d)
}
function addDaysIso(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return isoLocal(dt)
}

// ---- Demo: turnos + actividad coherentes, por el mismo pipeline que producción ----
const DEMO = [
  { key: '34611111001', name: 'Lucía Fernández', provider: 'glovo', city: 'ZARAGOZA', vehicle: 'BICYCLE', rel: 0.97 },
  { key: '34611111002', name: 'Mateo Gómez', provider: 'glovo', city: 'ZARAGOZA', vehicle: 'MOTORCYCLE', rel: 0.88 },
  { key: '34611111003', name: 'Sofía Rodríguez', provider: 'glovo', city: 'BILBAO', vehicle: 'BICYCLE', rel: 0.74 },
  { key: '34611111004', name: 'Hugo Martín', provider: 'glovo', city: 'MADRID', vehicle: 'MOTORCYCLE', rel: 0.93 },
  { key: '34611111005', name: 'Martina López', provider: 'glovo', city: 'TENERIFE', vehicle: 'BICYCLE', rel: 0.6 },
  { key: '34611111006', name: 'Daniel Sánchez', provider: 'glovo', city: 'MADRID', vehicle: 'MOTORCYCLE', rel: 0.99 },
  { key: '34611111007', name: 'Paula García', provider: 'glovo', city: 'SALAMANCA', vehicle: 'BICYCLE', rel: 0.81 },
  { key: '34611111008', name: 'Pablo Díaz', provider: 'glovo', city: 'SANTANDER', vehicle: 'MOTORCYCLE', rel: 0.69 },
]
const DEMO_DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

function rand(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

function buildDemo(days = 35) {
  const shiftPlans = []
  for (const r of DEMO) {
    const morning = rand(r.key) < 0.6
    for (const dia of DEMO_DIAS) {
      shiftPlans.push({
        rider_key: r.key, rider_name: r.name, provider: r.provider, city: r.city, dia,
        hora_inicio: morning ? '10:00' : '16:00', hora_fin: morning ? '15:00' : '21:00',
      })
    }
  }
  const stats = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let off = days - 1; off >= 0; off -= 1) {
    const d = new Date(today)
    d.setDate(d.getDate() - off)
    if (d.getDay() === 0) continue // domingo libre
    const date = isoLocal(d)
    for (const r of DEMO) {
      const seed = rand(r.key + date)
      if (seed > r.rel) continue // ese día no trabajó
      const plannedH = 5
      const activeH = Math.max(0.4, Math.min(plannedH, plannedH * (0.55 + rand(date + r.key) * 0.5)))
      const onlineH = activeH + rand(r.key + date + 'o') * 1.2
      const trips = Math.round(activeH * (2 + rand(r.key + 'p') * 1.5))
      const reject = rand(date + r.key + 'r') < 0.3 ? Math.round(rand(date) * 3) : 0
      stats.push({
        rider_key: r.key, work_date: date, driver_name: r.name, source_provider: 'glovo', city: r.city,
        online_hours: onlineH, active_hours: activeH, open_hours: activeH * 0.4,
        enroute_p2_hours: activeH * 0.3, ontrip_p3_hours: activeH * 0.3, unavailable_hours: onlineH - activeH,
        num_of_trips: trips, single_trips_total: Math.round(trips * 0.7), late_p2_trips: 0, late_p3_trips: rand(date + 'l') < 0.2 ? 1 : 0,
        accept_trips: trips, reject_trips: reject, cancel_trips: rand(date + 'c') < 0.15 ? 1 : 0, cancel_not_at_fault_trips: 0,
        p2_km: trips * 1.4, p2_min: trips * 9, p3_km: trips * 1.6, p3_min: trips * 7, total_km: trips * 3, total_min: trips * 16,
      })
    }
  }
  const roster = DEMO.map((r) => ({ riderKey: r.key, name: r.name, phone: `+${r.key}`, provider: r.provider, vehicleType: r.vehicle, city: r.city, active: true }))
  return { shiftPlans, absences: [], stats, roster }
}

export function SchedulesProvider({ children }) {
  const { demoMode } = useApp()
  const { currentOrgId: orgId, isOwnerOrAdmin } = useOrg()

  const [cfg, setCfg] = useState(DEFAULT_CFG)
  const [shiftPlans, setShiftPlans] = useState([])
  const [absences, setAbsences] = useState([])
  const [rawStats, setRawStats] = useState([])
  const [roster, setRoster] = useState([])
  const [imports, setImports] = useState([])
  const [loading, setLoading] = useState(true)
  const demoRef = useRef(null)

  const span = useMemo(() => ({ from: spanFromIso(), to: todayIso() }), [])

  const loadDemo = useCallback(() => {
    if (!demoRef.current) demoRef.current = buildDemo(35)
    const d = demoRef.current
    setShiftPlans(d.shiftPlans)
    setAbsences(d.absences)
    setRawStats(d.stats)
    setRoster(d.roster)
    setImports([])
    setCfg(DEFAULT_CFG)
    setLoading(false)
  }, [])

  const loadReal = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      // Supabase PostgREST limita a ~1000 filas por defecto (max_rows).
      // Paginamos rider_daily_stats para traer TODAS las filas de la ventana.
      async function fetchAllStats() {
        const PAGE = 1000
        let all = []
        let from = 0
        while (true) {
          const { data, error } = await supabase
            .from('rider_daily_stats')
            .select('*')
            .eq('org_id', orgId)
            .gte('work_date', span.from)
            .order('work_date', { ascending: true })
            .range(from, from + PAGE - 1)
          if (error) return { data: null, error }
          all = all.concat(data || [])
          if (!data || data.length < PAGE) break
          from += PAGE
        }
        return { data: all, error: null }
      }

      const [st, ro, sp, ab, stats, imp] = await Promise.all([
        supabase.from('org_settings').select('schedule_config').eq('org_id', orgId).maybeSingle(),
        supabase.from('rider_roster').select('*').eq('org_id', orgId),
        supabase.from('shift_plans').select('*').eq('org_id', orgId),
        supabase.from('rider_absences').select('*').eq('org_id', orgId),
        fetchAllStats(),
        supabase.from('glovo_imports').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(30),
      ])
      if (sp.error || stats.error) {
        loadDemo()
        return
      }
      setCfg({ ...DEFAULT_CFG, ...(st.data?.schedule_config || {}) })
      setRoster((ro.data || []).map((r) => ({ riderKey: r.rider_key, name: r.name, phone: r.phone, provider: r.provider, vehicleType: r.vehicle_type, city: canonCity(r.city), active: r.active })))
      setShiftPlans(sp.data || [])
      setAbsences(ab.data || [])
      setRawStats(stats.data || [])
      setImports(imp.data || [])
      setLoading(false)
    } catch {
      loadDemo()
    }
  }, [orgId, span.from, loadDemo])

  useEffect(() => {
    if (demoMode) loadDemo()
    else loadReal()
  }, [demoMode, loadDemo, loadReal])

  const dataRange = useMemo(() => {
    if (!rawStats.length) return null
    let first = rawStats[0].work_date
    let last = rawStats[0].work_date
    for (const r of rawStats) {
      if (r.work_date < first) first = r.work_date
      if (r.work_date > last) last = r.work_date
    }
    return { first, last }
  }, [rawStats])

  // Cruce turnos × actividad (cálculo puro, memorizado).
  const daily = useMemo(
    () => buildDaily(shiftPlans, absences, rawStats, span.from, span.to, cfg),
    [shiftPlans, absences, rawStats, span.from, span.to, cfg],
  )
  const alerts = useMemo(() => deriveAlerts(daily, cfg), [daily, cfg])

  // Identidad: nombres de turno sin teléfono y candidatos del roster.
  const unlinkedNames = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const s of shiftPlans) {
      if (s.rider_key) continue
      const k = `${s.provider}|${s.rider_name}`
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ rider_name: s.rider_name, provider: s.provider || 'uber', city: s.city || null })
    }
    return out
  }, [shiftPlans])

  const candidates = useMemo(() => roster.filter((r) => r.phone || r.riderKey).map((r) => ({ rider_key: r.riderKey, name: r.name, phone: r.phone })), [roster])
  const suggestions = useMemo(() => suggestMatches(unlinkedNames, candidates), [unlinkedNames, candidates])

  // Importa CSV(s) de actividad (uno o varios). onProgress({phase,file,index,total,...}).
  const importGlovoDaily = useCallback(
    async (files, onProgress) => {
      const arr = [...files]
      if (demoMode) return { demo: true, files: arr.length }
      if (!orgId) throw new Error('Sin organización activa')
      let rowsUpserted = 0
      let newRiders = 0
      let skipped = 0
      let dateMin = null
      let dateMax = null
      for (let i = 0; i < arr.length; i += 1) {
        const f = arr[i]
        onProgress?.({ phase: 'parsing', file: f.name, index: i, total: arr.length })
        const text = await f.text()
        const { rows, exportedAt } = buildPayloadFromCsv(text, f.name)
        if (!rows.length) continue
        const batches = chunk(rows, 500)
        for (let b = 0; b < batches.length; b += 1) {
          const { data, error } = await supabase.rpc('import_glovo_daily', {
            p_org: orgId, p_rows: batches[b], p_exported_at: exportedAt || null, p_filename: f.name,
          })
          if (error) throw new Error(error.message)
          rowsUpserted += data?.rows_upserted || 0
          newRiders += data?.new_riders || 0
          skipped += data?.rows_skipped_older || 0
          if (data?.date_min && (!dateMin || data.date_min < dateMin)) dateMin = data.date_min
          if (data?.date_max && (!dateMax || data.date_max > dateMax)) dateMax = data.date_max
          onProgress?.({ phase: 'uploading', file: f.name, index: i, total: arr.length, batch: b + 1, batches: batches.length })
        }
      }
      await loadReal()
      return { files: arr.length, rowsUpserted, newRiders, skipped, dateMin, dateMax }
    },
    [demoMode, orgId, loadReal],
  )

  // Vincula nombres de turno con identidades (teléfono). pairs ya construidos.
  const linkRiders = useCallback(
    async (pairs) => {
      if (!pairs?.length) return { links_upserted: 0 }
      if (demoMode) return { demo: true }
      if (!orgId) throw new Error('Sin organización activa')
      const { data, error } = await supabase.rpc('link_riders', { p_org: orgId, p_pairs: pairs })
      if (error) throw new Error(error.message)
      await loadReal()
      return data || {}
    },
    [demoMode, orgId, loadReal],
  )

  // Auto-empareja los nombres con una única coincidencia inequívoca.
  const autoLink = useCallback(async () => {
    const pairs = autoLinkPairs(unlinkedNames, candidates)
    if (!pairs.length) return { links_upserted: 0, attempted: 0 }
    const res = await linkRiders(pairs)
    return { ...res, attempted: pairs.length }
  }, [unlinkedNames, candidates, linkRiders])

  const linkOne = useCallback(
    async (riderName, provider, rosterCandidate) => {
      const pair = {
        provider: provider || 'uber',
        rider_name: riderName,
        name_norm: normName(riderName),
        rider_key: rosterCandidate.rider_key ?? rosterCandidate.riderKey,
        rider_phone: rosterCandidate.phone || null,
        method: 'manual',
        confidence: null,
      }
      return linkRiders([pair])
    },
    [linkRiders],
  )

  // Guarda la configuración de cumplimiento (upsert en org_settings).
  const saveCfg = useCallback(
    async (patch) => {
      const next = { ...cfg, ...patch }
      setCfg(next)
      if (!demoMode && orgId) {
        const { error } = await supabase
          .from('org_settings')
          .upsert({ org_id: orgId, schedule_config: next, updated_at: new Date().toISOString() }, { onConflict: 'org_id' })
        if (error) throw new Error(error.message)
      }
      return next
    },
    [cfg, demoMode, orgId],
  )

  const stats = useMemo(() => {
    const linkedRiders = new Set(shiftPlans.filter((s) => s.rider_key).map((s) => s.rider_key))
    return {
      riders: linkedRiders.size,
      shifts: shiftPlans.length,
      days: daily.length,
      unlinked: unlinkedNames.length,
      activityRiders: new Set(rawStats.map((r) => r.rider_key)).size,
    }
  }, [shiftPlans, daily, unlinkedNames, rawStats])

  const unseenAlerts = alerts.length

  const value = useMemo(
    () => ({
      cfg, setCfg, saveCfg,
      roster, shiftPlans, absences, rawStats, imports,
      daily, alerts, unseenAlerts, suggestions, unlinkedNames,
      stats, span, dataRange,
      loading, demoMode, isOwnerOrAdmin,
      importGlovoDaily, linkRiders, autoLink, linkOne,
      reload: demoMode ? loadDemo : loadReal,
    }),
    [cfg, saveCfg, roster, shiftPlans, absences, rawStats, imports, daily, alerts, unseenAlerts, suggestions, unlinkedNames, stats, span, dataRange, loading, demoMode, isOwnerOrAdmin, importGlovoDaily, linkRiders, autoLink, linkOne, loadDemo, loadReal],
  )

  return <SchedulesContext.Provider value={value}>{children}</SchedulesContext.Provider>
}
