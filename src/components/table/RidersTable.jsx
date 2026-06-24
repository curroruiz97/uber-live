import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { ArrowUpDown, Users, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useApp, filterRiders } from '../../state/AppContext'
import { useFleet } from '../../state/useFleetData'
import { useWhatsApp } from '../../state/whatsapp'
import { useSchedules } from '../../state/schedules'
import { getRidersOnShiftNow } from '../../domain/compliance'
import { digits } from '../../utils/glovoDaily'
import { useNow } from '../../state/useNow'
import { STATUS_ORDER } from '../../config/constants'
import EmptyState from '../common/EmptyState'
import WhatsAppIcon from '../common/WhatsAppIcon'
import RiderRow from './RiderRow'
import BulkSendModal from '../whatsapp/BulkSendModal'
import { impactMedium } from '../../native/haptics'

const PAGE_SIZE = 10

const COLUMNS = [
  { key: 'name', label: 'Rider', sortable: true, className: '' },
  { key: 'status', label: 'Estado', sortable: true, className: 'hidden sm:table-cell' },
  { key: 'order', label: 'Pedido actual', sortable: false, className: 'hidden sm:table-cell' },
  { key: 'route', label: 'Tiempo en ruta', sortable: true, className: 'hidden md:table-cell' },
  { key: 'location', label: 'Última ubicación', sortable: false, className: 'hidden lg:table-cell' },
  { key: 'actions', label: '', sortable: false, className: 'text-right' },
]

export default function RidersTable() {
  const { filters, selectedRiderId, selectRider } = useApp()
  const { riders } = useFleet()
  const { selectedIds, selectMany, clearSelection } = useWhatsApp()
  const { shiftPlans } = useSchedules()
  const now = useNow(1000)

  const shiftByPhone = useMemo(() => {
    const onShift = getRidersOnShiftNow(shiftPlans, now)
    const map = new Map()
    for (const s of onShift) map.set(s.riderKey, s)
    return map
  }, [shiftPlans, now])
  const [sort, setSort] = useState({ key: 'status', dir: 'asc' })
  const [page, setPage] = useState(0)
  const [bulkOpen, setBulkOpen] = useState(false)
  const selectAllRef = useRef(null)

  const visible = useMemo(() => filterRiders(riders, filters), [riders, filters])

  const sorted = useMemo(() => {
    const arr = [...visible]
    arr.sort((a, b) => {
      if (sort.key === 'name') {
        return sort.dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      }
      let av
      let bv
      if (sort.key === 'status') {
        av = STATUS_ORDER.indexOf(a.status)
        bv = STATUS_ORDER.indexOf(b.status)
      } else if (sort.key === 'route') {
        av = a.routeStartedAt ?? Number.POSITIVE_INFINITY
        bv = b.routeStartedAt ?? Number.POSITIVE_INFINITY
      } else {
        av = 0
        bv = 0
      }
      return sort.dir === 'asc' ? av - bv : bv - av
    })
    return arr
  }, [visible, sort])

  useEffect(() => {
    setPage(0)
  }, [filters, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const start = safePage * PAGE_SIZE
  const pageRows = sorted.slice(start, start + PAGE_SIZE)

  const pageAllSelected = pageRows.length > 0 && pageRows.every((r) => selectedIds.has(r.id))
  const pageSomeSelected = pageRows.some((r) => selectedIds.has(r.id))
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = pageSomeSelected && !pageAllSelected
  }, [pageSomeSelected, pageAllSelected])

  const selectedRiders = useMemo(() => riders.filter((r) => selectedIds.has(r.id)), [riders, selectedIds])

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-elev-1">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-fg">Riders</h2>
        <span className="text-xs text-faint">
          {sorted.length} de {riders.length}
        </span>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-accent/5 px-4 py-2">
          <span className="text-sm font-medium text-fg">{selectedIds.size} seleccionados</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                impactMedium()
                setBulkOpen(true)
              }}
              className="tappable inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white shadow-elev-1 transition hover:opacity-90"
            >
              <WhatsAppIcon className="h-3.5 w-3.5" /> Enviar WhatsApp a seleccionados
            </button>
            <button
              onClick={clearSelection}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted transition hover:text-fg"
            >
              <X className="h-3.5 w-3.5" /> Limpiar
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead className="bg-inset/40">
          <tr className="border-b border-line">
            <th className="w-9 px-3 py-2">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={pageAllSelected}
                onChange={(e) => selectMany(pageRows.map((r) => r.id), e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-accent"
                aria-label="Seleccionar página"
              />
            </th>
            {COLUMNS.map((col) => (
              <th key={col.key} className={clsx('px-3 py-2 text-xs font-medium text-faint', col.className)}>
                {col.sortable ? (
                  <button
                    onClick={() => toggleSort(col.key)}
                    className={clsx(
                      'inline-flex items-center gap-1 transition hover:text-fg',
                      sort.key === col.key && 'text-fg',
                    )}
                  >
                    {col.label}
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((rider, i) => (
            <RiderRow
              key={rider.id}
              rider={rider}
              now={now}
              index={i}
              selected={rider.id === selectedRiderId}
              onSelect={selectRider}
              shiftInfo={rider.phone ? shiftByPhone.get(digits(rider.phone)) : null}
            />
          ))}
        </tbody>
      </table>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin riders que coincidan"
          hint="Ajusta los filtros o la búsqueda para ver más resultados."
        />
      ) : (
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
          <span className="tabular-nums">
            {start + 1}–{Math.min(start + PAGE_SIZE, sorted.length)} de {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
              className="tappable rounded-lg p-1.5 text-muted transition hover:bg-inset hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-1 tabular-nums">
              {safePage + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              disabled={safePage >= pageCount - 1}
              className="tappable rounded-lg p-1.5 text-muted transition hover:bg-inset hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <BulkSendModal open={bulkOpen} onClose={() => setBulkOpen(false)} riders={selectedRiders} />
    </div>
  )
}
