import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Search, Download, History as HistoryIcon, ChevronLeft, ChevronRight, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import { COMPLIANCE_STATUS } from '../../domain/compliance'
import { downloadCsv } from '../../utils/csv'
import DatePicker from '../common/DatePicker'
import EmptyState from '../common/EmptyState'
import SeguimientoDialog from './SeguimientoDialog'
import { STATUS_META } from './statusMeta'

const PAGE_SIZE = 14

function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
const h1 = (min) => `${Math.round((min || 0) / 6) / 10}h`

export default function HistoryTab() {
  const { daily, roster, loading } = useSchedules()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [showSeguimiento, setShowSeguimiento] = useState(false)

  const suspectDates = useMemo(() => {
    const dates = new Set()
    for (const d of daily) if (d.suspect) dates.add(d.date)
    return dates
  }, [daily])

  const cityByKey = useMemo(() => {
    const m = new Map()
    for (const r of roster) m.set(r.riderKey, r.city)
    return m
  }, [roster])

  // Rider meta (teléfono/ciudad/nombre) por clave, para el Excel de seguimiento.
  const rosterByKey = useMemo(() => {
    const m = new Map()
    for (const r of roster) m.set(r.riderKey, { name: r.name, phone: r.phone, city: r.city })
    return m
  }, [roster])

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return daily
      .filter((d) => {
        if (status !== 'all' && d.status !== status) return false
        if (from && d.date < from) return false
        if (to && d.date > to) return false
        if (ql && !(d.name || '').toLowerCase().includes(ql)) return false
        return true
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.name || '').localeCompare(b.name || '')))
  }, [daily, status, from, to, q])

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  function exportCsv() {
    downloadCsv(
      `cumplimiento_${from || 'inicio'}_${to || 'fin'}.csv`,
      [
        { key: 'date', label: 'Fecha' }, { key: 'name', label: 'Rider' }, { key: 'city', label: 'Ciudad' },
        { key: 'estado', label: 'Estado' }, { key: 'plan', label: 'Plan (h)' }, { key: 'act', label: 'Horas activas' },
        { key: 'onl', label: 'Horas online' }, { key: 'pct', label: 'Cumplimiento %' }, { key: 'viajes', label: 'Viajes' },
        { key: 'acept', label: 'Aceptación %' }, { key: 'cancel', label: 'Cancelados' }, { key: 'tarde', label: 'Entregas tarde' },
        { key: 'km', label: 'Km totales' },
      ],
      rows.map((r) => {
        const assigned = (r.accept || 0) + (r.reject || 0)
        return {
          date: fmtDate(r.date), name: r.name, city: r.city || cityByKey.get(r.riderKey) || '',
          estado: COMPLIANCE_STATUS[r.status]?.label ?? r.status,
          plan: Math.round((r.plannedMin || 0) / 6) / 10, act: Math.round((r.activeHours || 0) * 10) / 10,
          onl: Math.round((r.onlineHours || 0) * 10) / 10, pct: r.compliancePct ?? '', viajes: r.trips || 0,
          acept: assigned ? Math.round((r.accept / assigned) * 100) : '', cancel: r.cancel || 0,
          tarde: (r.lateP2 || 0) + (r.lateP3 || 0), km: Math.round((r.totalKm || 0) * 10) / 10,
        }
      }),
    )
  }

  if (loading) return <div className="py-10 text-center text-sm text-muted">Cargando…</div>

  return (
    <div className="space-y-3">
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
          <option value="parcial">Parcial</option>
          <option value="ausente">Ausente</option>
          <option value="justificado">Justificado</option>
          <option value="extra">Extra</option>
        </select>
        <DatePicker value={from} onChange={(v) => { setFrom(v); setPage(0) }} placeholder="Desde" />
        <DatePicker value={to} onChange={(v) => { setTo(v); setPage(0) }} placeholder="Hasta" />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowSeguimiento(true)}
            disabled={!daily.length}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel Seguimiento
          </button>
          <button
            onClick={exportCsv}
            disabled={!rows.length}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Descargar CSV
          </button>
        </div>
      </div>

      {suspectDates.size > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-xs text-fg">
            <p className="font-semibold">Datos parciales detectados</p>
            <p className="mt-0.5 text-muted">
              El CSV de Uber no ha procesado las horas online de{' '}
              {[...suspectDates].sort().map((d) => fmtDate(d)).join(', ')}.
              Los viajes aparecen pero las horas están congeladas. Se corregirá al importar un CSV posterior.
            </p>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={HistoryIcon} title="Sin registros" hint="Ajusta los filtros o sube los CSV de actividad para empezar a medir el cumplimiento." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-elev-1">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-inset/40">
                <tr className="border-b border-line text-xs text-faint">
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Rider</th>
                  <th className="hidden px-3 py-2 font-medium lg:table-cell">Ciudad</th>
                  <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Plan</th>
                  <th className="px-3 py-2 text-right font-medium">Online</th>
                  <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Activas</th>
                  <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Viajes</th>
                  <th className="hidden px-3 py-2 text-right font-medium lg:table-cell">Acept.</th>
                  <th className="px-3 py-2 text-right font-medium">%</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => {
                  const meta = STATUS_META[r.status]
                  const assigned = (r.accept || 0) + (r.reject || 0)
                  return (
                    <tr key={`${r.riderKey}-${r.date}`} className={clsx('border-b border-line transition-colors hover:bg-inset/50', r.suspect && 'bg-amber-500/5')}>
                      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted">
                        {r.suspect && <AlertTriangle className="mr-1 inline h-3 w-3 text-amber-500" title="Horas sin procesar por Uber" />}
                        {fmtDate(r.date)}
                      </td>
                      <td className="px-3 py-2 text-sm text-fg">{r.name}</td>
                      <td className="hidden px-3 py-2 text-xs text-muted lg:table-cell">{r.city || '—'}</td>
                      <td className="hidden px-3 py-2 text-right text-sm tabular-nums text-muted sm:table-cell">{r.scheduled ? h1(r.plannedMin) : '—'}</td>
                      <td className="px-3 py-2 text-right text-sm tabular-nums text-muted">{(r.onlineHours || 0).toFixed(1)}h</td>
                      <td className="hidden px-3 py-2 text-right text-sm tabular-nums text-muted md:table-cell">{(r.activeHours || 0).toFixed(1)}h</td>
                      <td className="hidden px-3 py-2 text-right text-sm tabular-nums text-muted md:table-cell">{r.trips || 0}</td>
                      <td className="hidden px-3 py-2 text-right text-sm tabular-nums text-muted lg:table-cell">{assigned ? `${Math.round((r.accept / assigned) * 100)}%` : '—'}</td>
                      <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-fg">{r.compliancePct != null ? `${r.compliancePct}%` : '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', meta?.chip)}>{meta?.label ?? r.status}</span>
                      </td>
                    </tr>
                  )
                })}
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

      {showSeguimiento && (
        <SeguimientoDialog daily={daily} rosterByKey={rosterByKey} onClose={() => setShowSeguimiento(false)} />
      )}
    </div>
  )
}
