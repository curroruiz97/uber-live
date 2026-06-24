import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Radio, UserCheck, UserX, Clock, AlertCircle } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import { useFleet } from '../../state/useFleetData'
import { getRidersOnShiftNow } from '../../domain/compliance'
import { digits } from '../../utils/glovoDaily'
import SectionCard from './SectionCard'

function StatusDot({ color }) {
  return <span className={clsx('inline-block h-2 w-2 shrink-0 rounded-full', color)} />
}

function phoneSuffix(s) {
  const d = digits(s)
  return d.length > 9 ? d.slice(-9) : d
}

export default function LiveComplianceCard() {
  const { shiftPlans, demoMode } = useSchedules()
  const { riders: fleetRiders } = useFleet()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const onShift = useMemo(() => getRidersOnShiftNow(shiftPlans, now), [shiftPlans, now])

  const fleetByPhone = useMemo(() => {
    const map = new Map()
    for (const r of fleetRiders || []) {
      if (r.phone) map.set(phoneSuffix(r.phone), r)
    }
    return map
  }, [fleetRiders])

  const hasFleet = fleetByPhone.size > 0

  const classified = useMemo(() => {
    if (!hasFleet) return { connected: [], missing: [] }
    const connected = []
    const missing = []
    for (const s of onShift) {
      const fleetR = fleetByPhone.get(phoneSuffix(s.riderKey))
      if (fleetR && fleetR.status !== 'offline') {
        connected.push({ ...s, status: fleetR.status, fleetName: fleetR.name })
      } else {
        missing.push(s)
      }
    }
    return { connected, missing }
  }, [onShift, fleetByPhone, hasFleet])

  if (demoMode || onShift.length === 0) return null

  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <SectionCard icon={Radio} title="En turno ahora" subtitle={hhmm}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
            <Clock className="h-4 w-4 text-faint" /> {onShift.length} en turno
          </span>
          {hasFleet && (
            <>
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <UserCheck className="h-4 w-4" /> {classified.connected.length} conectados
              </span>
              {classified.missing.length > 0 && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-red-600 dark:text-red-400">
                  <UserX className="h-4 w-4" /> {classified.missing.length} ausentes
                </span>
              )}
            </>
          )}
        </div>

        {!hasFleet && (
          <>
            <p className="text-xs text-muted">Sin datos de flota en vivo. Conecta Uber en producción desde Ajustes &gt; Integraciones para ver quién está conectado.</p>
            <div className="overflow-hidden rounded-lg border border-line">
              <div className="max-h-40 divide-y divide-line overflow-y-auto">
                {onShift.map((r) => (
                  <div key={r.riderKey} className="flex items-center gap-2 px-3 py-1.5">
                    <StatusDot color="bg-zinc-400" />
                    <span className="min-w-0 flex-1 truncate text-xs text-fg">{r.name}</span>
                    <span className="shrink-0 text-[10px] text-faint">{r.inicio}–{r.fin}</span>
                    {r.city && <span className="shrink-0 text-[10px] text-faint">{r.city}</span>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {hasFleet && classified.missing.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
              <AlertCircle className="h-3.5 w-3.5" /> Deberían estar conectados
            </div>
            <div className="overflow-hidden rounded-lg border border-red-200 dark:border-red-900/40">
              <div className="max-h-40 divide-y divide-line overflow-y-auto">
                {classified.missing.map((r) => (
                  <div key={r.riderKey} className="flex items-center gap-2 px-3 py-1.5">
                    <StatusDot color="bg-red-500" />
                    <span className="min-w-0 flex-1 truncate text-xs text-fg">{r.name}</span>
                    <span className="shrink-0 text-[10px] text-faint">{r.inicio}–{r.fin}</span>
                    {r.city && <span className="shrink-0 text-[10px] text-faint">{r.city}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {hasFleet && classified.connected.length > 0 && (
          <div>
            <div className="mb-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Conectados en turno</div>
            <div className="overflow-hidden rounded-lg border border-line">
              <div className="max-h-40 divide-y divide-line overflow-y-auto">
                {classified.connected.map((r) => (
                  <div key={r.riderKey} className="flex items-center gap-2 px-3 py-1.5">
                    <StatusDot color={r.status === 'en_entrega' ? 'bg-sky-500' : r.status === 'en_ruta' ? 'bg-amber-500' : 'bg-emerald-500'} />
                    <span className="min-w-0 flex-1 truncate text-xs text-fg">{r.fleetName || r.name}</span>
                    <span className="shrink-0 text-[10px] text-faint">{r.inicio}–{r.fin}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  )
}
