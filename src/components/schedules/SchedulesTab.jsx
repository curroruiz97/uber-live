import { useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Upload, FileCheck2, AlertTriangle, CheckCircle2, Download, CalendarClock } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import { useToast } from '../../state/toast'
import { parseScheduleCsv } from '../../utils/schedules'
import { downloadCsv } from '../../utils/csv'
import { fmtMinutes } from '../../utils/period'
import EmptyState from '../common/EmptyState'

function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function SchedulesTab() {
  const { schedules, roster, importSchedules, isOwnerOrAdmin } = useSchedules()
  const { toast } = useToast()
  const [preview, setPreview] = useState(null) // { rows, total, ok, failed, unmatched }
  const [importing, setImporting] = useState(false)
  const [filename, setFilename] = useState('')
  const fileRef = useRef(null)

  const rosterKeys = useMemo(() => new Set(roster.map((r) => r.riderKey)), [roster])

  // Próximos turnos planificados (ordenados por fecha desc), para la vista de lista.
  const upcoming = useMemo(
    () => [...schedules].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 50),
    [schedules],
  )

  function handleFile(file) {
    if (!file) return
    setFilename(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const { rows, total } = parseScheduleCsv(String(reader.result || ''))
      const withMatch = rows.map((r) => ({ ...r, matched: r.ok && rosterKeys.has(r.riderKey) }))
      const ok = withMatch.filter((r) => r.ok).length
      const failed = total - ok
      const unmatched = withMatch.filter((r) => r.ok && !r.matched).length
      setPreview({ rows: withMatch, total, ok, failed, unmatched })
    }
    reader.readAsText(file, 'utf-8')
  }

  async function confirmImport() {
    if (!preview) return
    setImporting(true)
    try {
      const res = await importSchedules(preview.rows)
      toast({ type: 'success', title: 'Horarios importados', message: `${res.imported} turnos cargados${res.demo ? ' (demo)' : ''}.` })
      setPreview(null)
      setFilename('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      toast({ type: 'error', title: 'No se pudo importar', message: e.message })
    }
    setImporting(false)
  }

  function downloadTemplate() {
    downloadCsv(
      'plantilla_horarios.csv',
      [
        { key: 'telefono', label: 'telefono' },
        { key: 'nombre', label: 'nombre' },
        { key: 'fecha', label: 'fecha' },
        { key: 'hora_inicio', label: 'hora_inicio' },
        { key: 'hora_fin', label: 'hora_fin' },
      ],
      [
        { telefono: '+34 611 111 001', nombre: 'Lucía Fernández', fecha: '01/06/2026', hora_inicio: '10:00', hora_fin: '14:00' },
        { telefono: '+34 611 111 002', nombre: 'Mateo Gómez', fecha: '01/06/2026', hora_inicio: '16:00', hora_fin: '21:00' },
      ],
    )
  }

  return (
    <div className="space-y-4">
      {/* Subida */}
      <section className="rounded-2xl border border-line bg-panel p-4 shadow-elev-1 sm:p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Upload className="h-4.5 w-4.5" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-fg">Subir horarios (CSV)</h3>
            <p className="text-xs text-muted">Columnas: <span className="font-mono">telefono;nombre;fecha;hora_inicio;hora_fin</span> · fecha DD/MM/AAAA · hora HH:MM</p>
          </div>
        </div>

        {!isOwnerOrAdmin ? (
          <p className="mt-4 rounded-lg border border-line bg-inset/40 p-3 text-xs text-muted">Solo el propietario o un administrador pueden subir horarios.</p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => handleFile(e.target.files?.[0])} className="hidden" id="schedule-file" />
            <label htmlFor="schedule-file" className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110">
              <Upload className="h-4 w-4" /> Elegir archivo
            </label>
            {filename && <span className="text-xs text-muted">{filename}</span>}
            <button onClick={downloadTemplate} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-fg transition hover:bg-inset">
              <Download className="h-3.5 w-3.5" /> Descargar plantilla
            </button>
          </div>
        )}

        {/* Previsualización */}
        {preview && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 font-medium text-green-600 dark:text-green-400"><CheckCircle2 className="h-3.5 w-3.5" /> {preview.ok} válidos</span>
              {preview.failed > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 font-medium text-red-600 dark:text-red-400"><AlertTriangle className="h-3.5 w-3.5" /> {preview.failed} con error</span>}
              {preview.unmatched > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-600 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5" /> {preview.unmatched} sin emparejar</span>}
            </div>

            <div className="max-h-64 overflow-auto rounded-lg border border-line">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-inset/80 backdrop-blur">
                  <tr className="text-faint">
                    <th className="px-2.5 py-1.5 font-medium">Teléfono</th>
                    <th className="px-2.5 py-1.5 font-medium">Nombre</th>
                    <th className="px-2.5 py-1.5 font-medium">Fecha</th>
                    <th className="px-2.5 py-1.5 font-medium">Turno</th>
                    <th className="px-2.5 py-1.5 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 200).map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-2.5 py-1.5 font-mono text-muted">{r.phone}</td>
                      <td className="px-2.5 py-1.5 text-fg">{r.name}</td>
                      <td className="px-2.5 py-1.5 tabular-nums text-muted">{r.date ? fmtDate(r.date) : '—'}</td>
                      <td className="px-2.5 py-1.5 tabular-nums text-muted">{r.ok ? `${r.start}–${r.end}` : '—'}</td>
                      <td className="px-2.5 py-1.5">
                        {!r.ok ? <span className="text-red-600 dark:text-red-400">{r.error}</span>
                          : !r.matched ? <span className="text-amber-600 dark:text-amber-400">sin emparejar</span>
                            : <span className="text-green-600 dark:text-green-400">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => { setPreview(null); setFilename(''); if (fileRef.current) fileRef.current.value = '' }} className="rounded-lg border border-line px-3 py-2 text-sm text-muted transition hover:bg-inset">Cancelar</button>
              <button onClick={confirmImport} disabled={importing || preview.ok === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
                <FileCheck2 className="h-4 w-4" /> Importar {preview.ok} turnos
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Lista de turnos planificados */}
      <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-elev-1">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <CalendarClock className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-fg">Turnos planificados</h3>
          <span className="rounded-full bg-inset px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted">{schedules.length}</span>
        </div>
        {upcoming.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Aún no hay turnos" hint="Sube un CSV con los horarios de tus riders para empezar." />
        ) : (
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-panel/95 backdrop-blur">
                <tr className="border-b border-line text-xs text-faint">
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium">Rider</th>
                  <th className="px-4 py-2 font-medium">Turno</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">Duración</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((s, i) => (
                  <tr key={`${s.riderKey}-${s.date}-${i}`} className="border-b border-line transition-colors hover:bg-inset/50">
                    <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums text-muted">{fmtDate(s.date)}</td>
                    <td className="px-4 py-2 text-sm text-fg">{s.name || s.riderKey}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm tabular-nums text-muted">
                      {new Date(s.plannedStart).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {new Date(s.plannedEnd).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="hidden px-4 py-2 text-sm tabular-nums text-muted sm:table-cell">{fmtMinutes(s.plannedMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
