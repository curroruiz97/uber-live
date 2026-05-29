import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useOrg } from './OrgContext'

const WhatsAppContext = createContext(null)

export function useWhatsApp() {
  const ctx = useContext(WhatsAppContext)
  if (!ctx) throw new Error('useWhatsApp debe usarse dentro de <WhatsAppProvider>')
  return ctx
}

const DEFAULT_CONTACT = 'Hola {nombre}, te contactamos desde operaciones.'
const LOG_CAP = 300

function rowToTemplate(r) {
  return { id: r.id, title: r.title, text: r.text }
}
function rowToLog(r) {
  return {
    id: r.id,
    ts: r.ts ? Date.parse(r.ts) : Date.now(),
    riderId: r.rider_id ?? null,
    riderName: r.rider_name ?? '',
    phone: r.phone ?? '',
    message: r.message ?? '',
    status: r.status ?? 'abierto',
    channel: r.channel ?? 'wa.me',
  }
}

// Persistencia en Supabase (Postgres + Realtime). El token de Meta NUNCA se guarda
// (solo en memoria). Plantillas/ajustes se escriben con debounce para no hacer una
// query por pulsación; el log de envíos se sincroniza en vivo entre el equipo.
export function WhatsAppProvider({ children }) {
  const { user } = useAuth()
  const { currentOrgId: orgId } = useOrg()

  const [contactMessage, setContactMessageState] = useState(DEFAULT_CONTACT)
  const [metaConfig, setMetaConfigState] = useState({ phoneNumberId: '', businessAccountId: '' })
  const [quickTemplates, setQuickTemplates] = useState([])
  const [metaToken, setMetaToken] = useState('') // solo en memoria
  const [sentLog, setSentLog] = useState([])
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const writeTimers = useRef({})

  // Carga inicial desde Postgres, filtrada por la organización activa.
  useEffect(() => {
    if (!orgId) return undefined
    let alive = true
    ;(async () => {
      const [tpls, st, log] = await Promise.all([
        supabase.from('wa_templates').select('*').eq('org_id', orgId).order('created_at', { ascending: true }),
        supabase.from('org_settings').select('*').eq('org_id', orgId).maybeSingle(),
        supabase.from('wa_sent_log').select('*').eq('org_id', orgId).order('ts', { ascending: false }).limit(LOG_CAP),
      ])
      if (!alive) return
      setQuickTemplates(tpls.data ? tpls.data.map(rowToTemplate) : [])
      setContactMessageState(st.data?.contact_message ?? DEFAULT_CONTACT)
      setMetaConfigState({
        phoneNumberId: st.data?.meta_phone_number_id ?? '',
        businessAccountId: st.data?.meta_business_account_id ?? '',
      })
      setSentLog(log.data ? log.data.map(rowToLog) : [])
    })()
    return () => {
      alive = false
    }
  }, [orgId])

  // Realtime: el log de envíos se actualiza en vivo, filtrado por organización.
  useEffect(() => {
    if (!orgId) return undefined
    const ch = supabase
      .channel(`wa_sent_log_rt_${orgId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_sent_log', filter: `org_id=eq.${orgId}` },
        (payload) => {
          const row = rowToLog(payload.new)
          setSentLog((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [row, ...prev].slice(0, LOG_CAP),
          )
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [orgId])

  const persistSettings = useCallback((patch) => {
    if (!orgId) return
    clearTimeout(writeTimers.current.settings)
    writeTimers.current.settings = setTimeout(() => {
      supabase
        .from('org_settings')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('org_id', orgId)
        .then(({ error }) => {
          // eslint-disable-next-line no-console
          if (error) console.error('[wa] settings:', error.message)
        })
    }, 500)
  }, [orgId])

  const setContactMessage = useCallback(
    (msg) => {
      setContactMessageState(msg)
      persistSettings({ contact_message: msg })
    },
    [persistSettings],
  )

  const setMetaConfig = useCallback(
    (patch) => {
      setMetaConfigState((s) => {
        const next = { ...s, ...patch }
        persistSettings({
          meta_phone_number_id: next.phoneNumberId,
          meta_business_account_id: next.businessAccountId,
        })
        return next
      })
    },
    [persistSettings],
  )

  const addTemplate = useCallback(
    async (tpl) => {
      const row = { org_id: orgId, title: tpl.title || 'Sin título', text: tpl.text || '', created_by: user?.id ?? null }
      const { data, error } = await supabase.from('wa_templates').insert(row).select().single()
      if (!error && data) setQuickTemplates((prev) => [...prev, rowToTemplate(data)])
    },
    [user, orgId],
  )

  const updateTemplate = useCallback((id, patch) => {
    setQuickTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    clearTimeout(writeTimers.current['t:' + id])
    writeTimers.current['t:' + id] = setTimeout(() => {
      supabase
        .from('wa_templates')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .then(({ error }) => {
          // eslint-disable-next-line no-console
          if (error) console.error('[wa] template:', error.message)
        })
    }, 500)
  }, [])

  const removeTemplate = useCallback(async (id) => {
    setQuickTemplates((prev) => prev.filter((t) => t.id !== id))
    await supabase.from('wa_templates').delete().eq('id', id)
  }, [])

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }, [])
  const selectMany = useCallback((ids, on) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      for (const id of ids) {
        if (on) n.add(id)
        else n.delete(id)
      }
      return n
    })
  }, [])
  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const logSent = useCallback(
    async (entries) => {
      const arr = Array.isArray(entries) ? entries : [entries]
      const rows = arr.map((e) => ({
        org_id: orgId,
        rider_id: e.riderId ?? null,
        rider_name: e.riderName ?? '',
        phone: e.phone ?? '',
        message: e.message ?? '',
        status: e.status ?? 'abierto',
        channel: e.channel ?? 'wa.me',
        sent_by: user?.id ?? null,
      }))
      const { data, error } = await supabase.from('wa_sent_log').insert(rows).select()
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[wa] logSent:', error.message)
        return
      }
      const mapped = (data || []).map(rowToLog)
      setSentLog((prev) => {
        const have = new Set(prev.map((m) => m.id))
        const fresh = mapped.filter((m) => !have.has(m.id))
        return [...fresh, ...prev].slice(0, LOG_CAP)
      })
    },
    [user, orgId],
  )

  const messagesToday = useMemo(() => {
    const start = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00').getTime()
    return sentLog.filter((m) => m.ts >= start).length
  }, [sentLog])

  const settings = useMemo(
    () => ({ contactMessage, quickTemplates, metaConfig }),
    [contactMessage, quickTemplates, metaConfig],
  )

  const value = useMemo(
    () => ({
      settings,
      metaToken,
      setMetaToken,
      setContactMessage,
      setMetaConfig,
      addTemplate,
      updateTemplate,
      removeTemplate,
      sentLog,
      logSent,
      messagesToday,
      selectedIds,
      toggleSelect,
      selectMany,
      clearSelection,
    }),
    [
      settings,
      metaToken,
      setContactMessage,
      setMetaConfig,
      addTemplate,
      updateTemplate,
      removeTemplate,
      sentLog,
      logSent,
      messagesToday,
      selectedIds,
      toggleSelect,
      selectMany,
      clearSelection,
    ],
  )

  return <WhatsAppContext.Provider value={value}>{children}</WhatsAppContext.Provider>
}
