import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  Send, ShieldCheck, FileSignature, Mail, MessageSquareText, X, Loader2, CheckCircle2,
  AlertTriangle, Users,
} from 'lucide-react'
import { useFleet } from '../../state/useFleetData'
import { useMensatek } from '../../state/mensatek'
import { buildMessage, smsIssuerReady, isValidEmail, toMensatekPhone } from '../../utils/mensatek'

const CHANNEL_TABS = [
  { id: 'sms', label: 'SMS Certificado', icon: ShieldCheck },
  { id: 'sms_contrato', label: 'SMS Contrato', icon: FileSignature },
  { id: 'email', label: 'Email Certificado', icon: Mail },
]

const AUDIENCES = [
  { id: 'all', label: 'Todos los riders', fn: () => true },
  { id: 'active', label: 'Activos (no offline)', fn: (r) => r.status !== 'offline' },
  { id: 'available', label: 'Disponibles', fn: (r) => r.status === 'disponible' },
  { id: 'busy', label: 'En ruta / en entrega', fn: (r) => r.status === 'en_ruta' || r.status === 'en_entrega' },
]

const BATCH = 50 // máximo de destinatarios por llamada a Mensatek

export default function MensatekSendPanel() {
  const { riders } = useFleet()
  const { config, templates, sendSms, sendEmail, logSent, credits } = useMensatek()

  const [channel, setChannel] = useState('sms')
  const [audience, setAudience] = useState('active')
  const [smsText, setSmsText] = useState(config.smsText)
  const [subject, setSubject] = useState(config.emailSubject)
  const [emailBody, setEmailBody] = useState(config.emailBody)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Reflejar los defaults guardados si cambian.
  useEffect(() => setSmsText(config.smsText), [config.smsText])
  useEffect(() => setSubject(config.emailSubject), [config.emailSubject])
  useEffect(() => setEmailBody(config.emailBody), [config.emailBody])

  const isEmail = channel === 'email'
  const audienceRiders = useMemo(
    () => riders.filter(AUDIENCES.find((a) => a.id === audience)?.fn ?? (() => true)),
    [riders, audience],
  )
  // Elegibles = tienen el dato de contacto del canal.
  const eligible = useMemo(
    () => audienceRiders.filter((r) => (isEmail ? isValidEmail(r.email) : toMensatekPhone(r.phone))),
    [audienceRiders, isEmail],
  )
  const skipped = audienceRiders.length - eligible.length

  const channelTemplates = templates.filter((t) => (isEmail ? t.channel === 'email' : t.channel === 'sms'))
  const preview = eligible[0]

  const smsReady = smsIssuerReady(config)
  const emailSenderReady = isValidEmail(config.senderEmail)
  const blocker = isEmail
    ? (!emailSenderReady && 'Configura un remitente de email validado en «Datos del emisor».')
    : (!smsReady && 'Completa Contacto, Teléfono y CIF del emisor en «Datos del emisor».')

  const canSend = eligible.length > 0 && !blocker && (isEmail ? subject.trim() && emailBody.trim() : smsText.trim())

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel shadow-soft">
      <div className="flex items-center gap-3 border-b border-line p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Send className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fg">Redactar y enviar</h3>
          <p className="text-xs text-muted">Comunicación certificada a los riders por SMS o Email</p>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* Canal */}
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-inset p-1">
          {CHANNEL_TABS.map((c) => {
            const Icon = c.icon
            const on = channel === c.id
            return (
              <button
                key={c.id}
                onClick={() => setChannel(c.id)}
                className={clsx(
                  'flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition sm:text-sm',
                  on ? 'bg-panel text-fg shadow-sm ring-1 ring-accent/30' : 'text-muted hover:text-fg',
                )}
              >
                <Icon className={clsx('h-4 w-4 shrink-0', on && 'text-accent')} />
                <span className="hidden truncate sm:inline">{c.label}</span>
                <span className="truncate sm:hidden">{c.id === 'email' ? 'Email' : c.id === 'sms_contrato' ? 'Contrato' : 'SMS'}</span>
              </button>
            )
          })}
        </div>

        {/* Audiencia */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            <Users className="h-3.5 w-3.5" /> Audiencia
          </span>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="rounded-lg border border-line bg-inset px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent/60"
          >
            {AUDIENCES.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-accent">
            {eligible.length} destinatarios
          </span>
          {skipped > 0 && (
            <span className="text-xs text-faint">· {skipped} sin {isEmail ? 'email' : 'teléfono'} se omiten</span>
          )}
        </div>

        {/* Plantillas del canal */}
        {channelTemplates.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted">Plantilla:</span>
            {channelTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  if (isEmail) {
                    setSubject(t.subject || subject)
                    setEmailBody(t.body)
                  } else {
                    setSmsText(t.body)
                  }
                }}
                className="rounded-full border border-line bg-inset px-2.5 py-1 text-xs text-muted transition hover:border-accent/40 hover:text-fg"
              >
                {t.title}
              </button>
            ))}
          </div>
        )}

        {/* Compositor */}
        {isEmail ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Asunto</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-line bg-inset px-3 py-2.5 text-sm text-fg outline-none focus:border-accent/60"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Cuerpo del email</label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={5}
                className="w-full resize-y rounded-lg border border-line bg-inset px-3 py-2.5 text-sm text-fg outline-none focus:border-accent/60"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
              <span>Mensaje SMS</span>
              <span className="tabular-nums text-faint">{smsText.length} car.</span>
            </label>
            <textarea
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-lg border border-line bg-inset px-3 py-2.5 text-sm text-fg outline-none focus:border-accent/60"
            />
            <p className="mt-1 text-xs text-faint">
              Remitente: <span className="font-medium text-muted">{config.senderSms || '(por defecto)'}</span>
              {channel === 'sms_contrato' && ' · El destinatario cierra el contrato respondiendo SÍ/ACEPTO.'}
            </p>
          </div>
        )}

        <p className="text-xs text-faint">
          Variables:{' '}
          {['{nombre}', '{pedido_id}', '{store}', '{matricula}'].map((v) => (
            <code key={v} className="mr-1 rounded bg-inset px-1 py-0.5 font-mono text-[11px] text-accent">{v}</code>
          ))}
          se rellenan por rider.
        </p>

        {/* Vista previa */}
        {preview && (
          <div className="rounded-lg border border-line bg-inset/50 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
              {isEmail ? <Mail className="h-3 w-3" /> : <MessageSquareText className="h-3 w-3" />}
              Vista previa · {preview.name} · {isEmail ? preview.email : preview.phone}
            </p>
            {isEmail && <p className="mb-1 text-sm font-semibold text-fg">{buildMessage(subject, preview)}</p>}
            <p className="whitespace-pre-wrap text-sm text-muted">
              {buildMessage(isEmail ? emailBody : smsText, preview)}
            </p>
          </div>
        )}

        {blocker && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{blocker}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-faint">
            {credits != null && <>Créditos: <span className="font-medium tabular-nums text-muted">{credits.toLocaleString('es-ES')}</span></>}
          </p>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!canSend}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Enviar a {eligible.length}
          </button>
        </div>
      </div>

      {confirmOpen && (
        <SendConfirmModal
          channel={channel}
          eligible={eligible}
          subject={subject}
          emailBody={emailBody}
          smsText={smsText}
          sendSms={sendSms}
          sendEmail={sendEmail}
          onLog={logSent}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </section>
  )
}

