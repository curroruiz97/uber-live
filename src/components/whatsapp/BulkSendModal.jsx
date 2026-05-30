import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { X, Loader2, CheckCircle2, Cloud, AlertTriangle } from 'lucide-react'
import WhatsAppIcon from '../common/WhatsAppIcon'
import { useWhatsApp } from '../../state/whatsapp'
import { buildMessage } from '../../utils/whatsapp'
import { whatsappCloud } from '../../api/whatsappCloud'

// Rellena las variables {{1}}, {{2}}… de una plantilla de Meta (la 1ª = nombre).
function templateParams(bodyVars, rider) {
  return Array.from({ length: bodyVars || 0 }, (_, i) => (i === 0 ? rider.name || '' : '—'))
}
function previewTemplate(bodyText, rider) {
  return String(bodyText || '').replace(/\{\{(\d+)\}\}/g, (_m, n) => (Number(n) === 1 ? rider.name || '{{1}}' : '—'))
}

export default function BulkSendModal({ open, onClose, riders }) {
  const { settings, logSent, cloud, sendCloud } = useWhatsApp()
  const withPhone = useMemo(() => (riders || []).filter((r) => r.phone), [riders])
  const withoutPhone = (riders?.length || 0) - withPhone.length
  const configured = Boolean(cloud.configured)

  const [mode, setMode] = useState('template') // 'template' | 'text'
  const [tplList, setTplList] = useState(null) // plantillas aprobadas de Meta
  const [tplName, setTplName] = useState('')
  const [loadingTpl, setLoadingTpl] = useState(false)
  const [tplErr, setTplErr] = useState(null)
  const [quickId, setQuickId] = useState('')

  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [sentOk, setSentOk] = useState(0)
  const [sentErr, setSentErr] = useState(0)

  useEffect(() => {
    if (!open) return
    setSending(false)
    setProgress(0)
    setDone(false)
    setSentOk(0)
    setSentErr(0)
    setTplErr(null)
    setQuickId(settings.quickTemplates[0]?.id || '')
    setMode(configured ? 'template' : 'text')
    if (configured) {
      setLoadingTpl(true)
      whatsappCloud
        .templates()
        .then((r) => {
          const approved = (r.templates || []).filter((t) => t.status === 'APPROVED')
          setTplList(approved)
          setTplName(approved[0]?.name || '')
          if (approved.length === 0) setMode('text')
        })
        .catch((e) => {
          setTplErr(e.message)
          setTplList([])
          setMode('text')
        })
        .finally(() => setLoadingTpl(false))
    } else {
      setTplList(null)
    }
  }, [open, configured, settings.quickTemplates])

  const quick = settings.quickTemplates.find((t) => t.id === quickId)
  const selectedTpl = (tplList || []).find((t) => t.name === tplName)
  const previewRider = withPhone[0]
  const previewMsg = previewRider
    ? mode === 'template'
      ? previewTemplate(selectedTpl?.bodyText, previewRider)
      : quick
        ? buildMessage(quick.text, previewRider)
        : ''
    : ''

  const canSend =
    withPhone.length > 0 && (mode === 'template' ? Boolean(tplName) : Boolean(quick))

  async function startSend() {
    if (!canSend) return
    setSending(true)
    setProgress(0)
    setSentOk(0)
    setSentErr(0)
    let ok = 0
    let err = 0
    for (let i = 0; i < withPhone.length; i += 1) {
      const r = withPhone[i]
      // Escalonado a 1 msg/s: respeta los rate limits de Meta y pacea el gasto de créditos.
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, 1000))

      if (!configured) {
        // Sin la API conectada: solo se registra (demo) para mostrar el flujo.
        const message = quick ? buildMessage(quick.text, r) : ''
        ok += 1
        // eslint-disable-next-line no-await-in-loop
        await logSent({ riderId: r.id, riderName: r.name, phone: r.phone, message, status: 'enviado (demo)', channel: 'bulk' })
      } else if (mode === 'template') {
        const message = `[plantilla] ${tplName}`
        try {
          // eslint-disable-next-line no-await-in-loop
          await sendCloud({
            to: r.phone,
            type: 'template',
            template: { name: tplName, language: selectedTpl?.language || 'es', params: templateParams(selectedTpl?.bodyVars, r) },
            riderId: r.id,
            riderName: r.name,
          })
          ok += 1
          // eslint-disable-next-line no-await-in-loop
          await logSent({ riderId: r.id, riderName: r.name, phone: r.phone, message, status: 'enviado', channel: 'cloud' })
        } catch (e) {
          err += 1
          // eslint-disable-next-line no-await-in-loop
          await logSent({ riderId: r.id, riderName: r.name, phone: r.phone, message: `error: ${e.message}`, status: 'error', channel: 'cloud' })
        }
      } else {
        const message = buildMessage(quick.text, r)
        try {
          // eslint-disable-next-line no-await-in-loop
          await sendCloud({ to: r.phone, type: 'text', text: message, riderId: r.id, riderName: r.name })
          ok += 1
          // eslint-disable-next-line no-await-in-loop
          await logSent({ riderId: r.id, riderName: r.name, phone: r.phone, message, status: 'enviado', channel: 'cloud' })
        } catch (e) {
          err += 1
          // eslint-disable-next-line no-await-in-loop
          await logSent({ riderId: r.id, riderName: r.name, phone: r.phone, message: `error: ${e.message}`, status: 'error', channel: 'cloud' })
        }
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
              configured
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
            )}
          >
            {configured ? <Cloud className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
            {configured
              ? 'WhatsApp Business API conectada · envío REAL (1 crédito por mensaje)'
              : 'API no conectada · envío simulado. Conéctala en Ajustes → Integraciones → WhatsApp Business API.'}
          </div>

          {/* Selector de modo (solo con la API conectada) */}
          {configured && (
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-inset p-1">
              {[
                { id: 'template', label: 'Plantilla aprobada' },
                { id: 'text', label: 'Texto libre (24 h)' },
              ].map((o) => (
                <button
                  key={o.id}
                  onClick={() => setMode(o.id)}
                  disabled={sending}
                  className={clsx(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition',
                    mode === o.id ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {/* Selección de plantilla aprobada de Meta */}
          {configured && mode === 'template' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Plantilla aprobada (Meta)</label>
              {loadingTpl ? (
                <div className="flex items-center gap-2 rounded-lg border border-line bg-inset px-2.5 py-2 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando plantillas…
                </div>
              ) : tplList && tplList.length > 0 ? (
                <select
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  disabled={sending}
                  className="w-full rounded-lg border border-line bg-inset px-2.5 py-2 text-sm text-fg outline-none transition focus:border-accent/60"
                >
                  {tplList.map((t) => (
                    <option key={`${t.name}-${t.language}`} value={t.name}>
                      {t.name} · {t.language} · {t.bodyVars} var.
                    </option>
                  ))}
                </select>
              ) : (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                  {tplErr || 'No hay plantillas aprobadas. Créalas en Meta Business → WhatsApp → Plantillas, o usa “Texto libre”.'}
                </p>
              )}
            </div>
          )}

          {/* Selección de plantilla rápida (texto libre / demo) */}
          {(mode === 'text' || !configured) && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Plantilla de texto</label>
              <select
                value={quickId}
                onChange={(e) => setQuickId(e.target.value)}
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
          )}

          {previewMsg && (
            <div className="rounded-lg border border-line bg-inset p-3">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
                Vista previa · {previewRider?.name}
              </p>
              <p className="whitespace-pre-wrap text-sm text-fg">{previewMsg}</p>
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

          <div className="rounded-lg border border-line bg-inset/40 p-2.5 text-xs text-muted">
            {!configured
              ? 'Envío simulado (solo se registra en el log). Conecta la WhatsApp Business API para enviar de verdad.'
              : mode === 'template'
                ? 'Plantilla aprobada: válida para mensajes proactivos a cualquier rider. La 1ª variable se rellena con su nombre.'
                : 'Texto libre: WhatsApp solo lo entrega a riders que te hayan escrito en las últimas 24 h. Para el resto usa una plantilla.'}
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
                disabled={sending || !canSend}
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
