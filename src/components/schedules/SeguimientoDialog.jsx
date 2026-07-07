import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { X, FileSpreadsheet, Loader2 } from 'lucide-react'
import DatePicker from '../common/DatePicker'
import { useToast } from '../../state/toast'
import { buildSeguimiento, generateSeguimientoXlsx } from '../../utils/seguimiento'

// Pop-up del botón "Excel Seguimiento": elegir rango de días + ciudades y generar el
// Excel con formato/colores. Los datos salen del motor de cumplimiento (daily).
export default function SeguimientoDialog({ daily, rosterByKey, onClose }) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const allDates = useMemo(() => [...new Set((daily || []).map((d) => d.date))].sort(), [daily])
  const cityOptions = useMemo(() => [...new Set((daily || []).map((d) => d.city).filter(Boolean))].sort(), [daily])

  const [from, setFrom] = useState(allDates.length ? allDates[Math.max(0, allDates.length - 7)] : '')
  const [to, setTo] = useState(allDates.length ? allDates[allDates.length - 1] : '')
  const [cities, setCities] = useState([]) // vacío = todas

  const dates = useMemo(
    () => allDates.filter((d) => (!from || d >= from) && (!to || d <= to)),
    [allDates, from, to],
  )

  function toggleCity(c) {
    setCities((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  async function generate() {
    if (!dates.length) return toast({ type: 'warning', title: 'No hay días con datos en ese rango' })
    setBusy(true)
    try {
      const data = buildSeguimiento(daily, rosterByKey, { dates, cities: cities.length ? cities : null })
      if (!data.riders.length) {
        setBusy(false)
        return toast({ type: 'warning', title: 'Sin riders', message: 'Ningún rider en las ciudades/días elegidos.' })
      }
      const fn = `SEGUIMIENTO_${(from || '').replaceAll('-', '')}_${(to || '').replaceAll('-', '')}.xlsx`
      await generateSeguimientoXlsx(data, fn)
      toast({ type: 'success', title: 'Excel de seguimiento generado', message: `${data.riders.length} riders · ${dates.length} días` })
      onClose()
    } catch (e) {
      toast({ type: 'error', title: 'No se pudo generar el Excel', message: e.message })
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-line bg-panel p-5 shadow-elev-2" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"><FileSpreadsheet className="h-5 w-5" /></span>
            <div>
              <h3 className="text-sm font-bold text-fg">Excel de seguimiento</h3>
              <p className="text-[11px] text-muted">Elige los días y las ciudades a incluir.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-faint transition hover:bg-inset hover:text-fg"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Días</label>
            <div className="flex flex-wrap items-center gap-2">
              <DatePicker value={from} onChange={setFrom} placeholder="Desde" />
              <span className="text-xs text-faint">→</span>
              <DatePicker value={to} onChange={setTo} placeholder="Hasta" />
              <span className="ml-auto text-[11px] tabular-nums text-faint">{dates.length} día{dates.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Ciudades {cities.length === 0 && <span className="text-faint">(todas)</span>}</label>
            {cityOptions.length === 0 ? (
              <p className="text-[11px] text-faint">Sin ciudades en los datos.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {cityOptions.map((c) => {
                  const on = cities.includes(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCity(c)}
                      className={clsx('rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition', on ? 'bg-accent/15 text-accent ring-1 ring-accent/30' : 'bg-inset text-muted hover:text-fg')}
                    >
                      {c.toLowerCase()}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-muted transition hover:text-fg">Cancelar</button>
          <button onClick={generate} disabled={busy || !dates.length} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Generar Excel
          </button>
        </div>
      </div>
    </div>
  )
}
