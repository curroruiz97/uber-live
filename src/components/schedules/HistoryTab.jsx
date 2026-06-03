import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Search, Download, History as HistoryIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import { COMPLIANCE_STATUS } from '../../domain/compliance'
import { downloadCsv } from '../../utils/csv'
import { fmtMinutes } from '../../utils/period'
import DatePicker from '../common/DatePicker'
import EmptyState from '../common/EmptyState'

const PAGE_SIZE = 12

const STATUS_CLS = {
  cumple: 'bg-green-500/10 text-green-600 dark:text-green-400',
  tarde: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  incompleto: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  ausente: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function fmtDelay(min) {
  if (min == null) return '—'
  if (min <= 0) return 'a tiempo'
  return `+${min}m`
}

export default function HistoryTab() {
  const { daily, roster, loading } = useSchedules()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)

  const nameByKey = useMemo(() => {
    const m = new Map()
    for (const r of roster) m.set(r.riderKey, r.name)
    return m
  }, [roster])

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return daily
      .map((d) => ({ ...d, name: d.name || nameByKey.get(d.riderKey) || d.riderKey }))
      .filter((d) => {
        if (status !== 'all' && d.status !== status) return false
        if (from && d.date < from) return false
        if (to && d.date > to) return false
        if (ql && !d.name.toLowerCase().includes(ql)) return false
        return true
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.name.localeCompare(b.name)))
  }, [daily, status, from, to, q, nameByKey])

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  function exportCsv() {
    downloadCsv(
      `cumplimiento_${from || 'inicio'}_${to || 'fin'}.csv`,
      [
        { key: 'date', label: 'Fecha' },
        { key: 'name', label: 'Rider' },
        { key: 'planned', label: 'Plan (min)' },
        { key: 'worked', label: 'Real (min)' },
        { key: 'delay', label: 'Retraso (min)' },
        { key: 'pct', label: 'Cumplimiento %' },
        { key: 'status', label: 'Estado' },
      ],
      rows.map((r) => ({
        date: fmtDate(r.date),
        name: r.name,
        planned: r.plannedMinutes,
        worked: r.workedMinutes,
        delay: r.checkInDelayMin ?? '',
        pct: r.compliancePct,
        status: COMPLIANCE_STATUS[r.status]?.label ?? r.status,
      })),
    )
  }

  if (loading) return <div className="py-10 text-center text-sm text-muted">Cargando…</div>

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:flex-initial">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0) }}
            placeholder="Buscar rider…"
            className="w-full rounded-lg border border-line bg-inset py-1.5 pl-7 pr-2 text-xs text-fg placeholder-faint outline-none transition focus:border-accent/60 sm:w-44"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0) }}
          className="rounded-lg border border-line bg-inset px-2.5 py-1.5 text-xs text-fg outline-none focus:border-accent/60"
        >
          <option value="all">Todos los estados</option>
          <option value="cumple">Cumple</option>
          <option value="tarde">Tarde</option>
          <option value="incompleto">Incompleto</option>
          <option value="ausente">Ausente</option>
        </select>
        <DatePicker value={from} onChange={(v) => { setFrom(v); setPage(0) }} placeholder="Desde" />
        <DatePicker value={to} onChange={(v) => { setTo(v); setPage(0) }} placeholder="Hasta" />
        <button
          onClick={exportCsv}
          disabled={!rows.length}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> Descargar CSV
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={HistoryIcon} title="Sin registros" hint="Ajusta los filtros o sube horarios para empezar a medir el cumplimiento." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-elev-1">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-inset/40">
                <tr className="border-b border-line text-xs text-faint">
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Rider</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">Plan</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">Real</th>
                  <th className="hidden px-3 py-2 font-medium md:table-cell">Entrada</th>
                  <th className="px-3 py-2 font-medium">%</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={`${r.riderKey}-${r.date}`} className="border-b border-line transition-colors hover:bg-inset/50">
                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted">{fmtDate(r.date)}</td>
                    <td className="px-3 py-2 text-sm text-fg">{r.name}</td>
                    <td className="hidden px-3 py-2 text-sm tabular-nums text-muted sm:table-cell">{fmtMinutes(r.plannedMinutes)}</td>
                    <td className="hidden px-3 py-2 text-sm tabular-nums text-muted sm:table-cell">{fmtMinutes(r.workedMinutes)}</td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-sm tabular-nums text-muted md:table-cell">{fmtDelay(r.checkInDelayMin)}</td>
                    <td className="px-3 py-2 text-sm font-semibold tabular-nums text-fg">{r.compliancePct}%</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_CLS[r.status])}>
                        {COMPLIANCE_STATUS[r.status]?.label ?? r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
            <span className="tabular-nums">{rows.length} registros</span>
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
        </div>
      )}
    </div>
  )
}
