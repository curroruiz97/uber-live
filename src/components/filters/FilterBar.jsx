import { useMemo } from 'react'
import clsx from 'clsx'
import { Search, X } from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useFleet } from '../../state/useFleetData'
import { STATUS, STATUS_ORDER } from '../../config/constants'

export default function FilterBar() {
  const { filters, toggleStatusFilter, setZoneFilter, setSearch, resetFilters } = useApp()
  const { riders } = useFleet()
  const isDefault =
    filters.statuses.length === STATUS_ORDER.length && filters.zone === 'all' && !filters.search

  // Zonas derivadas de los riders actuales (demo: Valladolid/Madrid; real: regiones de la flota).
  const zones = useMemo(() => {
    const map = new Map()
    for (const r of riders) {
      if (r.zone && !map.has(r.zone.id)) map.set(r.zone.id, r.zone)
    }
    return [...map.values()].sort((a, b) => (a.label || '').localeCompare(b.label || ''))
  }, [riders])
  const cities = [...new Set(zones.map((z) => z.city))]

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-panel p-3 shadow-elev-1">
      <div className="relative min-w-[180px] flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={filters.search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar rider por nombre…"
          className="w-full rounded-lg border border-line bg-inset py-2 pl-8 pr-3 text-sm text-fg placeholder-faint outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {STATUS_ORDER.map((id) => {
          const s = STATUS[id]
          const on = filters.statuses.includes(id)
          return (
            <button
              key={id}
              onClick={() => toggleStatusFilter(id)}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition',
                on ? `${s.bg} ${s.text} ${s.border}` : 'border-line text-faint hover:text-muted',
              )}
            >
              <span className={clsx('h-1.5 w-1.5 rounded-full', on ? s.dot : 'bg-faint')} />
              {s.label}
            </button>
          )
        })}
      </div>

      <select
        value={filters.zone}
        onChange={(e) => setZoneFilter(e.target.value)}
        className="rounded-lg border border-line bg-inset px-2.5 py-2 text-sm text-muted outline-none transition focus:border-accent/60"
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

      {!isDefault && (
        <button
          onClick={resetFilters}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted transition hover:text-fg"
        >
          <X className="h-3.5 w-3.5" /> Limpiar
        </button>
      )}
    </div>
  )
}
