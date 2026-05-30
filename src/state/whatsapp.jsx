import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useOrg } from './OrgContext'
import { whatsappCloud } from '../api/whatsappCloud'

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
// Estado de la WhatsApp Business API (Cloud API) de la organización, leído de
// org_integrations (no secreto). El token nunca llega aquí.
function rowToCloud(r) {
  return {
    configured: Boolean(r?.whatsapp_configured),
    phoneNumberId: r?.whatsapp_phone_number_id ?? '',
    businessAccountId: r?.whatsapp_business_account_id ?? '',
    last4: r?.whatsapp_last4 ?? '',
    verifiedName: r?.whatsapp_verified_name ?? '',
    displayPhone: r?.whatsapp_display_phone ?? '',
    status: r?.whatsapp_status ?? 'idle',
  }
}

// Persistencia en Supabase (Postgres + Realtime). El token de la WhatsApp Business API
// vive en org_secrets (servidor), nunca aquí. Plantillas/ajustes se escriben con
// debounce; el log de envíos se sincroniza en vivo entre el equipo.
export function WhatsAppProvider({ children }) {
  const { user } = useAuth()
  const { currentOrgId: orgId } = useOrg()

  const [contactMessage, setContactMessageState] = useState(DEFAULT_CONTACT)
  const [quickTemplates, setQuickTemplates] = useState([])
  const [cloud, setCloud] = useState(() => rowToCloud(null))
  const [sentLog, setSentLog] = useState([])
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const writeTimers = useRef({})

  // Carga inicial desde Postgres, filtrada por la organización activa.
  useEffect(() => {
    if (!orgId) return undefined
    let alive = true
    ;(async () => {
      const [tpls, st, log, integ] = await Promise.all([
        supabase.from('wa_templates').select('*').eq('org_id', orgId).order('created_at', { ascending: true }),
        supabase.from('org_settings').select('*').eq('org_id', orgId).maybeSingle(),
        supabase.from('wa_sent_log').select('*').eq('org_id', orgId).order('ts', { ascending: false }).limit(LOG_CAP),
        supabase
          .from('org_integrations')
          .select('whatsapp_phone_number_id, whatsapp_business_account_id, whatsapp_configured, whatsapp_last4, whatsapp_verified_name, whatsapp_display_phone, whatsapp_status')
          .eq('org_id', orgId)
          .maybeSingle(),
      ])
      if (!alive) return
      setQuickTemplates(tpls.data ? tpls.data.map(rowToTemplate) : [])
      setContactMessageState(st.data?.contact_message ?? DEFAULT_CONTACT)
      setCloud(rowToCloud(integ.data))
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

  // Recarga el estado de la WhatsApp Business API tras guardar/verificar credenciales.
  const reloadCloud = useCallback(async () => {
    if (!orgId) return
    const { data } = await supabase
      .from('org_integrations')
      .select('whatsapp_phone_number_id, whatsapp_business_account_id, whatsapp_configured, whatsapp_last4, whatsapp_verified_name, whatsapp_display_phone, whatsapp_status')
      .eq('org_id', orgId)
      .maybeSingle()
    setCloud(rowToCloud(data))
  }, [orgId])

  // Envío vía WhatsApp Business API oficial (Edge Function `whatsapp`). El gating de
  // plan y el descuento de créditos se aplican en el servidor. Devuelve { ok, wamid, waId }.
  const sendCloud = useCallback((p) => whatsappCloud.send(p), [])

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
    () => ({ contactMessage, quickTemplates }),
    [contactMessage, quickTemplates],
  )

  const value = useMemo(
    () => ({
      settings,
      cloud,
      reloadCloud,
      sendCloud,
      setContactMessage,
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
      cloud,
      reloadCloud,
      sendCloud,
      setContactMessage,
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
