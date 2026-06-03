import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { CheckCircle2, Clock, UserX, Timer, Users as UsersIcon, TimerReset, TrendingUp, PieChart, Trophy, AlertTriangle } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import { aggregateCompliance, buildRanking, statusBreakdown, trendByDate } from '../../domain/compliance'
import { periodRange, inRange, periodLabel } from '../../utils/period'
import KpiCard from '../kpis/KpiCard'
import EmptyState from '../common/EmptyState'
import TrendChart from './TrendChart'
import StatusDonut from './StatusDonut'
import Podium from './Podium'
import Segmented from './Segmented'
import SectionCard from './SectionCard'
import { pctTone, pctHex } from './statusMeta'

const PERIODS = [
  { id: 'day', label: 'Día' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
]
const PROVIDERS = [
  { id: 'all', label: 'Todos' },
  { id: 'uber', label: 'Uber' },
  { id: 'glovo', label: 'Glovo' },
]

// Rango del periodo inmediatamente anterior (para deltas).
function prevRange(period, from) {
  const [y, m, d] = from.split('-').map(Number)
  const ref = new Date(y, m - 1, d)
  ref.setDate(ref.getDate() - 1)
  return periodRange(period, ref)
}

function ProviderSplit({ split }) {
  const rows = [
    { id: 'uber', label: 'Uber' },
    { id: 'glovo', label: 'Glovo' },
  ]
  const has = rows.some((r) => (split[r.id]?.days || 0) > 0)
  if (!has) return <p className="py-6 text-center text-xs text-muted">Sin datos por proveedor en este periodo.</p>
  return (
    <div className="space-y-3.5">
      {rows.map((r) => {
        const a = split[r.id] || {}
        if (!(a.days > 0)) return null
        const pct = a.avgCompliancePct || 0
        return (
          <div key={r.id}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-fg">{r.label}</span>
              <span className={clsx('font-semibold tabular-nums', pctTone(pct))}>{pct}% · {a.days} jorn.</span>
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
        <p className="text-[11px] text-faint">{r.attendancePct}% asist · {r.absences} ausencias</p>
      </div>
      <span className={clsx('shrink-0 text-sm font-semibold tabular-nums', pctTone(r.avgCompliancePct))}>{r.avgCompliancePct}%</span>
    </div>
  )
}

export default function SummaryTab() {
  const { daily, roster, cfg, loading } = useSchedules()
  const [period, setPeriod] = useState('week')
  const [provider, setProvider] = useState('all')

  const metaByKey = useMemo(() => {
    const m = new Map()
    for (const r of roster) m.set(r.riderKey, r)
    return m
  }, [roster])

  const enriched = useMemo(
    () =>
      daily.map((d) => {
        const meta = metaByKey.get(d.riderKey)
        return { ...d, provider: d.provider || meta?.provider || null, name: d.name || meta?.name || d.riderKey }
      }),
    [daily, metaByKey],
  )

  const { from, to } = useMemo(() => periodRange(period), [period])
  const inPeriod = useMemo(() => enriched.filter((d) => inRange(d.date, from, to)), [enriched, from, to])
  const rows = useMemo(() => (provider === 'all' ? inPeriod : inPeriod.filter((d) => d.provider === provider)), [inPeriod, provider])

  const agg = useMemo(() => aggregateCompliance(rows), [rows])
  const breakdown = useMemo(() => statusBreakdown(rows), [rows])
  const trend = useMemo(() => trendByDate(rows), [rows])
  const ranking = useMemo(() => buildRanking(rows), [rows])

  const prev = useMemo(() => {
    const pr = prevRange(period, from)
    const pRows = enriched.filter((d) => inRange(d.date, pr.from, pr.to) && (provider === 'all' || d.provider === provider))
    return aggregateCompliance(pRows)
  }, [enriched, period, from, provider])

  const split = useMemo(() => {
    const out = {}
    for (const p of ['uber', 'glovo']) out[p] = aggregateCompliance(inPeriod.filter((d) => d.provider === p))
    return out
  }, [inPeriod])

  if (loading) return <div className="py-10 text-center text-sm text-muted">Cargando…</div>

  const compHistory = trend.map((t) => t.avgCompliancePct)
  const attHistory = trend.map((t) => t.attendancePct)
  const worst = ranking.slice(-5).reverse().filter((r) => r.avgCompliancePct < 90)
  const dlt = (cur, p) => (prev.days ? cur - p : null)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented options={PERIODS} value={period} onChange={setPeriod} />
          <Segmented options={PROVIDERS} value={provider} onChange={setProvider} />
        </div>
        <span className="text-xs text-faint">{periodLabel(period)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Cumplimiento" value={agg.avgCompliancePct} suffix="%" icon={CheckCircle2} accent="emerald" history={compHistory} delta={dlt(agg.avgCompliancePct, prev.avgCompliancePct)} hint={`${agg.days} jornadas`} />
        <KpiCard label="Puntualidad" value={agg.punctualityPct} suffix="%" icon={Clock} accent="sky" history={attHistory} delta={dlt(agg.punctualityPct, prev.punctualityPct)} hint={`retraso medio ${agg.avgCheckInDelayMin}m`} />
        <KpiCard label="Asistencia" value={agg.attendancePct} suffix="%" icon={UsersIcon} accent="indigo" delta={dlt(agg.attendancePct, prev.attendancePct)} hint={`${agg.days - agg.absences}/${agg.days} jornadas`} />
        <KpiCard label="Ausencias" value={agg.absences} icon={UserX} accent="red" hint={`${agg.lates} con retraso`} />
        <KpiCard label="Horas reales" value={Math.round(agg.workedMinutes / 60)} suffix="h" icon={Timer} accent="amber" hint={`de ${Math.round(agg.plannedMinutes / 60)}h plan`} />
        <KpiCard label="Retraso medio" value={agg.avgCheckInDelayMin} suffix="m" icon={TimerReset} accent="amber" hint="entrada vs plan" />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Sin datos en este periodo" hint="Sube horarios y deja que el sistema registre la actividad para ver el cumplimiento." />
      ) : (
        <>
          <SectionCard icon={TrendingUp} title="Tendencia de cumplimiento" subtitle={`media diaria · umbral ${cfg.min_compliance_pct}%`}>
            <TrendChart data={trend.map((t) => ({ date: t.date, value: t.avgCompliancePct }))} threshold={cfg.min_compliance_pct} />
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard icon={PieChart} title="Distribución por estado">
              <StatusDonut breakdown={breakdown} />
            </SectionCard>
            <SectionCard icon={UsersIcon} title="Por proveedor">
              <ProviderSplit split={split} />
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
                <p className="py-6 text-center text-xs text-muted">Todos por encima del 90%. 🎉</p>
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
