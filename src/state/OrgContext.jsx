import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { setActiveOrgId } from '../config/api'
import { normalizeScope, cityInScope } from '../utils/cityScope'

// Organización activa (tenant). Carga las orgs del usuario desde org_members,
// mantiene la org seleccionada (persistida) y la propaga a las Edge Functions
// vía la cabecera x-org-id (setActiveOrgId). Todo el aislamiento de datos cuelga
// de aquí: los providers de datos filtran por currentOrgId.
const OrgContext = createContext(null)
const STORAGE_KEY = 'ul-org'

export function useOrg() {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg debe usarse dentro de <OrgProvider>')
  return ctx
}

export function OrgProvider({ children }) {
  const { user } = useAuth()
  const [orgs, setOrgs] = useState([])
  const [currentOrgId, setCurrentOrgId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || ''
    } catch {
      return ''
    }
  })
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    // Acepta automáticamente invitaciones pendientes para el email del usuario.
    try {
      await supabase.rpc('accept_pending_invitations')
    } catch {
      /* ignore */
    }
    const { data } = await supabase
      .from('org_members')
      .select('role, created_at, organizations(id, name, slug, is_platform_admin)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    const list = (data || [])
      .filter((r) => r.organizations)
      .map((r) => ({
        id: r.organizations.id,
        name: r.organizations.name,
        slug: r.organizations.slug,
        isPlatformAdmin: r.organizations.is_platform_admin,
        role: r.role,
      }))
    setOrgs(list)
    setCurrentOrgId((prev) => (list.some((o) => o.id === prev) ? prev : list[0]?.id || ''))
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    reload()
  }, [user?.id, reload])

  const currentOrg = useMemo(
    () => orgs.find((o) => o.id === currentOrgId) || null,
    [orgs, currentOrgId],
  )

  // Ámbito de ciudades del miembro actual (rol "visor"). Se lee por separado y de forma
  // tolerante: si la columna city_scope aún no existe (migración sin aplicar) o hay error,
  // se asume sin restricción (null) para no romper la app.
  const [cityScope, setCityScope] = useState(null)
  useEffect(() => {
    let cancelled = false
    if (!user?.id || !currentOrgId) {
      setCityScope(null)
      return undefined
    }
    supabase
      .from('org_members')
      .select('city_scope')
      .eq('org_id', currentOrgId)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        setCityScope(error ? null : normalizeScope(data?.city_scope))
      })
    return () => { cancelled = true }
  }, [user?.id, currentOrgId, orgs])

  // Propaga a las cabeceras de las Edge Functions + localStorage SOLO un org que el
  // usuario tenga de verdad. Si el guardado está obsoleto (p. ej. su org se borró o
  // dejó de ser miembro) no se manda nada hasta que reload() lo corrige: así se evita
  // el 401/403 "No perteneces a esta organización" con una selección caducada.
  useEffect(() => {
    const valid = orgs.some((o) => o.id === currentOrgId)
    setActiveOrgId(valid ? currentOrgId : '')
    try {
      if (valid) localStorage.setItem(STORAGE_KEY, currentOrgId)
      else if (!currentOrgId) localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [currentOrgId, orgs])

  const switchOrg = useCallback((id) => setCurrentOrgId(id), [])

  // El ámbito de ciudades SOLO restringe a los visores. Para owner/admin/member es null
  // (ven todo) aunque quedara un city_scope antiguo en su fila tras un cambio de rol.
  const isViewer = currentOrg?.role === 'viewer'
  const effectiveScope = isViewer ? cityScope : null

  const value = useMemo(
    () => ({
      orgs,
      currentOrg,
      currentOrgId,
      role: currentOrg?.role || null,
      isOwnerOrAdmin: currentOrg?.role === 'owner' || currentOrg?.role === 'admin',
      isViewer,
      cityScope: effectiveScope, // array canónico de ciudades permitidas, o null (sin restricción)
      canSeeCity: (city) => cityInScope(city, effectiveScope),
      loading,
      hasOrg: orgs.length > 0,
      switchOrg,
      reload,
    }),
    [orgs, currentOrg, currentOrgId, isViewer, effectiveScope, loading, switchOrg, reload],
  )

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}
