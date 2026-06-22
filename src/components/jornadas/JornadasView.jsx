import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  Activity,
  Clock,
  Users,
  Timer,
  Radio,
  TrendingUp,
  MapPin,
  Bike,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Calendar,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../state/OrgContext'
import { useFleet } from '../../state/useFleetData'
import { useApp } from '../../state/AppContext'

function isoToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfWeek() {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtDuration(connectedAt, disconnectedAt) {
  const start = new Date(connectedAt)
  const end = disconnectedAt ? new Date(disconnectedAt) : new Date()
  const mins = Math.max(0, Math.round((end - start) / 60000))
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

function durationMinutes(connectedAt, disconnectedAt) {
  const start = new Date(connectedAt)
  const end = disconnectedAt ? new Date(disconnectedAt) : new Date()
  return Math.max(0, (end - start) / 60000)
}

const PERIODS = [
  { id: 'day', label: 'Hoy' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
]

function KpiMini({ icon: Icon, label, value, suffix, accent }) {
  const colors = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-panel p-3.5">
      <div className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', colors[accent])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-faint">{label}</p>
        <p className="text-lg font-bold tabular-nums text-fg">
          {value}
          {suffix && <span className="text-sm font-medium text-muted">{suffix}</span>}
        </p>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  if (!status || status === 'offline') return null
  const map = {
    disponible: { label: 'Disponible', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    en_ruta: { label: 'En ruta', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
    en_entrega: { label: 'En entrega', cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-400' },
  }
  const m = map[status] || { label: status, cls: 'bg-gray-500/15 text-gray-600' }
  return <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold', m.cls)}>{m.label}</span>
}

function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
    </span>
  )
}

function SessionRow({ s, showDate }) {
  const live = !s.disconnected_at
  const dur = fmtDuration(s.connected_at, s.disconnected_at)
  const trips = (s.trips_end || 0) - (s.trips_start || 0)

  return (
    <div className={clsx('flex items-center gap-3 px-3 py-2.5 sm:px-4', live && 'bg-emerald-500/5')}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-inset">
        {live ? <LiveDot /> : <Clock className="h-4 w-4 text-faint" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-fg">{s.rider_name || s.rider_key}</p>
          {live && <StatusBadge status={s.last_status} />}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-faint">
          {showDate && <span>{fmtDate(s.connected_at)}</span>}
          <span>{fmtTime(s.connected_at)} → {live ? 'Ahora' : fmtTime(s.disconnected_at)}</span>
          {s.city && (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />{s.city}
            </span>
          )}
          {s.vehicle_type && (
            <span className="inline-flex items-center gap-0.5">
              <Bike className="h-3 w-3" />{s.vehicle_type}
            </span>
          )}
          {trips > 0 && <span>{trips} viaje{trips !== 1 ? 's' : ''}</span>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={clsx('text-sm font-semibold tabular-nums', live ? 'text-emerald-600 dark:text-emerald-400' : 'text-fg')}>{dur}</p>
      </div>
    </div>
  )
}

function RiderGroup({ riderKey, sessions, expanded, onToggle }) {
  const name = sessions[0]?.rider_name || riderKey
  const city = sessions[0]?.city
  const totalMin = sessions.reduce((sum, s) => sum + durationMinutes(s.connected_at, s.disconnected_at), 0)
  const totalTrips = sessions.reduce((sum, s) => sum + Math.max(0, (s.trips_end || 0) - (s.trips_start || 0)), 0)
  const hasLive = sessions.some((s) => !s.disconnected_at)
  const h = Math.floor(totalMin / 60)
  const m = Math.round(totalMin % 60)

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-inset sm:px-4"
      >
        <div className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold', hasLive ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-inset text-muted')}>
          {hasLive ? <LiveDot /> : sessions.length}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{name}</p>
          <p className="text-[11px] text-faint">
            {city && `${city} · `}{sessions.length} sesion{sessions.length !== 1 ? 'es' : ''} · {h}h {m}m{totalTrips > 0 ? ` · ${totalTrips} viajes` : ''}
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-faint" /> : <ChevronDown className="h-4 w-4 text-faint" />}
      </button>
      {expanded && (
        <div className="divide-y divide-line border-t border-line">
          {sessions.map((s) => (
            <SessionRow key={s.id} s={s} showDate />
          ))}
        </div>
      )}
    </div>
  )
}

export default function JornadasView() {
  const { currentOrgId } = useOrg()
  const { riders, isDemo } = useFleet()
  const { demoMode } = useApp()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('day')
  const [expanded, setExpanded] = useState(new Set())
  const [refreshKey, setRefreshKey] = useState(0)

  const dateFrom = useMemo(() => {
    if (period === 'week') return startOfWeek()
    if (period === 'month') return startOfMonth()
    return isoToday()
  }, [period])

  const load = useCallback(async () => {
    if (!currentOrgId) return
    setLoading(true)
    const PAGE = 1000
    let all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('rider_sessions')
        .select('*')
        .eq('org_id', currentOrgId)
        .gte('connected_at', `${dateFrom}T00:00:00`)
        .order('connected_at', { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) break
      all = all.concat(data || [])
      if (!data || data.length < PAGE) break
      from += PAGE
    }
    setSessions(all)
    setLoading(false)
  }, [currentOrgId, dateFrom])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  useEffect(() => {
    const id = setInterval(() => setRefreshKey((k) => k + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const live = useMemo(() => sessions.filter((s) => !s.disconnected_at), [sessions])
  const completed = useMemo(() => sessions.filter((s) => s.disconnected_at), [sessions])

  const stats = useMemo(() => {
    const totalMin = sessions.reduce((sum, s) => sum + durationMinutes(s.connected_at, s.disconnected_at), 0)
    const completedDurations = completed.map((s) => durationMinutes(s.connected_at, s.disconnected_at))
    const avgMin = completedDurations.length ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length : 0
    const uniqueRiders = new Set(sessions.map((s) => s.rider_key)).size
    const totalTrips = sessions.reduce((sum, s) => sum + Math.max(0, (s.trips_end || 0) - (s.trips_start || 0)), 0)
    return {
      liveCount: live.length,
      totalSessions: sessions.length,
      uniqueRiders,
      totalHours: Math.round(totalMin / 60 * 10) / 10,
      avgMin: Math.round(avgMin),
      totalTrips,
    }
  }, [sessions, live, completed])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const s of sessions) {
      const key = s.rider_key
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(s)
    }
    return [...map.entries()]
      .map(([key, list]) => ({ key, sessions: list }))
      .sort((a, b) => {
        const aLive = a.sessions.some((s) => !s.disconnected_at) ? 1 : 0
        const bLive = b.sessions.some((s) => !s.disconnected_at) ? 1 : 0
        if (aLive !== bLive) return bLive - aLive
        return new Date(b.sessions[0].connected_at) - new Date(a.sessions[0].connected_at)
      })
  }, [sessions])

  const toggleExpand = (key) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  if (demoMode || isDemo) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Activity className="mb-3 h-10 w-10 text-faint" />
        <p className="text-sm text-muted">Las jornadas en tiempo real requieren una conexión activa con la API de Uber.</p>
        <p className="mt-1 text-xs text-faint">Conecta tu cuenta en Ajustes para activar el seguimiento.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-fg">Jornadas</h2>
          <p className="text-xs text-faint">Conexiones y desconexiones en tiempo real desde el API de Uber</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-line bg-panel text-xs font-medium">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={clsx(
                  'px-3 py-1.5 transition',
                  period === p.id ? 'bg-accent text-white' : 'text-muted hover:bg-inset hover:text-fg',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-panel text-muted transition hover:bg-inset hover:text-fg"
            title="Actualizar"
          >
            <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMini icon={Radio} label="En vivo ahora" value={stats.liveCount} accent="emerald" />
        <KpiMini icon={Users} label="Riders únicos" value={stats.uniqueRiders} accent="sky" />
        <KpiMini icon={Timer} label="Horas totales" value={stats.totalHours} suffix="h" accent="amber" />
        <KpiMini icon={TrendingUp} label="Dur. media" value={stats.avgMin} suffix="m" accent="indigo" />
      </div>

      {loading && !sessions.length ? (
        <div className="py-10 text-center text-sm text-muted">Cargando jornadas…</div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-panel py-16 text-center">
          <Calendar className="mb-3 h-10 w-10 text-faint" />
          <p className="text-sm font-medium text-muted">Sin jornadas en este periodo</p>
          <p className="mt-1 text-xs text-faint">Las sesiones se registran automáticamente cuando los riders se conectan.</p>
        </div>
      ) : (
        <>
          {live.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <LiveDot />
                <h3 className="text-sm font-semibold text-fg">{live.length} conectado{live.length !== 1 ? 's' : ''} ahora</h3>
              </div>
              <div className="overflow-hidden rounded-xl border border-emerald-200 bg-panel dark:border-emerald-900/40">
                <div className="divide-y divide-line">
                  {live.map((s) => (
                    <SessionRow key={s.id} s={s} showDate={period !== 'day'} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-fg">
              Por rider · {grouped.length} rider{grouped.length !== 1 ? 's' : ''}
            </h3>
            <div className="space-y-2">
              {grouped.map((g) => (
                <RiderGroup
                  key={g.key}
                  riderKey={g.key}
                  sessions={g.sessions}
                  expanded={expanded.has(g.key)}
                  onToggle={() => toggleExpand(g.key)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
