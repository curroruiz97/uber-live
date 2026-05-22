import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { STATUS_ORDER } from '../config/constants'

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
  // Credenciales SOLO en estado (no localStorage). Se pierden al recargar.
  const [connection, setConnection] = useState({
    token: '',
    environment: 'sandbox',
    demoMode: false,
    connected: false,
  })

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [selectedRiderId, setSelectedRiderId] = useState(null)

  const connectDemo = useCallback(() => {
    setConnection({ token: '', environment: 'sandbox', demoMode: true, connected: true })
  }, [])

  const connectReal = useCallback(({ token = '', environment }) => {
    setConnection({ token, environment, demoMode: false, connected: true })
  }, [])

  const disconnect = useCallback(() => {
    setConnection({ token: '', environment: 'sandbox', demoMode: false, connected: false })
    setFilters(DEFAULT_FILTERS)
    setSelectedRiderId(null)
    setActiveNav('dashboard')
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
      disconnect,
      sidebarCollapsed,
      toggleSidebar,
      activeNav,
      setActiveNav,
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
      disconnect,
      sidebarCollapsed,
      toggleSidebar,
      activeNav,
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
