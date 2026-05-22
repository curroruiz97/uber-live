import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const WhatsAppContext = createContext(null)

export function useWhatsApp() {
  const ctx = useContext(WhatsAppContext)
  if (!ctx) throw new Error('useWhatsApp debe usarse dentro de <WhatsAppProvider>')
  return ctx
}

const SETTINGS_KEY = 'ul-wa-settings'
const LOG_KEY = 'ul-wa-log'
const LOG_CAP = 300

const DEFAULT_SETTINGS = {
  contactMessage: 'Hola {nombre}, te contactamos desde operaciones.',
  quickTemplates: [
    { id: 't1', title: 'Confirmar disponibilidad', text: 'Hola {nombre}, ¿puedes confirmar tu disponibilidad para el turno de hoy?' },
    { id: 't2', title: 'Recordatorio de turno', text: 'Atención {nombre}: tu turno empieza en 15 minutos. ¿Estás en camino?' },
    { id: 't3', title: 'Incidencia en pedido', text: 'Incidencia detectada en tu pedido {pedido_id}. Contacta con operaciones.' },
  ],
  metaConfig: { phoneNumberId: '', businessAccountId: '' }, // el token NO se persiste
}

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
    if (!parsed) return DEFAULT_SETTINGS
    return {
      contactMessage: parsed.contactMessage ?? DEFAULT_SETTINGS.contactMessage,
      quickTemplates:
        Array.isArray(parsed.quickTemplates) && parsed.quickTemplates.length
          ? parsed.quickTemplates
          : DEFAULT_SETTINGS.quickTemplates,
      metaConfig: {
        phoneNumberId: parsed.metaConfig?.phoneNumberId ?? '',
        businessAccountId: parsed.metaConfig?.businessAccountId ?? '',
      },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function loadLog() {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || '[]')
  } catch {
    return []
  }
}

let logSeq = 0

export function WhatsAppProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings)
  const [metaToken, setMetaToken] = useState('') // solo en memoria
  const [sentLog, setSentLog] = useState(loadLog)
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* ignore */
    }
  }, [settings])

  useEffect(() => {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(sentLog.slice(0, LOG_CAP)))
    } catch {
      /* ignore */
    }
  }, [sentLog])

  const setContactMessage = useCallback(
    (contactMessage) => setSettings((s) => ({ ...s, contactMessage })),
    [],
  )
  const setMetaConfig = useCallback(
    (patch) => setSettings((s) => ({ ...s, metaConfig: { ...s.metaConfig, ...patch } })),
    [],
  )

  const addTemplate = useCallback(
    (tpl) =>
      setSettings((s) => ({
        ...s,
        quickTemplates: [
          ...s.quickTemplates,
          { id: `t${Date.now()}`, title: tpl.title || 'Sin título', text: tpl.text || '' },
        ],
      })),
    [],
  )
  const updateTemplate = useCallback(
    (id, patch) =>
      setSettings((s) => ({
        ...s,
        quickTemplates: s.quickTemplates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })),
    [],
  )
  const removeTemplate = useCallback(
    (id) => setSettings((s) => ({ ...s, quickTemplates: s.quickTemplates.filter((t) => t.id !== id) })),
    [],
  )

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

  const logSent = useCallback((entries) => {
    const arr = Array.isArray(entries) ? entries : [entries]
    const now = Date.now()
    const mapped = arr.map((e) => {
      logSeq += 1
      return {
        id: `wa-${now}-${logSeq}`,
        ts: e.ts ?? now,
        riderId: e.riderId ?? null,
        riderName: e.riderName ?? '',
        phone: e.phone ?? '',
        message: e.message ?? '',
        status: e.status ?? 'abierto',
        channel: e.channel ?? 'wa.me',
      }
    })
    setSentLog((prev) => [...mapped, ...prev].slice(0, LOG_CAP))
  }, [])

  const messagesToday = useMemo(() => {
    const start = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00').getTime()
    return sentLog.filter((m) => m.ts >= start).length
  }, [sentLog])

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
