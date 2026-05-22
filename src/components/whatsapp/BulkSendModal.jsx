import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { X, Loader2, CheckCircle2, Wifi, WifiOff } from 'lucide-react'
import WhatsAppIcon from '../common/WhatsAppIcon'
import { useWhatsApp } from '../../state/whatsapp'
import { buildMessage } from '../../utils/whatsapp'
import { waStatus, waSend } from '../../api/whatsappBackend'

export default function BulkSendModal({ open, onClose, riders }) {
  const { settings, logSent } = useWhatsApp()
  const withPhone = useMemo(() => (riders || []).filter((r) => r.phone), [riders])
  const withoutPhone = (riders?.length || 0) - withPhone.length

  const [templateId, setTemplateId] = useState('')
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [connected, setConnected] = useState(false)
  const [sentOk, setSentOk] = useState(0)
  const [sentErr, setSentErr] = useState(0)

  useEffect(() => {
    if (open) {
      setTemplateId(settings.quickTemplates[0]?.id || '')
      setSending(false)
      setProgress(0)
      setDone(false)
      setSentOk(0)
      setSentErr(0)
      // ¿Hay sesión real conectada (Bloque B)? -> envío real; si no, simulado.
      waStatus().then((s) => setConnected(Boolean(s.ready)))
    }
  }, [open, settings.quickTemplates])

  const template = settings.quickTemplates.find((t) => t.id === templateId)
  const previewRider = withPhone[0]
  const previewMsg = template && previewRider ? buildMessage(template.text, previewRider) : ''

  async function startSend() {
    if (!template || !withPhone.length) return
    setSending(true)
    setProgress(0)
    setSentOk(0)
    setSentErr(0)
    let ok = 0
    let err = 0
    // Escalonado a 1 msg/s (respeta rate limits y reduce el riesgo de baneo).
    for (let i = 0; i < withPhone.length; i += 1) {
      const r = withPhone[i]
      const message = buildMessage(template.text, r)
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, 1000))
      if (connected) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await waSend(r.phone, message)
          ok += 1
          logSent({ riderId: r.id, riderName: r.name, phone: r.phone, message, status: 'enviado', channel: 'api' })
        } catch {
          err += 1
          logSent({ riderId: r.id, riderName: r.name, phone: r.phone, message, status: 'error', channel: 'api' })
        }
      } else {
        ok += 1
        logSent({ riderId: r.id, riderName: r.name, phone: r.phone, message, status: 'enviado (demo)', channel: 'bulk' })
      }
      setProgress(i + 1)
      setSentOk(ok)
      setSentErr(err)
    }
    setSending(false)
    setDone(true)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={sending ? undefined : onClose}
    >
      <div
        className="w-full max-w-lg animate-scale-in rounded-xl border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
            <WhatsAppIcon className="h-4 w-4 text-[#25D366]" /> Envío masivo de WhatsApp
          </h2>
          <button
            onClick={onClose}
            disabled={sending}
            className="rounded-lg p-1.5 text-muted transition hover:bg-inset hover:text-fg disabled:opacity-40"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-sm text-muted">
            {withPhone.length} destinatarios
            {withoutPhone > 0 && <span className="text-faint"> · {withoutPhone} sin teléfono se omiten</span>}
          </p>

          <div
            className={clsx(
              'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium',
              connected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-line bg-inset text-muted',
            )}
          >
            {connected ? <Wifi className="h-3.5 w-3.5 shrink-0" /> : <WifiOff className="h-3.5 w-3.5 shrink-0" />}
            {connected
              ? 'Sesión WhatsApp conectada · envío REAL'
              : 'Sin sesión · envío simulado (conéctala en el Bloque B para enviar de verdad)'}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Plantilla</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={sending}
              className="w-full rounded-lg border border-line bg-inset px-2.5 py-2 text-sm text-fg outline-none transition focus:border-accent/60"
            >
              {settings.quickTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          {previewMsg && (
            <div className="rounded-lg border border-line bg-inset p-3">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
                Vista previa · {previewRider?.name}
              </p>
              <p className="text-sm text-fg">{previewMsg}</p>
            </div>
          )}

          {(sending || done) && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>{done ? 'Completado' : 'Enviando…'}</span>
                <span className="tabular-nums">
                  {progress}/{withPhone.length}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-inset">
                <div
                  className="h-full bg-[#25D366] transition-all"
                  style={{ width: `${withPhone.length ? (progress / withPhone.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
            {connected
              ? 'Envío REAL vía whatsapp-web.js (sesión del Bloque B), escalonado a 1 msg/s. Método no oficial: WhatsApp puede banear el número con envío masivo.'
              : 'Envío simulado (solo se registra en el log). Conecta la sesión en el Bloque B para enviar de verdad.'}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line p-4">
          {done ? (
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <CheckCircle2 className="h-4 w-4" /> {sentOk} enviados{sentErr ? ` · ${sentErr} con error` : ''} · Cerrar
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={sending}
                className="rounded-lg border border-line px-3 py-2 text-sm text-muted transition hover:bg-inset disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={startSend}
                disabled={sending || !withPhone.length || !template}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
                  </>
                ) : (
                  <>
                    <WhatsAppIcon className="h-4 w-4" /> Confirmar y enviar ({withPhone.length})
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
