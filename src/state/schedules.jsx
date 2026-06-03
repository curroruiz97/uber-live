import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from './AppContext'
import { useOrg } from './OrgContext'
import { computeDailyCompliance, deriveAlerts } from '../domain/compliance'

const SchedulesContext = createContext(null)

export function useSchedules() {
  const ctx = useContext(SchedulesContext)
  if (!ctx) throw new Error('useSchedules debe usarse dentro de <SchedulesProvider>')
  return ctx
}

const DEFAULT_CFG = { timezone: 'Europe/Madrid', grace_in_min: 5, grace_out_min: 5, min_compliance_pct: 90, week_starts_on: 1 }

// ---- Generador demo: roster + horarios + cumplimiento coherente con las reglas reales ----
const DEMO_RIDERS = [
  { riderKey: '34611111001', name: 'Lucía Fernández', phone: '+34 611 111 001', provider: 'uber' },
  { riderKey: '34611111002', name: 'Mateo Gómez', phone: '+34 611 111 002', provider: 'uber' },
  { riderKey: '34611111003', name: 'Sofía Rodríguez', phone: '+34 611 111 003', provider: 'glovo' },
  { riderKey: '34611111004', name: 'Hugo Martín', phone: '+34 611 111 004', provider: 'uber' },
  { riderKey: '34611111005', name: 'Martina López', phone: '+34 611 111 005', provider: 'glovo' },
  { riderKey: '34611111006', name: 'Daniel Sánchez', phone: '+34 611 111 006', provider: 'uber' },
  { riderKey: '34611111007', name: 'Paula García', phone: '+34 611 111 007', provider: 'glovo' },
  { riderKey: '34611111008', name: 'Pablo Díaz', phone: '+34 611 111 008', provider: 'uber' },
  { riderKey: '34611111009', name: 'Valeria Ruiz', phone: '+34 611 111 009', provider: 'glovo' },
  { riderKey: '34611111010', name: 'Adrián Moreno', phone: '+34 611 111 010', provider: 'uber' },
  { riderKey: '34611111011', name: 'Carla Jiménez', phone: '+34 611 111 011', provider: 'glovo' },
  { riderKey: '34611111012', name: 'Álvaro Muñoz', phone: '+34 611 111 012', provider: 'uber' },
]

// PRNG determinista por (riderKey, día) para que el demo sea estable entre recargas.
function seededRand(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildDemo(days = 30, cfg = DEFAULT_CFG) {
  const roster = DEMO_RIDERS.map((r) => ({ ...r, email: null, vehicleType: r.provider === 'uber' ? 'Moto' : 'Bicicleta', active: true }))
  const schedules = []
  const daily = []
  const alerts = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset -= 1) {
    const d = new Date(today)
    d.setDate(d.getDate() - dayOffset)
    const dow = d.getDay()
    if (dow === 0) continue // domingo libre en el demo
    const date = isoDate(d)

    for (const rider of roster) {
      const seed = seededRand(rider.riderKey + date)
      // Turno fijo por rider (mañana o tarde) para realismo.
      const morning = seededRand(rider.riderKey) < 0.6
      const startMin = morning ? 10 * 60 : 16 * 60
      const endMin = morning ? 14 * 60 : 21 * 60
      const plannedStart = new Date(d).setHours(0, startMin / 60 | 0, startMin % 60, 0)
      const plannedEnd = new Date(d).setHours(0, endMin / 60 | 0, endMin % 60, 0)
      const plannedMinutes = endMin - startMin
      schedules.push({ riderKey: rider.riderKey, name: rider.name, date, plannedStart, plannedEnd, plannedMinutes })

      // Actividad real simulada según un "perfil de fiabilidad" del rider.
      const reliability = 0.55 + seededRand(rider.riderKey + 'rel') * 0.45 // 0.55–1.0
      let actual = null
      if (seed < reliability) {
        // Asiste. A veces tarde / se va antes.
        const delay = seed < reliability - 0.25 ? Math.round(seededRand(date + rider.riderKey) * 4) : 8 + Math.round(seededRand(rider.riderKey + date + 'd') * 25)
        const early = seededRand(rider.riderKey + date + 'e') < 0.18 ? 10 + Math.round(seededRand(date) * 30) : 0
        const firstOnlineAt = plannedStart + delay * 60000
        const lastOnlineAt = plannedEnd - early * 60000
        const workedMinutes = Math.max(0, Math.round((lastOnlineAt - firstOnlineAt) / 60000))
        actual = { firstOnlineAt, lastOnlineAt, workedMinutes }
      }
      const comp = computeDailyCompliance({ plannedStart, plannedEnd, plannedMinutes }, actual, cfg)
      const row = { riderKey: rider.riderKey, name: rider.name, provider: rider.provider, date, ...comp }
      daily.push(row)
      for (const a of deriveAlerts(comp)) {
        alerts.push({
          id: `${rider.riderKey}-${date}-${a.type}`,
          riderKey: rider.riderKey,
          name: rider.name,
          date,
          type: a.type,
          severity: a.severity,
          acknowledged: dayOffset > 1, // los de hoy/ayer quedan sin ver
        })
      }
    }
  }
  return { roster, schedules, daily, alerts }
}

