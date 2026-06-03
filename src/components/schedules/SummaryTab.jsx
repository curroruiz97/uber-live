import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { CheckCircle2, Clock, UserX, Timer, Trophy, Medal } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import { aggregateCompliance, buildRanking } from '../../domain/compliance'
import { periodRange, inRange, periodLabel, fmtMinutes } from '../../utils/period'
import KpiCard from '../kpis/KpiCard'
import EmptyState from '../common/EmptyState'

const PERIODS = [
  { id: 'day', label: 'Día' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
]

function RankRow({ r, top }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span
        className={clsx(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
          r.rank === 1 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            : r.rank <= 3 ? 'bg-accent/10 text-accent'
              : 'bg-inset text-muted',
        )}
      >
        {r.rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{r.name}</p>
        <p className="text-[11px] text-faint">
          {r.attendancePct}% asistencia · {r.punctualityPct}% puntual · {fmtMinutes(r.workedMinutes)}
        </p>
      </div>
      <span
        className={clsx(
          'shrink-0 text-sm font-semibold tabular-nums',
          r.avgCompliancePct >= 90 ? 'text-green-600 dark:text-green-400'
            : r.avgCompliancePct >= 70 ? 'text-amber-600 dark:text-amber-400'
              : 'text-red-600 dark:text-red-400',
        )}
      >
        {r.avgCompliancePct}%
      </span>
    </div>
  )
}

export default function SummaryTab() {
  const { daily, loading } = useSchedules()
  const [period, setPeriod] = useState('week')

  const { from, to } = useMemo(() => periodRange(period), [period])
  const rows = useMemo(() => daily.filter((d) => inRange(d.date, from, to)), [daily, from, to])
  const agg = useMemo(() => aggregateCompliance(rows), [rows])
  const ranking = useMemo(() => buildRanking(rows), [rows])

  const best = ranking.slice(0, 5)
  const worst = ranking.slice(-5).reverse()

  if (loading) return <div className="py-10 text-center text-sm text-muted">Cargando…</div>

  return (
    <div className="space-y-4">
      {/* Selector de periodo */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-grid grid-cols-3 gap-1 rounded-lg bg-inset p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={clsx(
                'rounded-md px-3 py-1.5 text-xs font-medium transition',
                period === p.id ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-faint">{periodLabel(period)}</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Cumplimiento" value={agg.avgCompliancePct} suffix="%" icon={CheckCircle2} accent="emerald" hint={`${agg.days} jornadas`} />
        <KpiCard label="Puntualidad" value={agg.punctualityPct} suffix="%" icon={Clock} accent="sky" hint={`retraso medio ${agg.avgCheckInDelayMin}m`} />
        <KpiCard label="Ausencias" value={agg.absences} icon={UserX} accent="red" hint={`${agg.lates} con retraso`} />
        <KpiCard label="Horas trabajadas" value={Math.round(agg.workedMinutes / 60)} suffix="h" icon={Timer} accent="indigo" hint={`de ${Math.round(agg.plannedMinutes / 60)}h planificadas`} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Trophy} title="Sin datos en este periodo" hint="Sube horarios y deja que el sistema registre la actividad para ver el ranking." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Mejores */}
          <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-elev-1">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-fg">Mejor cumplimiento</h3>
            </div>
            <div className="divide-y divide-line">
              {best.map((r) => <RankRow key={r.riderKey} r={r} top />)}
            </div>
          </section>
          {/* Peores */}
          <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-elev-1">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <Medal className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-semibold text-fg">Requieren atención</h3>
            </div>
            <div className="divide-y divide-line">
              {worst.map((r) => <RankRow key={r.riderKey} r={r} />)}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
