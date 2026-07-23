import { useMemo, useState, useEffect } from 'react'
import clsx from 'clsx'
import { Search, Users as UsersIcon, ChevronRight, ChevronLeft, UserMinus } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import { buildRiderStats } from '../../domain/compliance'
import { inRange } from '../../utils/period'
import Sparkline from '../common/Sparkline'
import EmptyState from '../common/EmptyState'
import Segmented from './Segmented'
import RangeControls from './RangeControls'
import { usePeriodRange } from './usePeriodRange'
import RiderDetailSheet from './RiderDetailSheet'
import ManageRidersPanel from './ManageRidersPanel'
import { STATUS_META, pctTone, pctHex } from './statusMeta'

const PAGE_SIZE = 18

const PERIODS = [
  { id: 'day', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'all', label: 'Histórico' },
  { id: 'custom', label: 'Fechas' },
]
const SORTS = [
  { id: 'compliance', label: '% cumpl.' },
  { id: 'name', label: 'Nombre' },
  { id: 'absences', label: 'Ausencias' },
]

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()
}

export default function RidersTab() {
  const { daily, roster, loading, isOwnerOrAdmin, demoMode } = useSchedules()
  const ctl = usePeriodRange('month')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('compliance')
  const [sel, setSel] = useState(null)
  const [page, setPage] = useState(0)
  const [manage, setManage] = useState(false)

  const metaByKey = useMemo(() => {
    const m = new Map()
    for (const r of roster) m.set(r.riderKey, r)
    return m
  }, [roster])

  const rows = useMemo(() => {
    const { from, to } = ctl.range
    return daily.filter((d) => inRange(d.date, from, to))
  }, [daily, ctl.range])

  const stats = useMemo(() => {
    let s = buildRiderStats(rows, metaByKey)
    const ql = q.trim().toLowerCase()
    if (ql) s = s.filter((r) => r.name.toLowerCase().includes(ql))
    return [...s].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'absences') return b.absences - a.absences || b.avgCompliancePct - a.avgCompliancePct
      return b.avgCompliancePct - a.avgCompliancePct || a.name.localeCompare(b.name)
    })
  }, [rows, metaByKey, q, sort])

  useEffect(() => { setPage(0) }, [ctl.range, q, sort])

  const pageCount = Math.max(1, Math.ceil(stats.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageStats = stats.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  if (loading) return <div className="py-10 text-center text-sm text-muted">Cargando…</div>

  const canManage = isOwnerOrAdmin || demoMode

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={() => setManage((v) => !v)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
              manage ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted hover:border-accent/50 hover:text-fg',
            )}
          >
            <UserMinus className="h-3.5 w-3.5" /> Gestionar bajas
          </button>
        </div>
      )}

      {canManage && manage && <ManageRidersPanel onClose={() => setManage(false)} />}

      <div className="space-y-2">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar rider…"
            className="w-full rounded-lg border border-line bg-inset py-2 pl-8 pr-2 text-sm text-fg placeholder-faint outline-none transition focus:border-accent/60"
          />
        </div>
        <RangeControls ctl={ctl} presets={PERIODS} />
        <Segmented options={SORTS} value={sort} onChange={setSort} fullWidth />
        <div className="flex items-center justify-between text-xs text-faint">
          <span className="tabular-nums">{stats.length} riders</span>
          <span>{ctl.label}</span>
        </div>
      </div>

      {stats.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Sin riders" hint="Cuando se capture actividad o subas horarios, aquí verás a cada rider con su cumplimiento." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pageStats.map((r) => {
              const meta = STATUS_META[r.lastStatus] || null
              const acceptPct = r.acceptanceRatePct
              return (
                <button
                  key={r.riderKey}
                  onClick={() => setSel(r)}
                  className="group flex flex-col rounded-2xl border border-line bg-panel p-4 text-left shadow-elev-1 transition hover:border-line-strong"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">{initials(r.name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-fg">{r.name}</p>
                      <p className="truncate text-[11px] text-faint">
                        {r.city || '—'}
                        {r.programmedDays ? ` · ${r.programmedDays} jornadas` : ''}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-muted" />
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div>
                      <span className={clsx('text-2xl font-bold tabular-nums', pctTone(r.avgCompliancePct))}>{r.avgCompliancePct}%</span>
                      <span className="ml-1 text-[11px] text-faint">cumpl.</span>
                    </div>
                    {r.trend.length > 1 && <Sparkline data={r.trend} width={84} height={28} color={pctHex(r.avgCompliancePct)} />}
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 border-t border-line pt-3 text-center">
                    <div>
                      <p className="text-xs font-semibold tabular-nums text-fg">{r.attendancePct}%</p>
                      <p className="text-[10px] text-faint">asist.</p>
                    </div>
                    <div>
                      <p className={clsx('text-xs font-semibold tabular-nums', acceptPct != null && acceptPct < 90 ? 'text-red-500' : 'text-fg')}>{acceptPct != null ? `${acceptPct}%` : '—'}</p>
                      <p className="text-[10px] text-faint">acept.</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold tabular-nums text-fg">{r.onlineHours}h</p>
                      <p className="text-[10px] text-faint">online</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold tabular-nums text-fg">{r.absences}</p>
                      <p className="text-[10px] text-faint">ausencias</p>
                    </div>
                  </div>
                  {meta && (
                    <div className="mt-3 flex items-center gap-1.5">
                      <span className={clsx('h-1.5 w-1.5 rounded-full', meta.dot)} />
                      <span className="text-[11px] text-muted">
                        último: {meta.label}
                        {r.lastDate ? ` · ${r.lastDate.slice(8, 10)}/${r.lastDate.slice(5, 7)}` : ''}
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          {pageCount > 1 && (
            <div className="flex items-center justify-between rounded-2xl border border-line bg-panel px-4 py-2.5 text-xs text-muted shadow-elev-1">
              <span className="tabular-nums">{stats.length} riders</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} className="rounded-lg p-1.5 text-muted transition hover:bg-inset hover:text-fg disabled:opacity-40" aria-label="Anterior">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-1 tabular-nums">{safePage + 1} / {pageCount}</span>
                <button onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))} disabled={safePage >= pageCount - 1} className="rounded-lg p-1.5 text-muted transition hover:bg-inset hover:text-fg disabled:opacity-40" aria-label="Siguiente">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <RiderDetailSheet rider={sel} onClose={() => setSel(null)} />
    </div>
  )
}
