import { useState } from 'react'
import clsx from 'clsx'
import { Menu, RefreshCw, LogOut, Zap, Search, Power } from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useAuth } from '../../state/AuthContext'
import { useFleet } from '../../state/useFleetData'
import { ENVIRONMENTS } from '../../config/constants'
import LiveIndicator from '../common/LiveIndicator'
import ThemeToggle from '../common/ThemeToggle'
import OrgSwitcher from './OrgSwitcher'

const TITLES = {
  dashboard: 'Dashboard',
  mapa: 'Mapa en vivo',
  riders: 'Riders',
  whatsapp: 'WhatsApp',
  mensatek: 'Mensatek',
  config: 'Ajustes',
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const KBD = isMac ? '⌘K' : 'Ctrl K'

export default function Topbar({ onToggleMobile, onOpenPalette }) {
  const { activeNav, demoMode, environment, disconnect } = useApp()
  const { user, signOut } = useAuth()
  const { secondsUntilRefresh, refreshNow, error } = useFleet()
  const [spinning, setSpinning] = useState(false)

  function handleRefresh() {
    setSpinning(true)
    refreshNow()
    setTimeout(() => setSpinning(false), 700)
  }

  const env = ENVIRONMENTS[environment]

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-app/80 backdrop-blur pt-safe">
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
      <button
        onClick={onToggleMobile}
        className="hidden shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-inset hover:text-fg"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Título + badge de entorno: min-w-0 para que el título trunque y nunca desborde */}
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="truncate text-sm font-semibold text-fg">{TITLES[activeNav] ?? 'Dashboard'}</h1>
        {demoMode ? (
          <span className="hidden shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 sm:inline-flex">
            <Zap className="h-3 w-3" /> Modo demo
          </span>
        ) : (
          <span
            className={clsx(
              'hidden shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium sm:inline-flex',
              environment === 'production'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-line bg-inset text-muted',
            )}
          >
            {env?.label ?? 'Sandbox'}
          </span>
        )}
        <span className="hidden h-4 w-px bg-line lg:block" />
        <OrgSwitcher />
      </div>

      {/* Disparador del command palette (oculto en móvil) */}
      <button
        onClick={onOpenPalette}
        className="ml-2 hidden w-56 shrink items-center justify-between gap-2 rounded-lg border border-line bg-inset px-3 py-1.5 text-xs text-faint transition hover:border-accent/40 hover:text-muted sm:flex lg:w-72"
      >
        <span className="flex items-center gap-2 truncate">
          <Search className="h-3.5 w-3.5 shrink-0" />
          Buscar acciones o riders…
        </span>
        <kbd className="shrink-0 rounded border border-line bg-panel px-1.5 py-0.5 text-[10px] tabular-nums">{KBD}</kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
        {error && (
          <span className="hidden max-w-[220px] truncate text-xs text-red-600 dark:text-red-400 lg:inline" title={error}>
            {error}
          </span>
        )}
        <LiveIndicator seconds={secondsUntilRefresh} />
        <button
          onClick={handleRefresh}
          className="rounded-lg p-1.5 text-muted transition hover:bg-inset hover:text-fg"
          title="Actualizar ahora"
          aria-label="Actualizar ahora"
        >
          <RefreshCw className={clsx('h-4 w-4', spinning && 'animate-spin')} />
        </button>
        <ThemeToggle />
        <button
          onClick={disconnect}
          className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-xs font-medium text-muted transition hover:bg-inset hover:text-fg sm:px-2.5"
          title="Volver a la pantalla de conexión de Uber"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Desconectar</span>
        </button>
        <div className="flex items-center gap-1.5 border-l border-line pl-1.5 sm:pl-3">
          <span className="hidden max-w-[160px] truncate text-xs text-faint lg:inline" title={user?.email}>
            {user?.email}
          </span>
          <button
            onClick={signOut}
            className="rounded-lg p-1.5 text-muted transition hover:bg-red-500/10 hover:text-red-500"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <Power className="h-4 w-4" />
          </button>
        </div>
      </div>
      </div>
    </header>
  )
}
