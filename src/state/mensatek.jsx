import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { mensatekApi } from '../api/mensatekClient'
import { CHANNELS, toMensatekPhone } from '../utils/mensatek'

const MensatekContext = createContext(null)

export function useMensatek() {
  const ctx = useContext(MensatekContext)
  if (!ctx) throw new Error('useMensatek debe usarse dentro de <MensatekProvider>')
  return ctx
}

const DEFAULTS = {
  contacto: '',
  telcontacto: '',
  cifcontacto: '',
  senderSms: 'Sapiens',
  senderEmail: '',
  smsText: 'Hola {nombre}, te enviamos una comunicación oficial de Sapiens Telco. Gracias.',
  emailSubject: 'Comunicación oficial de Sapiens Telco',
  emailBody:
    'Hola {nombre},\n\nTe hacemos llegar esta comunicación certificada desde Sapiens Telco.\n\nUn saludo,\nEquipo de operaciones',
}
const LOG_CAP = 300

function rowToTemplate(r) {
  return { id: r.id, channel: r.channel, title: r.title, subject: r.subject, body: r.body }
}
function rowToLog(r) {
  return {
    id: r.id,
    ts: r.ts ? Date.parse(r.ts) : Date.now(),
    riderId: r.rider_id ?? null,
    riderName: r.rider_name ?? '',
    channel: r.channel ?? 'sms',
    target: r.target ?? '',
    subject: r.subject ?? '',
    message: r.message ?? '',
    status: r.status ?? 'enviado',
    idMensaje: r.id_mensaje ?? null,
    cred: r.cred ?? null,
  }
}

