import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { STATUS_ORDER } from '../config/constants'
import { useOrg } from './OrgContext'
import { supabase } from '../lib/supabase'

const CONN_KEY = 'ul-connection'
const NAV_KEY = 'ul-nav'
const PROVIDER_KEY = 'ul-provider'

// Proveedores de flota disponibles para el switcher del mapa.
export const PROVIDERS = ['uber', 'glovo', 'all']

const AppContext = createContext(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>')
  return ctx
}

// Filtra riders por estado / zona / búsqueda por nombre. Se usa en tabla y mapa.
export function filterRiders(riders, filters) {
  const q = filters.search.trim().toLowerCase()
  return riders.filter((r) => {
    if (!filters.statuses.includes(r.status)) return false
    if (filters.zone !== 'all' && r.zone?.id !== filters.zone) return false
    if (q && !r.name.toLowerCase().includes(q)) return false
    return true
  })
}

const DEFAULT_FILTERS = { statuses: [...STATUS_ORDER], zone: 'all', search: '' }

export function AppProvider({ children }) {
  // La conexión se restaura de localStorage para sobrevivir a recargas. NO se guarda
  // el token manual (dato sensible); las credenciales reales viven server-side por org.
  const [connection, setConnection] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(CONN_KEY) || 'null')
      if (s && s.connected) {
        return { token: '', environment: s.environment || 'sandbox', demoMode: Boolean(s.demoMode), connected: true }
      }
    } catch {
      /* ignore */
    }
    return { token: '', environment: 'sandbox', demoMode: false, connected: false }
  })

  // Sync: leer uber_environment de org_integrations y actualizar la conexión activa.
  const { currentOrgId } = useOrg()
  useEffect(() => {
    if (!currentOrgId || connection.demoMode || !connection.connected) return
    supabase
      .from('org_integrations')
      .select('uber_environment')
      .eq('org_id', currentOrgId)
      .maybeSingle()
      .then(({ data }) => {
        const dbEnv = data?.uber_environment
        if (dbEnv && dbEnv !== connection.environment) {
          setConnection((c) => ({ ...c, environment: dbEnv }))
        }
      })
  }, [currentOrgId])

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeNav, setActiveNav] = useState(() => {
    try {
      // Compat: 'mapa' se fusionó en 'dashboard' (Mapas). 'horarios' es ahora una
      // sección propia (planificador de turnos), distinta de 'cumplimiento'.
      const v = localStorage.getItem(NAV_KEY) || 'dashboard'
      if (v === 'mapa') return 'dashboard'
      return v
    } catch {
      return 'dashboard'
    }
  })
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [selectedRiderId, setSelectedRiderId] = useState(null)

  // Proveedor de flota activo en el mapa (uber | glovo | all). Persistido para
  // sobrevivir a recargas. Es la dimensión que alimenta useFleetData.
  const [activeProvider, setActiveProviderState] = useState(() => {
    try {
      const p = localStorage.getItem(PROVIDER_KEY)
      return PROVIDERS.includes(p) ? p : 'uber'
    } catch {
      return 'uber'
    }
  })

  // Persistir conexión (sin token) y sección activa.
  useEffect(() => {
    try {
      if (connection.connected) {
        localStorage.setItem(CONN_KEY, JSON.stringify({ connected: true, environment: connection.environment, demoMode: connection.demoMode }))
      } else {
        localStorage.removeItem(CONN_KEY)
      }
    } catch {
      /* ignore */
    }
  }, [connection.connected, connection.environment, connection.demoMode])

  useEffect(() => {
    try {
      localStorage.setItem(NAV_KEY, activeNav)
    } catch {
      /* ignore */
    }
  }, [activeNav])

  useEffect(() => {
    try {
      localStorage.setItem(PROVIDER_KEY, activeProvider)
    } catch {
      /* ignore */
    }
  }, [activeProvider])

  // Cambiar de proveedor limpia la selección (el rider elegido puede no existir en
  // la otra flota) para no dejar abierto un detalle inexistente.
  const setActiveProvider = useCallback((p) => {
    if (!PROVIDERS.includes(p)) return
    setActiveProviderState((prev) => {
      if (prev !== p) setSelectedRiderId(null)
      return p
    })
  }, [])

  const connectDemo = useCallback(() => {
    setConnection({ token: '', environment: 'sandbox', demoMode: true, connected: true })
  }, [])

  const connectReal = useCallback(({ token = '', environment }) => {
    setConnection({ token, environment, demoMode: false, connected: true })
  }, [])

  const updateEnvironment = useCallback((env) => {
    setConnection((c) => (c.connected && !c.demoMode ? { ...c, environment: env } : c))
  }, [])

  const disconnect = useCallback(() => {
    setConnection({ token: '', environment: 'sandbox', demoMode: false, connected: false })
    setFilters(DEFAULT_FILTERS)
    setSelectedRiderId(null)
    setActiveNav('dashboard')
    setActiveProviderState('uber')
  }, [])

  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), [])

  const toggleStatusFilter = useCallback((statusId) => {
    setFilters((f) => {
      const has = f.statuses.includes(statusId)
      const statuses = has ? f.statuses.filter((s) => s !== statusId) : [...f.statuses, statusId]
      return { ...f, statuses }
    })
  }, [])

  const setZoneFilter = useCallback((zone) => setFilters((f) => ({ ...f, zone })), [])
  const setSearch = useCallback((search) => setFilters((f) => ({ ...f, search })), [])
  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [])

  const selectRider = useCallback((id) => setSelectedRiderId(id), [])
  const clearSelection = useCallback(() => setSelectedRiderId(null), [])

  const value = useMemo(
    () => ({
      ...connection,
      connectDemo,
      connectReal,
      updateEnvironment,
      disconnect,
      sidebarCollapsed,
      toggleSidebar,
      activeNav,
      setActiveNav,
      activeProvider,
      setActiveProvider,
      filters,
      toggleStatusFilter,
      setZoneFilter,
      setSearch,
      resetFilters,
      selectedRiderId,
      selectRider,
      clearSelection,
    }),
    [
      connection,
      connectDemo,
      connectReal,
      updateEnvironment,
      disconnect,
      sidebarCollapsed,
      toggleSidebar,
      activeNav,
      activeProvider,
      setActiveProvider,
      filters,
      toggleStatusFilter,
      setZoneFilter,
      setSearch,
      resetFilters,
      selectedRiderId,
      selectRider,
      clearSelection,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
