import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { X, Phone, Bike, MapPin, CheckCircle2, Users as UsersIcon, Timer, Power, Package, Percent, Gauge, UserX } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import { aggregateCompliance, rollupByGranularity } from '../../domain/compliance'
import { pushBackHandler } from '../../native/backStack'
import ComplianceHeatmap from './ComplianceHeatmap'
import TrendChart from './TrendChart'
import Segmented from './Segmented'
import { STATUS_META, pctTone, shortDate } from './statusMeta'

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-xl border border-line bg-inset/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-faint">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={clsx('mt-1 text-lg font-bold tabular-nums', tone || 'text-fg')}>{value}</p>
    </div>
  )
}

const GRANS = [
  { id: 'day', label: 'Día' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
]

function bucketLabel(b) {
  if (b.granularity === 'month') {
    const [y, m] = b.bucketKey.split('-')
    return `${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][Number(m) - 1]} ${y}`
  }
  if (b.granularity === 'week') return `${shortDate(b.from)}–${shortDate(b.to)}`
  return shortDate(b.bucketKey)
}

// Ficha de rider: bottom-sheet en móvil, drawer lateral en escritorio.
export default function RiderDetailSheet({ rider, onClose }) {
  const { daily, cfg } = useSchedules()
  const open = !!rider
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const [gran, setGran] = useState('week')

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const t = setTimeout(() => setMounted(false), 300)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    return pushBackHandler(() => {
      onClose?.()
      return true
    })
  }, [open, onClose])

  const rows = useMemo(() => {
    if (!rider) return []
    return daily.filter((d) => d.riderKey === rider.riderKey).sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [daily, rider])

  const agg = useMemo(() => aggregateCompliance(rows), [rows])
  const trend = useMemo(
    () => [...rows].reverse().filter((d) => d.scheduled && d.status !== 'justificado').map((d) => ({ date: d.date, value: d.compliancePct || 0 })),
    [rows],
  )
  const buckets = useMemo(() => rollupByGranularity([...rows].reverse(), gran, cfg).reverse(), [rows, gran, cfg])

  if (!mounted || !rider) return null

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      <div
        className={clsx('absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
      />
      <div
        className={clsx(
          'absolute flex flex-col bg-panel shadow-elev-3 transition-transform duration-300 ease-spring',
          'inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl border-t border-line',
          'md:inset-y-0 md:right-0 md:left-auto md:w-[480px] md:max-h-none md:rounded-none md:border-l md:border-t-0',
          visible ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full',
        )}
      >
        <div className="shrink-0 border-b border-line">
          <div className="flex flex-col items-center pb-1 pt-2 md:hidden">
            <span className="h-1.5 w-10 rounded-full bg-line" />
          </div>
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">{initials(rider.name)}</span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-fg">{rider.name}</h2>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-faint">
                  {(rider.city || agg) && rider.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{rider.city}</span>}
                  {rider.vehicleType && <span className="inline-flex items-center gap-1"><Bike className="h-3 w-3" />{rider.vehicleType}</span>}
                  {rider.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{rider.phone}</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="tappable -mr-1.5 rounded-full p-2 text-muted transition hover:bg-inset hover:text-fg" aria-label="Cerrar">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat icon={CheckCircle2} label="Cumplimiento" value={`${agg.avgCompliancePct}%`} tone={pctTone(agg.avgCompliancePct)} />
            <Stat icon={UsersIcon} label="Asistencia" value={`${agg.attendancePct}%`} />
            <Stat icon={Timer} label="Horas activas" value={`${agg.activeHours}h`} />
            <Stat icon={Power} label="Horas online" value={`${agg.onlineHours}h`} />
            <Stat icon={Package} label="Viajes" value={agg.trips} />
            <Stat icon={Percent} label="Aceptación" value={agg.acceptanceRatePct != null ? `${agg.acceptanceRatePct}%` : '—'} />
            <Stat icon={Gauge} label="Productividad" value={agg.productivity} />
            <Stat icon={UserX} label="Ausencias" value={agg.absences} />
          </div>

          {trend.length >= 2 && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold text-muted">Tendencia de cumplimiento</h3>
              <TrendChart data={trend} threshold={cfg.min_compliance_pct} />
            </div>
          )}

          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted">Actividad ({rows.length} días)</h3>
            <ComplianceHeatmap rows={rows} weeks={12} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-muted">Desglose</h3>
              <Segmented options={GRANS} value={gran} onChange={setGran} size="sm" />
            </div>
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full border-collapse text-left">
                <thead className="bg-inset/40 text-[11px] text-faint">
                  <tr className="border-b border-line">
                    <th className="px-3 py-1.5 font-medium">Periodo</th>
                    <th className="px-3 py-1.5 text-right font-medium">Cumpl.</th>
                    <th className="px-3 py-1.5 text-right font-medium">Asist.</th>
                    <th className="px-3 py-1.5 text-right font-medium">Activas</th>
                    <th className="px-3 py-1.5 text-right font-medium">Viajes</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((b) => (
                    <tr key={b.bucketKey} className="border-b border-line last:border-0">
                      <td className="whitespace-nowrap px-3 py-1.5 text-xs text-fg">{bucketLabel(b)}</td>
                      <td className={clsx('px-3 py-1.5 text-right text-xs font-semibold tabular-nums', pctTone(b.avgCompliancePct))}>{b.avgCompliancePct}%</td>
                      <td className="px-3 py-1.5 text-right text-xs tabular-nums text-muted">{b.attendancePct}%</td>
                      <td className="px-3 py-1.5 text-right text-xs tabular-nums text-muted">{b.activeHours}h</td>
                      <td className="px-3 py-1.5 text-right text-xs tabular-nums text-muted">{b.trips}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted">Historial reciente</h3>
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="max-h-72 divide-y divide-line overflow-y-auto">
                {rows.slice(0, 40).map((d) => {
                  const meta = STATUS_META[d.status]
                  return (
                    <div key={d.date} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-12 shrink-0 text-[11px] tabular-nums text-muted">{shortDate(d.date)}</span>
                      <div className="min-w-0 flex-1 truncate text-[11px] text-faint">
                        {d.scheduled ? `plan ${Math.round((d.plannedMin || 0) / 6) / 10}h · ` : 'extra · '}
                        {(d.activeHours || 0).toFixed(1)}h act · {d.trips || 0} viajes
                      </div>
                      {d.compliancePct != null && <span className="shrink-0 text-xs font-semibold tabular-nums text-fg">{d.compliancePct}%</span>}
                      <span className={clsx('inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', meta?.chip)}>{meta?.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
