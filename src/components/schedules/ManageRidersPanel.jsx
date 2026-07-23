import { useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { UploadCloud, Loader2, UserMinus, RotateCcw, X, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import { useToast } from '../../state/toast'
import SectionCard from './SectionCard'
import EmptyState from '../common/EmptyState'
import { parseRiderFile, resolveRiderNames, toExclusionRecord } from '../../utils/riderList'

// Panel para dar de BAJA a riders (los oculta del cumplimiento, reversible) subiendo un
// Excel/CSV con sus nombres, y para RESTAURAR a los que estén dados de baja.
export default function ManageRidersPanel({ onClose }) {
  const { riderCandidates, exclusions, excludeRiders, restoreRider, isOwnerOrAdmin, demoMode } = useSchedules()
  const { toast } = useToast()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  // review: { fileName, rows: [{ id, raw, phone, email, options, matchKey, included, kind }] }
  const [review, setReview] = useState(null)

  const canManage = isOwnerOrAdmin || demoMode

  // Índice de opciones por rider_key para poder mostrar el nombre elegido.
  const optionLabel = (opt) => (opt.phone ? `${opt.name} · ${opt.phone}` : opt.name)

  async function onFile(fileList) {
    const file = [...(fileList || [])][0]
    if (!file) return
    setBusy(true)
    try {
      const parsed = await parseRiderFile(file)
      if (!parsed.names.length) {
        toast({ type: 'error', title: 'Sin nombres', message: 'No se han encontrado nombres en el fichero.' })
        setBusy(false)
        return
      }
      const { matched, ambiguous, unmatched } = resolveRiderNames(parsed.names, riderCandidates)
      const rows = []
      let id = 0
      for (const m of matched) {
        rows.push({ id: id++, raw: m.raw, phone: m.phone, email: m.email, options: [m.match], matchKey: m.match.rider_key, included: true, kind: 'matched' })
      }
      for (const a of ambiguous) {
        rows.push({ id: id++, raw: a.raw, phone: a.phone, email: a.email, options: a.options, matchKey: a.options[0]?.rider_key ?? null, included: true, kind: 'ambiguous' })
      }
      for (const u of unmatched) {
        rows.push({ id: id++, raw: u.raw, phone: u.phone, email: u.email, options: [], matchKey: null, included: true, kind: 'unmatched' })
      }
      setReview({ fileName: file.name, rows })
    } catch (e) {
      toast({ type: 'error', title: 'No se pudo leer el fichero', message: e.message })
    }
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function setRow(id, patch) {
    setReview((r) => (r ? { ...r, rows: r.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)) } : r))
  }

  const selectedCount = useMemo(() => (review?.rows || []).filter((r) => r.included).length, [review])

  async function confirm() {
    if (!review) return
    const records = review.rows
      .filter((r) => r.included)
      .map((r) => {
        const match = r.matchKey ? r.options.find((o) => o.rider_key === r.matchKey) || null : null
        return toExclusionRecord(r.raw, match)
      })
    if (!records.length) return
    setBusy(true)
    try {
      const res = await excludeRiders(records)
      toast({ type: 'success', title: 'Riders dados de baja', message: res.demo ? 'Modo demo.' : `${res.excluded} rider(s) ocultados del cumplimiento.` })
      setReview(null)
    } catch (e) {
      toast({ type: 'error', title: 'No se pudo dar de baja', message: e.message })
    }
    setBusy(false)
  }

  async function undo(nameNorm, name) {
    setBusy(true)
    try {
      await restoreRider(nameNorm)
      toast({ type: 'success', title: 'Rider restaurado', message: `${name} vuelve a aparecer en el cumplimiento.` })
    } catch (e) {
      toast({ type: 'error', title: 'No se pudo restaurar', message: e.message })
    }
    setBusy(false)
  }

  return (
    <SectionCard
      icon={UserMinus}
      title="Gestionar bajas de riders"
      subtitle="Sube un Excel/CSV con los riders que ya no trabajan para ocultarlos del cumplimiento."
      right={onClose && (
        <button onClick={onClose} className="text-faint transition hover:text-fg" aria-label="Cerrar"><X className="h-4 w-4" /></button>
      )}
    >
      {!canManage ? (
        <p className="py-4 text-center text-xs text-muted">Solo el propietario o un administrador pueden dar de baja riders.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-line bg-inset/30 p-3 text-[11px] text-muted">
            <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
            <p>
              La baja es <span className="font-medium text-fg">reversible</span> y no borra el histórico: solo oculta al rider en todas las vistas.
              Para <span className="font-medium text-fg">añadir</span> riders nuevos, importa su actividad desde la pestaña «Importar».
            </p>
          </div>

          {!review ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files) }}
              onClick={() => !busy && inputRef.current?.click()}
              className={clsx(
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition',
                dragOver ? 'border-accent bg-accent/5' : 'border-line hover:border-accent/50 hover:bg-inset/40',
                busy && 'pointer-events-none opacity-60',
              )}
            >
              {busy ? <Loader2 className="h-8 w-8 animate-spin text-faint" /> : <UploadCloud className="h-8 w-8 text-faint" />}
              <p className="text-sm font-medium text-fg">Arrastra el Excel/CSV aquí o haz clic para seleccionar</p>
              <p className="text-[11px] text-faint">Basta una columna con los nombres. Admite .xlsx, .csv y .txt.</p>
              <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.csv,.txt,text/csv" className="hidden" onChange={(e) => onFile(e.target.files)} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-fg">Revisar {review.rows.length} nombre(s) · {review.fileName}</p>
                <button onClick={() => setReview(null)} className="text-[11px] text-faint transition hover:text-fg">Cambiar fichero</button>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {review.rows.map((row) => (
                  <div key={row.id} className={clsx('rounded-xl border p-3', row.included ? 'border-line bg-inset/30' : 'border-line/60 bg-transparent opacity-60')}>
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={row.included}
                        onChange={(e) => setRow(row.id, { included: e.target.checked })}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-fg">{row.raw}</p>
                          {row.kind === 'matched' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />}
                          {row.kind === 'ambiguous' && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                        </div>
                        {row.kind === 'matched' && (
                          <p className="truncate text-[11px] text-muted">Coincide con {optionLabel(row.options[0])}</p>
                        )}
                        {row.kind === 'ambiguous' && (
                          <div className="mt-1.5">
                            <p className="mb-1 text-[11px] text-amber-600 dark:text-amber-400">Varias coincidencias · elige la correcta:</p>
                            <select
                              value={row.matchKey ?? ''}
                              onChange={(e) => setRow(row.id, { matchKey: e.target.value || null })}
                              className="w-full rounded-lg border border-line bg-panel px-2 py-1.5 text-xs text-fg outline-none focus:border-accent/60"
                            >
                              {row.options.map((o) => (
                                <option key={o.rider_key} value={o.rider_key}>{optionLabel(o)}</option>
                              ))}
                              <option value="">Ninguna · dar de baja solo por nombre</option>
                            </select>
                          </div>
                        )}
                        {row.kind === 'unmatched' && (
                          <p className="truncate text-[11px] text-faint">Sin coincidencia en el sistema · se dará de baja por nombre.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={confirm}
                disabled={busy || selectedCount === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                {busy ? 'Procesando…' : `Dar de baja ${selectedCount} rider${selectedCount === 1 ? '' : 's'}`}
              </button>
            </div>
          )}

          <div className="border-t border-line pt-3">
            <p className="mb-2 text-xs font-semibold text-fg">Riders dados de baja ({exclusions.length})</p>
            {exclusions.length === 0 ? (
              <EmptyState icon={UserMinus} title="Ninguna baja" hint="Los riders que des de baja aparecerán aquí y podrás restaurarlos." />
            ) : (
              <div className="divide-y divide-line rounded-xl border border-line">
                {exclusions.map((e) => (
                  <div key={e.id || e.name_norm} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <UserMinus className="h-4 w-4 shrink-0 text-faint" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-fg">{e.display_name || e.name_norm}</p>
                      {e.reason && <p className="truncate text-[11px] text-faint">{e.reason}</p>}
                    </div>
                    <button
                      onClick={() => undo(e.name_norm, e.display_name || e.name_norm)}
                      disabled={busy}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-muted transition hover:border-accent/50 hover:text-fg disabled:opacity-60"
                    >
                      <RotateCcw className="h-3 w-3" /> Restaurar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  )
}