function SendConfirmModal({ channel, eligible, subject, emailBody, smsText, sendSms, sendEmail, onLog, onClose }) {
  const isEmail = channel === 'email'
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [progress, setProgress] = useState(0)
  const [okCount, setOkCount] = useState(0)
  const [errCount, setErrCount] = useState(0)
  const [errMsg, setErrMsg] = useState('')

  // Agrupa destinatarios por contenido YA resuelto (mismo texto => un solo envío).
  // Sin variables -> 1 lote para todos; con {nombre} -> un lote por rider.
  function buildChunks() {
    const groups = new Map()
    for (const r of eligible) {
      const body = buildMessage(isEmail ? emailBody : smsText, r)
      const subj = isEmail ? buildMessage(subject, r) : ''
      const key = `${subj} ${body}`
      if (!groups.has(key)) groups.set(key, { subj, body, riders: [] })
      groups.get(key).riders.push(r)
    }
    const chunks = []
    for (const g of groups.values()) {
      for (let i = 0; i < g.riders.length; i += BATCH) {
        chunks.push({ subj: g.subj, body: g.body, riders: g.riders.slice(i, i + BATCH) })
      }
    }
    return chunks
  }

  async function run() {
    setSending(true)
    setProgress(0)
    setErrMsg('')
    let ok = 0
    let err = 0
    let processed = 0
    const chunks = buildChunks()
    for (const c of chunks) {
      let success = false
      let res = null
      try {
        // eslint-disable-next-line no-await-in-loop
        res = isEmail
          ? await sendEmail({ riders: c.riders, subject: c.subj, body: c.body })
          : await sendSms({ riders: c.riders, message: c.body, contrato: channel === 'sms_contrato' })
        success = Boolean(res?.ok)
        if (!success) setErrMsg(res?.error || 'Error en el envío.')
      } catch (e) {
        setErrMsg(e?.message || 'Error de red.')
      }
      if (success) ok += c.riders.length
      else err += c.riders.length
      // eslint-disable-next-line no-await-in-loop
      await onLog(
        c.riders.map((r) => ({
          riderId: r.id,
          riderName: r.name,
          channel,
          target: isEmail ? r.email : r.phone,
          subject: isEmail ? c.subj : '',
          message: c.body,
          status: success ? 'enviado' : 'error',
          idMensaje: res?.idMensaje,
          cred: res?.cred,
          creditosUsados: res?.creditosUsados,
        })),
      )
      processed += c.riders.length
      setProgress(processed)
      setOkCount(ok)
      setErrCount(err)
    }
    setSending(false)
    setDone(true)
  }

  const label = isEmail ? 'Email Certificado' : channel === 'sms_contrato' ? 'SMS Contrato' : 'SMS Certificado'

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={sending ? undefined : onClose}
    >
      <div className="w-full max-w-lg animate-scale-in rounded-xl border border-line bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
            <ShieldCheck className="h-4 w-4 text-accent" /> Confirmar envío certificado
          </h2>
          <button onClick={onClose} disabled={sending} className="rounded-lg p-1.5 text-muted transition hover:bg-inset hover:text-fg disabled:opacity-40" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="rounded-lg border border-line bg-inset/50 p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted">Canal</span><span className="font-medium text-fg">{label}</span></div>
            <div className="mt-1 flex justify-between"><span className="text-muted">Destinatarios</span><span className="font-semibold tabular-nums text-fg">{eligible.length}</span></div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Envío <strong>real</strong> a conductores reales. Consume créditos de Mensatek y genera
              certificados con valor legal. Esta acción no se puede deshacer.
            </p>
          </div>

          {(sending || done) && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>{done ? 'Completado' : 'Enviando…'}</span>
                <span className="tabular-nums">{progress}/{eligible.length}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-inset">
                <div className="h-full bg-accent transition-all" style={{ width: `${eligible.length ? (progress / eligible.length) * 100 : 0}%` }} />
              </div>
              {(okCount > 0 || errCount > 0) && (
                <p className="mt-2 text-xs text-muted">
                  <span className="text-emerald-600 dark:text-emerald-400">{okCount} enviados</span>
                  {errCount > 0 && <span className="text-red-600 dark:text-red-400"> · {errCount} con error</span>}
                </p>
              )}
              {errMsg && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errMsg}</p>}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line p-4">
          {done ? (
            <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">
              <CheckCircle2 className="h-4 w-4" /> Cerrar
            </button>
          ) : (
            <>
              <button onClick={onClose} disabled={sending} className="rounded-lg border border-line px-3 py-2 text-sm text-muted transition hover:bg-inset disabled:opacity-40">
                Cancelar
              </button>
              <button onClick={run} disabled={sending} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
                {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</> : <><Send className="h-4 w-4" /> Confirmar y enviar</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
