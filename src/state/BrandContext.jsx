import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from './OrgContext'

// Branding por empresa: carga el color de acento + logos + nombre de la org activa,
// e inyecta --c-accent en runtime (claro/oscuro) para recolorear toda la app sin
// recompilar. Soporta vista previa en vivo (selector de color). El color se cachea en
// localStorage para evitar parpadeo (el script de index.html lo aplica antes de montar).
export const BrandContext = createContext(null)
const ACCENT_CACHE = 'ul-brand-accent'

export const BRAND_DEFAULTS = {
  companyName: '',
  accentLight: '249 115 22',
  accentDark: '251 146 60',
  logoLightUrl: '',
  logoDarkUrl: '',
  faviconUrl: '',
}

export function useBrand() {
  const ctx = useContext(BrandContext)
  if (!ctx) throw new Error('useBrand debe usarse dentro de <BrandProvider>')
  return ctx
}

function applyAccent(light, dark) {
  let el = document.getElementById('brand-vars')
  if (!el) {
    el = document.createElement('style')
    el.id = 'brand-vars'
    document.head.appendChild(el)
  }
  el.textContent = `:root{--c-accent:${light};} .dark{--c-accent:${dark};}`
  try {
    localStorage.setItem(ACCENT_CACHE, JSON.stringify({ light, dark }))
  } catch {
    /* ignore */
  }
}

export function BrandProvider({ children }) {
  const { currentOrgId: orgId, currentOrg } = useOrg()
  const [brand, setBrand] = useState(BRAND_DEFAULTS)
  const [preview, setPreview] = useState(null) // { accentLight, accentDark } | null

  useEffect(() => {
    if (!orgId) return undefined
    let alive = true
    ;(async () => {
      const { data } = await supabase.from('org_branding').select('*').eq('org_id', orgId).maybeSingle()
      if (!alive) return
      setBrand({
        companyName: data?.company_name || currentOrg?.name || '',
        accentLight: data?.accent_light || BRAND_DEFAULTS.accentLight,
        accentDark: data?.accent_dark || BRAND_DEFAULTS.accentDark,
        logoLightUrl: data?.logo_light_url || '',
        logoDarkUrl: data?.logo_dark_url || '',
        faviconUrl: data?.favicon_url || '',
      })
    })()
    return () => {
      alive = false
    }
  }, [orgId, currentOrg?.name])

  // Aplica el acento (la vista previa tiene prioridad sobre lo guardado).
  useEffect(() => {
    const a = preview || brand
    applyAccent(a.accentLight, a.accentDark)
  }, [brand, preview])

  // Título de la pestaña con el nombre de la empresa.
  useEffect(() => {
    document.title = brand.companyName
      ? `${brand.companyName} · Gestión de flota`
      : 'Gestión de flota'
  }, [brand.companyName])

  // Favicon por empresa (sobrescribe el del index.html).
  useEffect(() => {
    const id = 'brand-favicon'
    let link = document.getElementById(id)
    if (brand.faviconUrl) {
      if (!link) {
        link = document.createElement('link')
        link.id = id
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = brand.faviconUrl
    } else if (link) {
      link.remove()
    }
  }, [brand.faviconUrl])

  const save = useCallback(
    async (patch) => {
      if (!orgId) return { error: new Error('Sin organización') }
      const row = { updated_at: new Date().toISOString() }
      if ('companyName' in patch) row.company_name = patch.companyName
      if ('accentLight' in patch) row.accent_light = patch.accentLight
      if ('accentDark' in patch) row.accent_dark = patch.accentDark
      if ('logoLightUrl' in patch) row.logo_light_url = patch.logoLightUrl
      if ('logoDarkUrl' in patch) row.logo_dark_url = patch.logoDarkUrl
      if ('faviconUrl' in patch) row.favicon_url = patch.faviconUrl
      const { error } = await supabase.from('org_branding').update(row).eq('org_id', orgId)
      if (!error) setBrand((b) => ({ ...b, ...patch }))
      return { error }
    },
    [orgId],
  )

  const value = useMemo(
    () => ({
      ...brand,
      preview,
      setPreviewAccent: (light, dark) => setPreview({ accentLight: light, accentDark: dark }),
      clearPreview: () => setPreview(null),
      save,
    }),
    [brand, preview, save],
  )

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}
