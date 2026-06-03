import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Trophy, Download } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import { buildRanking } from '../../domain/compliance'
import { periodRange, inRange, periodLabel, fmtMinutes } from '../../utils/period'
import { downloadCsv } from '../../utils/csv'
import EmptyState from '../common/EmptyState'
import Segmented from './Segmented'
import SectionCard from './SectionCard'
import Podium from './Podium'
import { pctTone } from './statusMeta'

const PERIODS = [
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'all', label: 'Histórico' },
]

function rankBadge(rank) {
  if (rank === 1) return 'bg-amber-400/20 text-amber-600 dark:text-amber-400'
  if (rank === 2) return 'bg-slate-400/20 text-slate-600 dark:text-slate-300'
  if (rank === 3) return 'bg-orange-400/20 text-orange-600 dark:text-orange-400'
  return 'bg-inset text-muted'
}

export default function RankingTab() {
  const { daily, roster, loading } = useSchedules()
  const [period, setPeriod] = useState('month')

  const nameByKey = useMemo(() => {
    const m = new Map()
    for (const r of roster) m.set(r.riderKey, r.name)
    return m
  }, [roster])

  const rows = useMemo(() => {
    const base =
      period === 'all'
        ? daily
        : (() => {
            const { from, to } = periodRange(period)
            return daily.filter((d) => inRange(d.date, from, to))
          })()
    return base.map((d) => ({ ...d, name: d.name || nameByKey.get(d.riderKey) || d.riderKey }))
  }, [daily, nameByKey, period])

  const ranking = useMemo(() => buildRanking(rows), [rows])

  function exportCsv() {
    downloadCsv(
      `ranking_${period}.csv`,
      [
        { key: 'rank', label: 'Puesto' },
        { key: 'name', label: 'Rider' },
        { key: 'cumpl', label: 'Cumplimiento %' },
        { key: 'asist', label: 'Asistencia %' },
        { key: 'punt', label: 'Puntualidad %' },
        { key: 'retraso', label: 'Retraso medio (min)' },
        { key: 'aus', label: 'Ausencias' },
        { key: 'horas', label: 'Horas reales (min)' },
      ],
      ranking.map((r) => ({
        rank: r.rank,
        name: r.name,
        cumpl: r.avgCompliancePct,
        asist: r.attendancePct,
        punt: r.punctualityPct,
        retraso: r.avgCheckInDelayMin,
        aus: r.absences,
        horas: r.workedMinutes,
      })),
    )
  }

  if (loading) return <div className="py-10 text-center text-sm text-muted">Cargando…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Segmented options={PERIODS} value={period} onChange={setPeriod} />
        <span className="text-xs text-faint">{period === 'all' ? 'histórico' : periodLabel(period)}</span>
      </div>

      {ranking.length === 0 ? (
        <EmptyState icon={Trophy} title="Sin ranking" hint="Cuando haya jornadas registradas, aquí aparecerá la clasificación de riders." />
      ) : (
        <>
          {ranking.length >= 3 && (
            <SectionCard icon={Trophy} title="Podio">
              <div className="pt-2">
                <Podium top={ranking.slice(0, 3)} />
              </div>
            </SectionCard>
          )}

          <SectionCard
            icon={Trophy}
            title="Clasificación"
            subtitle={`${ranking.length} riders`}
            bodyClass="p-0"
            right={
              <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-medium text-fg transition hover:bg-inset">
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="bg-inset/40 text-xs text-faint">
                  <tr className="border-b border-line">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Rider</th>
                    <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Asist.</th>
                    <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Puntual</th>
                    <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Retraso</th>
                    <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Horas</th>
                    <th className="px-3 py-2 text-right font-medium">Cumpl.</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r) => (
                    <tr key={r.riderKey} className="border-b border-line transition-colors hover:bg-inset/50">
                      <td className="px-3 py-2">
                        <span className={clsx('flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold tabular-nums', rankBadge(r.rank))}>{r.rank}</span>
                      </td>
                      <td className="px-3 py-2 text-sm text-fg">{r.name}</td>
                      <td className="hidden px-3 py-2 text-right text-sm tabular-nums text-muted sm:table-cell">{r.attendancePct}%</td>
                      <td className="hidden px-3 py-2 text-right text-sm tabular-nums text-muted sm:table-cell">{r.punctualityPct}%</td>
                      <td className="hidden px-3 py-2 text-right text-sm tabular-nums text-muted md:table-cell">{r.avgCheckInDelayMin}m</td>
                      <td className="hidden px-3 py-2 text-right text-sm tabular-nums text-muted md:table-cell">{fmtMinutes(r.workedMinutes)}</td>
                      <td className={clsx('px-3 py-2 text-right text-sm font-bold tabular-nums', pctTone(r.avgCompliancePct))}>{r.avgCompliancePct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}
