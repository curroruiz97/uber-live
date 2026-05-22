import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { ShieldCheck, Lock, Globe, Palette } from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useFleetData, FleetContext } from '../../state/useFleetData'
import { useToast } from '../../state/toast'
import { ENVIRONMENTS, POLL_INTERVAL_MS } from '../../config/constants'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import KpiCards from '../kpis/KpiCards'
import FleetMap from '../map/FleetMap'
import FilterBar from '../filters/FilterBar'
import RidersTable from '../table/RidersTable'
import ActivityFeed from '../feed/ActivityFeed'
import RiderDetailDrawer from '../rider/RiderDetailDrawer'
import CommandPalette from '../common/CommandPalette'
import Skeleton from '../common/Skeleton'
import { ThemeSegmented } from '../common/ThemeToggle'
import WhatsAppView from '../whatsapp/WhatsAppView'
import WhatsAppIcon from '../common/WhatsAppIcon'
import { useWhatsApp } from '../../state/whatsapp'

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Skeleton className="h-[360px] md:h-[440px]" />
          <Skeleton className="h-12" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-[480px]" />
      </div>
    </div>
  )
}

function ConfigView() {
  const { demoMode, environment, token, disconnect } = useApp()
  const { settings, setContactMessage } = useWhatsApp()
  const masked = token ? `${token.slice(0, 4)}••••••••${token.slice(-4)}` : '—'
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-xl border border-line bg-panel p-5 shadow-soft">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Palette className="h-4 w-4 text-accent" /> Apariencia
        </h2>
        <p className="mb-3 mt-1 text-sm text-muted">Elige el tema de la interfaz.</p>
        <ThemeSegmented />
      </div>

      <div className="rounded-xl border border-line bg-panel p-5 shadow-soft">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <WhatsAppIcon className="h-4 w-4 text-[#25D366]" /> WhatsApp
        </h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          Mensaje predefinido del botón de contacto rápido (wa.me). Variables:{' '}
          <code className="font-mono text-xs text-accent">{'{nombre}'}</code>,{' '}
          <code className="font-mono text-xs text-accent">{'{pedido_id}'}</code>,{' '}
          <code className="font-mono text-xs text-accent">{'{store}'}</code>.
        </p>
        <textarea
          value={settings.contactMessage}
          onChange={(e) => setContactMessage(e.target.value)}
          rows={2}
          className="w-full resize-y rounded-lg border border-line bg-inset px-2.5 py-2 text-sm text-fg outline-none transition focus:border-accent/60"
        />
        <p className="mt-2 text-xs text-faint">
          Las plantillas de envío masivo y el log se gestionan en la sección <strong>WhatsApp</strong>.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-panel p-5 shadow-soft">
        <h2 className="text-sm font-semibold text-fg">Conexión</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted">Modo</dt>
            <dd className="font-medium text-fg">{demoMode ? 'Demo (datos simulados)' : 'API real de Uber'}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Entorno</dt>
            <dd className="font-medium text-fg">{ENVIRONMENTS[environment]?.label ?? '—'}</dd>
          </div>
          {!demoMode && (
            <>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Autenticación</dt>
                <dd className="font-medium text-fg">Proxy local · client credentials</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Destino Uber</dt>
                <dd className="font-mono text-xs text-muted">{ENVIRONMENTS[environment]?.baseUrl}</dd>
              </div>
              {token && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Token manual</dt>
                  <dd className="font-mono text-xs text-muted">{masked}</dd>
                </div>
              )}
            </>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-muted">Intervalo de polling</dt>
            <dd className="font-medium text-fg">{POLL_INTERVAL_MS / 1000}s</dd>
          </div>
        </dl>
        <button
          onClick={disconnect}
          className="mt-5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted transition hover:bg-inset hover:text-fg"
        >
          Desconectar y cambiar credenciales
        </button>
      </div>

      <div className="space-y-2 rounded-xl border border-line bg-panel p-5 text-sm text-muted shadow-soft">
        <p className="flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
          Las credenciales viven solo en memoria (no en localStorage) y se pierden al recargar.
        </p>
        <p className="flex items-start gap-2">
          <Globe className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
          Las llamadas reales pasan por el backend (server/) que guarda el secret y evita el bloqueo
          CORS de Uber. Configura credenciales y rutas en{' '}
          <span className="font-mono text-xs text-fg">.env</span>.
        </p>
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
          La 3PL Consumer Delivery API está en early-access: las rutas y campos se mapean en{' '}
          <span className="font-mono text-xs text-fg">api/normalize.js</span> y son el único punto a
          ajustar contra el spec real.
        </p>
      </div>
    </div>
  )
}

function Content({ activeNav }) {
  if (activeNav === 'config') return <ConfigView />

  if (activeNav === 'whatsapp') return <WhatsAppView />

  if (activeNav === 'riders') {
    return (
      <div className="space-y-4">
        <KpiCards />
        <FilterBar />
        <RidersTable />
      </div>
    )
  }

  if (activeNav === 'mapa') {
    return (
      <div className="space-y-4">
        <KpiCards />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-3">
            <FilterBar />
            <FleetMap height="h-[60vh]" />
          </div>
          <ActivityFeed />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <KpiCards />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <FleetMap />
          <FilterBar />
          <RidersTable />
        </div>
        <ActivityFeed />
      </div>
    </div>
  )
}

export default function DashboardLayout() {
  const app = useApp()
  const { selectedRiderId, clearSelection } = app
  const fleet = useFleetData({
    demoMode: app.demoMode,
    token: app.token,
    environment: app.environment,
    connected: app.connected,
  })
  const { toast } = useToast()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Atajos de teclado globales.
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      } else if (e.key === 'Escape' && !paletteOpen && selectedRiderId) {
        clearSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen, selectedRiderId, clearSelection])

  // Puente eventos -> toasts: avisa de incidencias (cancelaciones).
  const toastedRef = useRef(new Set())
  useEffect(() => {
    for (const e of fleet.events) {
      if (e.type === 'cancellation' && !toastedRef.current.has(e.id)) {
        toastedRef.current.add(e.id)
        toast({ type: 'warning', title: 'Incidencia abierta', message: e.message })
      }
    }
  }, [fleet.events, toast])

  return (
    <FleetContext.Provider value={fleet}>
      <div className="min-h-screen bg-app">
        <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
        <div className={clsx('transition-all duration-200', app.sidebarCollapsed ? 'md:pl-16' : 'md:pl-60')}>
          <Topbar onToggleMobile={() => setMobileOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />
          <main className="overflow-x-clip p-3 sm:p-4">
            {fleet.loading ? <LoadingState /> : <Content activeNav={app.activeNav} />}
          </main>
        </div>
      </div>
      <RiderDetailDrawer />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </FleetContext.Provider>
  )
}
