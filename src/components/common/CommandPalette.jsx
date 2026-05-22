import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  Search,
  LayoutDashboard,
  Map as MapIcon,
  Users,
  Settings,
  Sun,
  Moon,
  Monitor,
  CornerDownLeft,
} from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useFleet } from '../../state/useFleetData'
import { useTheme } from '../../state/ThemeContext'
import { STATUS } from '../../config/constants'
import StatusBadge from './StatusBadge'

export default function CommandPalette({ open, onClose }) {
  const { setActiveNav, selectRider } = useApp()
  const { riders } = useFleet()
  const { setTheme } = useTheme()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
      const t = setTimeout(() => inputRef.current?.focus(), 20)
      return () => clearTimeout(t)
    }
    return undefined
  }, [open])

  const items = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const actions = [
      { id: 'nav-dashboard', group: 'Navegación', label: 'Ir a Dashboard', icon: LayoutDashboard, run: () => setActiveNav('dashboard') },
      { id: 'nav-mapa', group: 'Navegación', label: 'Ir a Mapa en vivo', icon: MapIcon, run: () => setActiveNav('mapa') },
      { id: 'nav-riders', group: 'Navegación', label: 'Ir a Riders', icon: Users, run: () => setActiveNav('riders') },
      { id: 'nav-config', group: 'Navegación', label: 'Ir a Ajustes', icon: Settings, run: () => setActiveNav('config') },
      { id: 'theme-light', group: 'Tema', label: 'Tema: Claro', icon: Sun, run: () => setTheme('light') },
      { id: 'theme-dark', group: 'Tema', label: 'Tema: Oscuro', icon: Moon, run: () => setTheme('dark') },
      { id: 'theme-system', group: 'Tema', label: 'Tema: Sistema', icon: Monitor, run: () => setTheme('system') },
    ].filter((i) => !ql || i.label.toLowerCase().includes(ql))

    const riderMatches = (ql ? riders.filter((r) => r.name.toLowerCase().includes(ql)) : riders)
      .slice(0, 6)
      .map((r) => ({
        id: `rider-${r.id}`,
        group: 'Riders',
        label: r.name,
        rider: r,
        run: () => selectRider(r.id),
      }))

    return [...actions, ...riderMatches]
  }, [q, riders, setActiveNav, setTheme, selectRider])

  useEffect(() => {
    setActive(0)
  }, [q])

  function runItem(item) {
    if (!item) return
    item.run()
    onClose()
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runItem(items[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!open) return null

  let lastGroup = null
  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-black/50 p-4 pt-[10vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl animate-scale-in flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-3">
          <Search className="h-4 w-4 text-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar acciones o riders…"
            className="w-full bg-transparent py-3 text-sm text-fg placeholder-faint outline-none"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-faint">Esc</kbd>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-faint">Sin resultados</li>
          )}
          {items.map((item, idx) => {
            const Icon = item.icon
            const showHeader = item.group !== lastGroup
            lastGroup = item.group
            const s = item.rider ? STATUS[item.rider.status] ?? STATUS.offline : null
            return (
              <li key={item.id}>
                {showHeader && (
                  <div className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-faint">
                    {item.group}
                  </div>
                )}
                <button
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => runItem(item)}
                  className={clsx(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition',
                    idx === active ? 'bg-accent/15 text-fg' : 'text-muted hover:bg-inset',
                  )}
                >
                  {Icon ? (
                    <Icon className="h-4 w-4 shrink-0 text-faint" />
                  ) : (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: s?.hex }}
                    />
                  )}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.rider && <StatusBadge status={item.rider.status} size="sm" />}
                  {idx === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-faint" />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
