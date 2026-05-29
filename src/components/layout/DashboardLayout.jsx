import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useApp } from '../../state/AppContext'
import { useFleetData, FleetContext } from '../../state/useFleetData'
import { useToast } from '../../state/toast'
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
import WhatsAppView from '../whatsapp/WhatsAppView'
import MensatekView from '../mensatek/MensatekView'
import SettingsLayout from '../settings/SettingsLayout'

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

function Content({ activeNav }) {
  if (activeNav === 'config') return <SettingsLayout />

  if (activeNav === 'whatsapp') return <WhatsAppView />

  if (activeNav === 'mensatek') return <MensatekView />

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