// Persistencia en Supabase (Postgres + Realtime). El API Token de Mensatek NUNCA se
// guarda aquí: vive en los secrets de la Edge Function. Config/plantillas se escriben
// con debounce; el log de envíos se sincroniza en vivo entre el equipo.
export function MensatekProvider({ children }) {
  const { user } = useAuth()

  const [config, setConfigState] = useState(DEFAULTS)
  const [templates, setTemplates] = useState([])
  const [sentLog, setSentLog] = useState([])
  const [credits, setCredits] = useState(null) // null = desconocido
  const [conn, setConn] = useState({ status: 'idle', checkedAt: null, message: '' })
  const writeTimers = useRef({})

  // Carga inicial desde Postgres.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [tpls, st, log] = await Promise.all([
        supabase.from('mensatek_templates').select('*').order('created_at', { ascending: true }),
        supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('mensatek_sent_log').select('*').order('ts', { ascending: false }).limit(LOG_CAP),
      ])
      if (!alive) return
      if (tpls.data) setTemplates(tpls.data.map(rowToTemplate))
      if (st.data) {
        setConfigState({
          contacto: st.data.mensatek_contacto ?? DEFAULTS.contacto,
          telcontacto: st.data.mensatek_telcontacto ?? DEFAULTS.telcontacto,
          cifcontacto: st.data.mensatek_cifcontacto ?? DEFAULTS.cifcontacto,
          senderSms: st.data.mensatek_sender_sms ?? DEFAULTS.senderSms,
          senderEmail: st.data.mensatek_sender_email ?? DEFAULTS.senderEmail,
          smsText: st.data.mensatek_sms_text ?? DEFAULTS.smsText,
          emailSubject: st.data.mensatek_email_subject ?? DEFAULTS.emailSubject,
          emailBody: st.data.mensatek_email_body ?? DEFAULTS.emailBody,
        })
      }
      if (log.data) setSentLog(log.data.map(rowToLog))
    })()
    return () => {
      alive = false
    }
  }, [])

  // Realtime: el log de envíos se actualiza en vivo para todo el equipo.
  useEffect(() => {
    const ch = supabase
      .channel('mensatek_sent_log_rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensatek_sent_log' },
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
  }, [])

  const persistConfig = useCallback((patch) => {
    clearTimeout(writeTimers.current.cfg)
    writeTimers.current.cfg = setTimeout(() => {
      supabase
        .from('app_settings')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', 1)
        .then(({ error }) => {
          // eslint-disable-next-line no-console
          if (error) console.error('[mensatek] config:', error.message)
        })
    }, 500)
  }, [])

  const setConfig = useCallback(
    (patch) => {
      setConfigState((s) => {
        const next = { ...s, ...patch }
        persistConfig({
          mensatek_contacto: next.contacto,
          mensatek_telcontacto: next.telcontacto,
          mensatek_cifcontacto: next.cifcontacto,
          mensatek_sender_sms: next.senderSms,
          mensatek_sender_email: next.senderEmail,
          mensatek_sms_text: next.smsText,
          mensatek_email_subject: next.emailSubject,
          mensatek_email_body: next.emailBody,
        })
        return next
      })
    },
    [persistConfig],
  )

  const addTemplate = useCallback(
    async (tpl) => {
      const row = {
        channel: tpl.channel || 'sms',
        title: tpl.title || 'Sin título',
        subject: tpl.subject || '',
        body: tpl.body || '',
        created_by: user?.id ?? null,
      }
      const { data, error } = await supabase.from('mensatek_templates').insert(row).select().single()
      if (!error && data) setTemplates((prev) => [...prev, rowToTemplate(data)])
    },
    [user],
  )

  const updateTemplate = useCallback((id, patch) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    clearTimeout(writeTimers.current['t:' + id])
    writeTimers.current['t:' + id] = setTimeout(() => {
      supabase
        .from('mensatek_templates')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .then(({ error }) => {
          // eslint-disable-next-line no-console
          if (error) console.error('[mensatek] template:', error.message)
        })
    }, 500)
  }, [])

  const removeTemplate = useCallback(async (id) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    await supabase.from('mensatek_templates').delete().eq('id', id)
  }, [])

  // Inserta entradas en el log (una por destinatario) y refleja en vivo.
  const logSent = useCallback(
    async (entries) => {
      const arr = Array.isArray(entries) ? entries : [entries]
      const rows = arr.map((e) => ({
        rider_id: e.riderId ?? null,
        rider_name: e.riderName ?? '',
        channel: e.channel ?? 'sms',
        target: e.target ?? '',
        subject: e.subject ?? '',
        message: e.message ?? '',
        status: e.status ?? 'enviado',
        id_mensaje: e.idMensaje ? String(e.idMensaje) : null,
        cred: e.cred ?? null,
        creditos_usados: e.creditosUsados ?? null,
        sent_by: user?.id ?? null,
      }))
      const { data, error } = await supabase.from('mensatek_sent_log').insert(rows).select()
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[mensatek] logSent:', error.message)
        return
      }
      const mapped = (data || []).map(rowToLog)
      setSentLog((prev) => {
        const have = new Set(prev.map((m) => m.id))
        const fresh = mapped.filter((m) => !have.has(m.id))
        return [...fresh, ...prev].slice(0, LOG_CAP)
      })
    },
    [user],
  )

  // Comprueba la conexión leyendo los créditos (verifica credenciales del proxy).
  const checkConnection = useCallback(async () => {
    setConn({ status: 'checking', checkedAt: null, message: '' })
    try {
      const res = await mensatekApi.credits()
      setCredits(res.cred)
      setConn({ status: 'ok', checkedAt: Date.now(), message: '' })
      return { ok: true, cred: res.cred }
    } catch (e) {
      setConn({
        status: e.kind === 'not_configured' ? 'not_configured' : 'error',
        checkedAt: Date.now(),
        message: e.message,
      })
      return { ok: false, error: e }
    }
  }, [])

  // Envío real por SMS (Certificado o Contrato) a una lista de riders.
  const sendSms = useCallback(
    async ({ riders, message, contrato = false, reference }) => {
      const destinatarios = riders.map((r) => ({
        movil: toMensatekPhone(r.phone),
        variable_1: r.name || '',
      }))
      const res = await mensatekApi.sendSms({
        remitente: config.senderSms,
        destinatarios,
        mensaje: message,
        contacto: config.contacto,
        telcontacto: config.telcontacto,
        cifcontacto: config.cifcontacto,
        tipocontrato: contrato ? CHANNELS.sms_contrato.tipocontrato : 0,
        unicode: 1,
        referencia: reference,
      })
      if (res.cred != null) setCredits(res.cred)
      return res
    },
    [config],
  )

  // Envío real por Email Certificado a una lista de riders.
  const sendEmail = useCallback(
    async ({ riders, subject, body, reference }) => {
      const destinatarios = riders.map((r) => ({
        nombre: r.name || '',
        email: r.email || '',
        variable_1: r.name || '',
      }))
      const res = await mensatekApi.sendEmail({
        remitente: config.senderEmail,
        destinatarios,
        asunto: subject,
        mensaje: body,
        referencia: reference,
      })
      if (res.cred != null) setCredits(res.cred)
      return res
    },
    [config],
  )

  const messagesToday = useMemo(() => {
    const start = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00').getTime()
    return sentLog.filter((m) => m.ts >= start).length
  }, [sentLog])

  const value = useMemo(
    () => ({
      config,
      setConfig,
      templates,
      addTemplate,
      updateTemplate,
      removeTemplate,
      sentLog,
      logSent,
      credits,
      conn,
      checkConnection,
      sendSms,
      sendEmail,
      messagesToday,
    }),
    [
      config,
      setConfig,
      templates,
      addTemplate,
      updateTemplate,
      removeTemplate,
      sentLog,
      logSent,
      credits,
      conn,
      checkConnection,
      sendSms,
      sendEmail,
      messagesToday,
    ],
  )

  return <MensatekContext.Provider value={value}>{children}</MensatekContext.Provider>
}
