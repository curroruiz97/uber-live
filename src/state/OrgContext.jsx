import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { setActiveOrgId } from '../config/api'

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

  const value = useMemo(
    () => ({
      orgs,
      currentOrg,
      currentOrgId,
      role: currentOrg?.role || null,
      isOwnerOrAdmin: currentOrg?.role === 'owner' || currentOrg?.role === 'admin',
      loading,
      hasOrg: orgs.length > 0,
      switchOrg,
      reload,
    }),
    [orgs, currentOrg, currentOrgId, loading, switchOrg, reload],
  )

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}
