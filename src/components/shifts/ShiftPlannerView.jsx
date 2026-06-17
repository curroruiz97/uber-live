import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { CalendarDays, RefreshCw, Search, Upload } from 'lucide-react'
import { useToast } from '../../state/toast'
import { selection } from '../../native/haptics'
import EmptyState from '../common/EmptyState'
import { PLATFORMS } from './platforms'
import { useShiftPlanner } from './useShiftPlanner'
import RiderCard from './RiderCard'

const TABS = [
  { id: 'uber', label: 'Uber' },
  { id: 'glovo', label: 'Glovo' },
  { id: 'todos', label: 'Todos' },
]

function Pill({ v, l }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel/60 px-2.5 py-1 text-[11px] text-muted">
      <span className="font-semibold tabular-nums text-fg">{v}</span> {l}
    </span>
  )
}

function CityChip({ on, onClick, children }) {
  return (
    <button onClick={onClick} className={clsx('shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition', on ? 'border-accent/40 bg-accent/15 text-accent' : 'border-line text-muted hover:bg-inset hover:text-fg')}>
      {children}
    </button>
  )
}

function EmptyImport({ onImport, busy, canImport }) {
  return (
    <div className="flex animate-fade-in flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-panel/50 px-4 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-inset text-faint">
        <Upload className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-fg">Aún no hay horarios cargados</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">Importa los turnos de los 6 PDFs de Uber (133 riders, 1014 turnos). Después podrás editarlos y añadir estados.</p>
      </div>
      {canImport ? (
        <button onClick={onImport} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
          <Upload className="h-4 w-4" /> {busy ? 'Importando…' : 'Importar de los PDFs'}
        </button>
      ) : (
        <p className="text-xs text-faint">Solo el propietario o un administrador puede importar.</p>
      )}
    </div>
  )
}

export default function ShiftPlannerView() {
  const { toast } = useToast()
  const {
    shifts, absences, loading, busy, isOwnerOrAdmin, matchedPhones,
    addShift, updateShift, removeShift, addAbsence, updateAbsence, removeAbsence, importSeed,
  } = useShiftPlanner()
  const [tab, setTab] = useState('uber')
  const [city, setCity] = useState('all')
  const [q, setQ] = useState('')

  // Envuelve los handlers async para notificar errores sin romper la UI.
  const guard = (fn) => async (...args) => {
    try {
      await fn(...args)
    } catch (e) {
      toast({ type: 'error', title: 'No se pudo guardar', message: e.message })
    }
  }

  // Construye los riders a partir de turnos + estados (incluye riders sin turnos pero con estado, p. ej. bajas).
  const riders = useMemo(() => {
    const map = new Map()
    const ensure = (provider, cty, name, phone) => {
      const k = `${provider}::${cty || ''}::${name}`
      if (!map.has(k)) map.set(k, { key: k, name, city: cty, provider, rider_phone: phone || null, shifts: [], absences: [] })
      const e = map.get(k)
      if (phone && !e.rider_phone) e.rider_phone = phone
      return e
    }
    for (const s of shifts) ensure(s.provider, s.city, s.rider_name, s.rider_phone).shifts.push(s)
    for (const a of absences) ensure(a.provider, a.city, a.rider_name, a.rider_phone).absences.push(a)
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [shifts, absences])

  const cities = useMemo(() => {
    const set = new Set()
    for (const r of riders) if ((tab === 'todos' || r.provider === tab) && r.city) set.add(r.city)
    return [...set].sort()
  }, [riders, tab])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return riders.filter((r) => {
      if (tab !== 'todos' && r.provider !== tab) return false
      if (city !== 'all' && r.city !== city) return false
      if (ql && !r.name.toLowerCase().includes(ql)) return false
      return true
    })
  }, [riders, tab, city, q])

  async function handleImport() {
    try {
      const res = await importSeed()
      toast({ type: 'success', title: 'Horarios importados', message: `${res.shifts} turnos y ${res.absences} estados cargados.` })
    } catch (e) {
      toast({ type: 'error', title: 'No se pudo importar', message: e.message })
    }
  }

  const empty = !loading && riders.length === 0

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-accent/10 via-panel to-panel p-4 shadow-elev-1 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <CalendarDays className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-fg">Horarios</h2>
              <p className="text-xs text-muted">Turnos semanales por rider y estados (bajas, vacaciones, permisos…). Editable y guardado en la nube.</p>
            </div>
          </div>
          {isOwnerOrAdmin && !empty && (
            <button onClick={handleImport} disabled={busy} title="Reimportar los turnos desde los PDFs (reemplaza los actuales)" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-inset disabled:opacity-50">
              <RefreshCw className={clsx('h-3.5 w-3.5', busy && 'animate-spin')} /> Reimportar
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill v={riders.length} l="riders" />
          <Pill v={shifts.length} l="turnos" />
          <Pill v={cities.length} l="ciudades" />
          <Pill v={matchedPhones} l="tel. cruzados" />
        </div>
      </div>

      {empty ? (
        <EmptyImport onImport={handleImport} busy={busy} canImport={isOwnerOrAdmin} />
      ) : (
        <>
          <div>
            <select
              value={tab}
              onChange={(e) => {
                selection()
                setTab(e.target.value)
                setCity('all')
              }}
              aria-label="Plataforma"
              className="w-full rounded-lg border border-line bg-inset px-3 py-2.5 text-sm font-medium text-fg outline-none focus:border-accent/60 sm:hidden"
            >
              {TABS.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <div className="hidden w-full grid-cols-3 gap-1.5 rounded-xl bg-inset p-1.5 sm:grid">
              {TABS.map((t) => {
                const on = tab === t.id
                const plat = PLATFORMS[t.id]
                const Icon = plat?.Icon
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (t.id !== tab) {
                        selection()
                        setTab(t.id)
                        setCity('all')
                      }
                    }}
                    aria-pressed={on}
                    className={clsx('flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition', on ? 'bg-panel text-fg shadow-sm ring-1 ring-line' : 'text-muted hover:bg-panel/50 hover:text-fg')}
                  >
                    {Icon && <Icon className="h-5 w-5" />}
                    <span>{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {cities.length > 0 && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              <CityChip on={city === 'all'} onClick={() => setCity('all')}>Todas</CityChip>
              {cities.map((c) => (
                <CityChip key={c} on={city === c} onClick={() => setCity(c)}>{c}</CityChip>
              ))}
            </div>
          )}

          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar rider…" className="w-full rounded-lg border border-line bg-inset py-2 pl-8 pr-2 text-sm text-fg placeholder-faint outline-none focus:border-accent/60" />
          </div>

          <div className="flex items-center justify-between text-xs text-faint">
            <span className="tabular-nums">{filtered.length} riders</span>
            {matchedPhones === 0 && <span>teléfono pendiente (Uber sin conectar)</span>}
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-muted">Cargando…</p>
          ) : filtered.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Sin riders" hint="Ajusta el filtro o reimporta los PDFs." />
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {filtered.map((r) => (
                <RiderCard
                  key={r.key}
                  rider={r}
                  shifts={r.shifts}
                  absences={r.absences}
                  showBadge={tab === 'todos'}
                  onAddShift={guard(addShift)}
                  onUpdateShift={guard(updateShift)}
                  onRemoveShift={guard(removeShift)}
                  onAddAbsence={guard(addAbsence)}
                  onUpdateAbsence={guard(updateAbsence)}
                  onRemoveAbsence={guard(removeAbsence)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
