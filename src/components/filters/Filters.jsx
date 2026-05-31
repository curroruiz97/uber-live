import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useFleet } from '../../state/useFleetData'
import { STATUS, STATUS_ORDER } from '../../config/constants'
import Sheet from '../common/Sheet'
import FilterBar from './FilterBar'
import { selection, impactLight } from '../../native/haptics'

// Filtros responsivos:
//  - Escritorio (md+): la barra inline de siempre (FilterBar).
//  - Móvil: campo de búsqueda + botón "Filtros" que abre una hoja inferior con los
//    chips de estado y la zona. Mantiene una sola fuente de verdad (AppContext).
export default function Filters() {
  return (
    <>
      <div className="hidden md:block">
        <FilterBar />
      </div>
      <MobileFilters />
    </>
  )
}

function MobileFilters() {
  const { filters, toggleStatusFilter, setZoneFilter, setSearch, resetFilters } = useApp()
  const { riders } = useFleet()
  const [open, setOpen] = useState(false)

  const zones = useMemo(() => {
    const map = new Map()
    for (const r of riders) {
      if (r.zone && !map.has(r.zone.id)) map.set(r.zone.id, r.zone)
    }
    return [...map.values()].sort((a, b) => (a.label || '').localeCompare(b.label || ''))
  }, [riders])
  const cities = [...new Set(zones.map((z) => z.city))]

  const statusCount = STATUS_ORDER.length - filters.statuses.length
  const zoneCount = filters.zone !== 'all' ? 1 : 0
  const activeCount = statusCount + zoneCount

  return (
    <div className="md:hidden">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar rider…"
            className="w-full rounded-lg border border-line bg-panel py-2.5 pl-8 pr-3 text-sm text-fg placeholder-faint outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <button
          onClick={() => {
            impactLight()
            setOpen(true)
          }}
          className={clsx(
            'tappable relative inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition',
            activeCount > 0
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-line bg-panel text-muted',
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {activeCount > 0 && (
            <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Filtrar riders"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => {
                impactLight()
                resetFilters()
              }}
              className="tappable flex-1 rounded-xl border border-line bg-inset py-3 text-sm font-medium text-muted transition"
            >
              Limpiar
            </button>
            <button
              onClick={() => {
                impactLight()
                setOpen(false)
              }}
              className="tappable flex-[2] rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-elev-1 transition"
            >
              Ver resultados
            </button>
          </div>
        }
      >
        <div className="space-y-5 py-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Estado</h3>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((id) => {
                const s = STATUS[id]
                const on = filters.statuses.includes(id)
                return (
                  <button
                    key={id}
                    onClick={() => {
                      selection()
                      toggleStatusFilter(id)
                    }}
                    className={clsx(
                      'tappable inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition',
                      on ? `${s.bg} ${s.text} ${s.border}` : 'border-line text-faint',
                    )}
                  >
                    <span className={clsx('h-2 w-2 rounded-full', on ? s.dot : 'bg-faint')} />
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Zona</h3>
            <select
              value={filters.zone}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="w-full rounded-lg border border-line bg-inset px-3 py-2.5 text-sm text-fg outline-none transition focus:border-accent/60"
            >
              <option value="all">Todas las zonas</option>
              {cities.map((city) => (
                <optgroup key={city} label={city}>
                  {zones
                    .filter((z) => z.city === city)
                    .map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          {filters.search && (
            <button
              onClick={() => setSearch('')}
              className="inline-flex items-center gap-1 text-xs text-muted transition active:text-fg"
            >
              <X className="h-3.5 w-3.5" /> Quitar búsqueda «{filters.search}»
            </button>
          )}
        </div>
      </Sheet>
    </div>
  )
}