// Persistencia en Supabase (Postgres + Realtime). En demo se usa el generador local.
// Las tablas reales (rider_*, compliance_*) las llena el cron; aquí solo leemos.
export function SchedulesProvider({ children }) {
  const { demoMode } = useApp()
  const { currentOrgId: orgId, isOwnerOrAdmin } = useOrg()

  const [cfg, setCfg] = useState(DEFAULT_CFG)
  const [roster, setRoster] = useState([])
  const [schedules, setSchedules] = useState([])
  const [daily, setDaily] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const demoRef = useRef(null)

  const loadDemo = useCallback(() => {
    if (!demoRef.current) demoRef.current = buildDemo(30, DEFAULT_CFG)
    const d = demoRef.current
    setRoster(d.roster)
    setSchedules(d.schedules)
    setDaily(d.daily)
    setAlerts(d.alerts)
    setCfg(DEFAULT_CFG)
    setLoading(false)
  }, [])

  const loadReal = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [st, rosterRes, compRes, alertRes] = await Promise.all([
        supabase.from('org_settings').select('schedule_config').eq('org_id', orgId).maybeSingle(),
        supabase.from('rider_roster').select('*').eq('org_id', orgId),
        supabase.from('compliance_daily').select('*').eq('org_id', orgId).order('work_date', { ascending: false }).limit(5000),
        supabase.from('compliance_alerts').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(500),
      ])
      // Si las tablas aún no existen (no desplegadas), cae a demo para no romper la UI.
      if (rosterRes.error || compRes.error) {
        loadDemo()
        return
      }
      setCfg({ ...DEFAULT_CFG, ...(st.data?.schedule_config || {}) })
      setRoster((rosterRes.data || []).map((r) => ({ riderKey: r.rider_key, name: r.name, phone: r.phone, provider: r.provider, vehicleType: r.vehicle_type, active: r.active })))
      setDaily((compRes.data || []).map((r) => ({
        riderKey: r.rider_key, date: r.work_date, plannedMinutes: r.planned_minutes, workedMinutes: r.worked_minutes,
        checkInDelayMin: r.check_in_delay_min, checkOutEarlyMin: r.check_out_early_min, attended: r.attended,
        late: r.late, compliancePct: Number(r.compliance_pct), status: r.status,
      })))
      setAlerts((alertRes.data || []).map((a) => ({ id: a.id, riderKey: a.rider_key, date: a.work_date, type: a.type, severity: a.severity, acknowledged: a.acknowledged })))
      setLoading(false)
    } catch {
      loadDemo()
    }
  }, [orgId, loadDemo])

  useEffect(() => {
    if (demoMode) loadDemo()
    else loadReal()
  }, [demoMode, loadDemo, loadReal])

  // Marca un aviso como visto (en demo solo local; en real, update con RLS).
  const acknowledgeAlert = useCallback(
    async (id) => {
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)))
      if (!demoMode && orgId) {
        await supabase.from('compliance_alerts').update({ acknowledged: true }).eq('id', id).eq('org_id', orgId)
      }
    },
    [demoMode, orgId],
  )

  // Importa horarios (filas ya validadas del CSV). En demo los añade al estado local.
  const importSchedules = useCallback(
    async (rows) => {
      const valid = rows.filter((r) => r.ok)
      if (demoMode) {
        setSchedules((prev) => [
          ...prev,
          ...valid.map((r) => ({ riderKey: r.riderKey, name: r.name, date: r.date, plannedStart: r.plannedStart, plannedEnd: r.plannedEnd, plannedMinutes: r.plannedMinutes })),
        ])
        return { ok: true, imported: valid.length, demo: true }
      }
      // Real: RPC SECURITY DEFINER (valida rol). La función vive en la migración de Fase 2.
      const payload = valid.map((r) => ({ rider_key: r.riderKey, work_date: r.date, planned_start: new Date(r.plannedStart).toISOString(), planned_end: new Date(r.plannedEnd).toISOString(), planned_minutes: r.plannedMinutes }))
      const { data, error } = await supabase.rpc('import_schedules', { p_org: orgId, p_rows: payload })
      if (error) throw new Error(error.message)
      await loadReal()
      return { ok: true, imported: data?.imported ?? valid.length }
    },
    [demoMode, orgId, loadReal],
  )

  // Guarda la configuración de horarios (zona horaria, márgenes, umbral) en org_settings.
  const saveCfg = useCallback(
    async (patch) => {
      const next = { ...cfg, ...patch }
      setCfg(next)
      if (!demoMode && orgId) {
        await supabase.from('org_settings').update({ schedule_config: next, updated_at: new Date().toISOString() }).eq('org_id', orgId)
      }
      return next
    },
    [cfg, demoMode, orgId],
  )

  const unseenAlerts = useMemo(() => alerts.filter((a) => !a.acknowledged).length, [alerts])

  const value = useMemo(
    () => ({
      cfg,
      setCfg,
      saveCfg,
      roster,
      schedules,
      daily,
      alerts,
      unseenAlerts,
      loading,
      isOwnerOrAdmin,
      acknowledgeAlert,
      importSchedules,
      reload: demoMode ? loadDemo : loadReal,
    }),
    [cfg, saveCfg, roster, schedules, daily, alerts, unseenAlerts, loading, isOwnerOrAdmin, acknowledgeAlert, importSchedules, demoMode, loadDemo, loadReal],
  )

  return <SchedulesContext.Provider value={value}>{children}</SchedulesContext.Provider>
}
