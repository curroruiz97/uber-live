import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { CheckCircle2, Users as UsersIcon, UserX, Timer, Power, Package, Percent, Gauge, TrendingUp, PieChart, Trophy, AlertTriangle, MapPin, Database, UserPlus } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import { useFleet } from '../../state/useFleetData'
import { aggregateCompliance, buildRanking, statusBreakdown, trendByDate } from '../../domain/compliance'
import { digits } from '../../utils/glovoDaily'
import { inRange, isoLocal } from '../../utils/period'
import KpiCard from '../kpis/KpiCard'
import EmptyState from '../common/EmptyState'
import Dropdown from '../common/Dropdown'
import TrendChart from './TrendChart'
import StatusDonut from './StatusDonut'
import Podium from './Podium'
import SectionCard from './SectionCard'
import RangeControls from './RangeControls'
import { usePeriodRange, previousWindow } from './usePeriodRange'
import { pctTone, pctHex } from './statusMeta'
import LiveComplianceCard from './LiveComplianceCard'

function phoneSuffix(s) {
  const d = digits(s)
  return d.length > 9 ? d.slice(-9) : d
}

const PERIODS = [
  { id: 'day', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'all', label: 'Histórico' },
  { id: 'custom', label: 'Fechas' },
]

function CitySplit({ split }) {
  const rows = Object.entries(split).filter(([, a]) => a.programmedDays > 0).sort((a, b) => b[1].programmedDays - a[1].programmedDays)
  if (!rows.length) return <p className="py-6 text-center text-xs text-muted">Sin datos por ciudad en este periodo.</p>
  return (
    <div className="space-y-3.5">
      {rows.map(([city, a]) => {
        const pct = a.avgCompliancePct || 0
        return (
          <div key={city}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="truncate font-medium text-fg">{city || '—'}</span>
              <span className={clsx('shrink-0 font-semibold tabular-nums', pctTone(pct))}>{pct}% · {a.programmedDays} jorn.</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-inset">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pctHex(pct) }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WorstRow({ r }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-inset text-[11px] font-bold tabular-nums text-muted">{r.rank}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{r.name}</p>
        <p className="text-[11px] text-faint">{r.attendancePct}% asist · {r.absences} ausencias · {r.partials} parciales</p>
      </div>
      <span className={clsx('shrink-0 text-sm font-semibold tabular-nums', pctTone(r.avgCompliancePct))}>{r.avgCompliancePct}%</span>
    </div>
  )
}

function UnscheduledAlert({ riders }) {
  const [open, setOpen] = useState(false)
  if (!riders.length) return null
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2.5 text-left">
        <UserPlus className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-fg">{riders.length} rider{riders.length > 1 ? 's' : ''} sin horario asignado</p>
          <p className="text-[11px] text-muted">Aparecen en los CSV de actividad pero no tienen turnos en Horarios. Pulsa para ver.</p>
        </div>
      </button>
      {open && (
        <div className="mt-2 max-h-40 space-y-0.5 overflow-y-auto border-t border-amber-500/20 pt-2">
          {riders.map((r) => (
            <div key={r.riderKey} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs">
              <span className="font-medium text-fg">{r.name}</span>
              <span className="text-faint">{r.city || '—'}</span>
              <span className="ml-auto text-[11px] text-faint">últ. {r.lastActive?.split('-').reverse().join('/')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SummaryTab() {
  const { daily, cfg, loading, dataRange, unscheduledRiders } = useSchedules()
  const { riders: fleetRiders } = useFleet()
  const ctl = usePeriodRange('week')
  const [city, setCity] = useState('all')

  const fleetByPhone = useMemo(() => {
    const map = new Map()
    for (const r of fleetRiders || []) {
      if (r.phone) map.set(phoneSuffix(r.phone), r)
    }
    return map
  }, [fleetRiders])

  const todayStr = useMemo(() => isoLocal(new Date()), [])

  const cityOptions = useMemo(() => {
    const set = new Set(daily.map((d) => d.city).filter(Boolean))
    return [{ id: 'all', label: 'Todas las ciudades' }, ...[...set].sort().map((c) => ({ id: c, label: c }))]
  }, [daily])

  const { from, to } = ctl.range
  const inPeriod = useMemo(() => daily.filter((d) => inRange(d.date, from, to)), [daily, from, to])

  const liveRows = useMemo(() => {
    if (!fleetByPhone.size) return inPeriod
    return inPeriod.map((row) => {
      if (row.date !== todayStr || row.status !== 'ausente') return row
      const fleetR = fleetByPhone.get(phoneSuffix(row.riderKey))
      if (!fleetR || fleetR.status === 'offline') return row
      return { ...row, attended: true, status: 'parcial' }
    })
  }, [inPeriod, todayStr, fleetByPhone])

  const rows = useMemo(() => (city === 'all' ? liveRows : liveRows.filter((d) => d.city === city)), [liveRows, city])

  const agg = useMemo(() => aggregateCompliance(rows), [rows])
  const breakdown = useMemo(() => statusBreakdown(rows), [rows])
  const trend = useMemo(() => trendByDate(rows), [rows])
  const ranking = useMemo(() => buildRanking(rows), [rows])

  const prev = useMemo(() => {
    const pr = previousWindow(ctl.range)
    return aggregateCompliance(daily.filter((d) => inRange(d.date, pr.from, pr.to) && (city === 'all' || d.city === city)))
  }, [daily, ctl.range, city])

  const split = useMemo(() => {
    const out = {}
    for (const d of inPeriod) {
      if (!out[d.city]) out[d.city] = []
      out[d.city].push(d)
    }
    return Object.fromEntries(Object.entries(out).map(([c, list]) => [c, aggregateCompliance(list)]))
  }, [inPeriod])

  if (loading) return <div className="py-10 text-center text-sm text-muted">Cargando…</div>

  const dlt = (cur, p) => (prev.programmedDays ? cur - p : null)
  const worst = ranking.filter((r) => r.programmedDays > 0 && r.avgCompliancePct < (cfg.min_compliance_pct ?? 100)).slice(-5).reverse()

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <RangeControls ctl={ctl} presets={PERIODS} />
        <Dropdown value={city} onChange={setCity} options={cityOptions} ariaLabel="Ciudad" className="w-full" />
        <div className="flex items-center justify-between text-xs text-faint">
          {dataRange ? (
            <span className="inline-flex items-center gap-1"><Database className="h-3 w-3" /> Datos hasta: {dataRange.last.split('-').reverse().join('/')}</span>
          ) : <span />}
          <span>{ctl.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Cumplimiento" value={agg.avgCompliancePct} suffix="%" icon={CheckCircle2} accent="emerald" history={trend.map((t) => t.avgCompliancePct)} delta={dlt(agg.avgCompliancePct, prev.avgCompliancePct)} hint={`${agg.programmedDays} jornadas`} />
        <KpiCard label="Asistencia" value={agg.attendancePct} suffix="%" icon={UsersIcon} accent="sky" history={trend.map((t) => t.attendancePct)} delta={dlt(agg.attendancePct, prev.attendancePct)} hint={`${agg.present}/${agg.programmedDays}`} />
        <KpiCard label="Horas activas" value={agg.activeHours} decimals={1} suffix="h" icon={Timer} accent="amber" delta={dlt(agg.activeHours, prev.activeHours)} hint={`de ${agg.plannedHours}h plan`} />
        <KpiCard label="Horas online" value={agg.onlineHours} decimals={1} suffix="h" icon={Power} accent="indigo" delta={dlt(agg.onlineHours, prev.onlineHours)} hint="conectado" />
        <KpiCard label="Viajes" value={agg.trips} icon={Package} accent="emerald" delta={dlt(agg.trips, prev.trips)} hint={`${agg.lateDeliveries} tarde`} />
        <KpiCard label="Aceptación" value={agg.acceptanceRatePct ?? 0} suffix="%" icon={Percent} accent="sky" hint={`cancel. ${agg.cancelRatePct}%`} />
        <KpiCard label="Productividad" value={agg.productivity} decimals={2} icon={Gauge} accent="indigo" hint="viajes/hora activa" />
        <KpiCard label="Ausencias" value={agg.absences} icon={UserX} accent="red" hint={`${agg.partials} parciales · ${agg.justifiedDays} justif.`} />
      </div>

      <UnscheduledAlert riders={unscheduledRiders || []} />

      <LiveComplianceCard />

      {rows.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Sin datos en este periodo"
          hint={dataRange
            ? `Los datos cubren del ${dataRange.first.split('-').reverse().join('/')} al ${dataRange.last.split('-').reverse().join('/')}. Sube CSVs más recientes o usa Histórico.`
            : 'Sube los CSV de actividad para cruzarlos con los turnos planificados.'}
        />
      ) : (
        <>
          <SectionCard icon={TrendingUp} title="Tendencia de cumplimiento" subtitle={`media diaria · umbral ${cfg.min_compliance_pct}%`}>
            <TrendChart data={trend.map((t) => ({ date: t.date, value: t.avgCompliancePct }))} threshold={cfg.min_compliance_pct} />
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard icon={PieChart} title="Distribución por estado">
              <StatusDonut breakdown={breakdown} />
            </SectionCard>
            <SectionCard icon={MapPin} title="Por ciudad">
              <CitySplit split={split} />
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard icon={Trophy} title="Top 3 del periodo">
              <div className="pt-2">
                <Podium top={ranking.slice(0, 3)} />
              </div>
            </SectionCard>
            <SectionCard icon={AlertTriangle} title="Requieren atención" bodyClass="py-1">
              {worst.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted">Todos cumplen el umbral. 🎉</p>
              ) : (
                <div className="divide-y divide-line">
                  {worst.map((r) => (
                    <WorstRow key={r.riderKey} r={r} />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  )
}
