import { useRef, useState } from 'react'
import clsx from 'clsx'
import { UploadCloud, FileText, Loader2, CheckCircle2, X } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import { useToast } from '../../state/toast'
import EmptyState from '../common/EmptyState'
import SectionCard from './SectionCard'
import IdentityLinkPanel from './IdentityLinkPanel'

function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function ImportTab() {
  const { importGlovoDaily, imports, isOwnerOrAdmin, demoMode } = useSchedules()
  const { toast } = useToast()
  const inputRef = useRef(null)
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  const canImport = isOwnerOrAdmin || demoMode

  function pick(list) {
    const arr = [...(list || [])].filter((f) => f.name.toLowerCase().endsWith('.csv'))
    setFiles(arr)
    setResult(null)
  }

  async function run() {
    if (!files.length) return
    setBusy(true)
    setResult(null)
    try {
      const res = await importGlovoDaily(files, (p) => setProgress(p))
      setResult(res)
      setFiles([])
      if (inputRef.current) inputRef.current.value = ''
      toast({ type: 'success', title: 'Actividad importada', message: res.demo ? 'Modo demo.' : `${res.rowsUpserted} jornadas · ${res.newRiders} riders nuevos` })
    } catch (e) {
      toast({ type: 'error', title: 'No se pudo importar', message: e.message })
    }
    setBusy(false)
    setProgress(null)
  }

  return (
    <div className="space-y-4">
      <SectionCard icon={UploadCloud} title="Subir CSV de actividad" subtitle="Formato COURIER_DAILY. Acepta varios ficheros (y el histórico consolidado) a la vez.">
        {!canImport ? (
          <p className="py-4 text-center text-xs text-muted">Solo el propietario o un administrador pueden importar actividad.</p>
        ) : (
          <div className="space-y-3">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files) }}
              onClick={() => inputRef.current?.click()}
              className={clsx(
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition',
                dragOver ? 'border-accent bg-accent/5' : 'border-line hover:border-accent/50 hover:bg-inset/40',
              )}
            >
              <UploadCloud className="h-8 w-8 text-faint" />
              <p className="text-sm font-medium text-fg">Arrastra los CSV aquí o haz clic para seleccionar</p>
              <p className="text-[11px] text-faint">¿Primera carga? Selecciona el histórico (HISTORICO_GLOVO_CONSOLIDADO.csv) o todos los diarios a la vez.</p>
              <input ref={inputRef} type="file" accept=".csv,text/csv" multiple className="hidden" onChange={(e) => pick(e.target.files)} />
            </div>

            {files.length > 0 && (
              <div className="rounded-xl border border-line bg-inset/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-fg">{files.length} fichero{files.length === 1 ? '' : 's'} seleccionado{files.length === 1 ? '' : 's'}</p>
                  <button onClick={() => { setFiles([]); if (inputRef.current) inputRef.current.value = '' }} className="text-faint transition hover:text-fg" aria-label="Quitar"><X className="h-4 w-4" /></button>
                </div>
                <div className="max-h-32 space-y-1 overflow-y-auto">
                  {files.slice(0, 12).map((f) => (
                    <div key={f.name} className="flex items-center gap-2 text-[11px] text-muted">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-faint" />
                      <span className="truncate">{f.name}</span>
                    </div>
                  ))}
                  {files.length > 12 && <p className="text-[11px] text-faint">… y {files.length - 12} más</p>}
                </div>
                <button
                  onClick={run}
                  disabled={busy}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  {busy ? 'Importando…' : `Importar ${files.length} fichero${files.length === 1 ? '' : 's'}`}
                </button>
                {busy && progress && (
                  <p className="mt-2 text-center text-[11px] text-muted">
                    {progress.phase === 'parsing' ? 'Leyendo' : 'Subiendo'} {progress.index + 1}/{progress.total}: <span className="text-fg">{progress.file}</span>
                    {progress.batches > 1 ? ` · lote ${progress.batch}/${progress.batches}` : ''}
                  </p>
                )}
              </div>
            )}

            {result && !result.demo && (
              <div className="flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/5 p-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                <div className="text-xs text-fg">
                  <p className="font-semibold">Importación completada</p>
                  <p className="mt-0.5 text-muted">
                    {result.files} fichero(s) · <span className="font-medium text-fg">{result.rowsUpserted}</span> jornadas ·{' '}
                    <span className="font-medium text-fg">{result.newRiders}</span> riders nuevos
                    {result.skipped ? ` · ${result.skipped} omitidas (exportación más antigua)` : ''}
                  </p>
                  {result.dateMin && <p className="mt-0.5 text-faint">Rango: {fmtDate(result.dateMin)} – {fmtDate(result.dateMax)}</p>}
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      <IdentityLinkPanel />

      <SectionCard icon={FileText} title="Importaciones recientes" bodyClass="p-0">
        {(!imports || imports.length === 0) ? (
          <div className="p-2"><EmptyState icon={FileText} title="Sin importaciones" hint="Aquí quedará el registro de cada CSV subido." /></div>
        ) : (
          <div className="divide-y divide-line">
            {imports.map((im) => (
              <div key={im.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <FileText className="h-4 w-4 shrink-0 text-faint" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-fg">{im.filename || 'CSV'}</p>
                  <p className="text-[11px] text-faint">{im.date_min ? `${fmtDate(im.date_min)} – ${fmtDate(im.date_max)}` : ''}</p>
                </div>
                <span className="shrink-0 tabular-nums text-muted">{im.rows_upserted} jorn.{im.new_riders ? ` · +${im.new_riders}` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
