import { useState } from 'react'
import clsx from 'clsx'
import {
  Loader2,
  Cloud,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  BadgeCheck,
} from 'lucide-react'
import { useWhatsApp } from '../../state/whatsapp'
import { useToast } from '../../state/toast'
import { whatsappCloud } from '../../api/whatsappCloud'
import CollapsibleCard from '../common/CollapsibleCard'

function StatusPill({ state }) {
  const map = {
    connected: { cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', icon: CheckCircle2, txt: 'Conectado' },
    configured: { cls: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: AlertTriangle, txt: 'Sin verificar' },
    checking: { cls: 'border-line bg-inset text-muted', icon: Loader2, txt: 'Verificando…' },
    error: { cls: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400', icon: XCircle, txt: 'Error' },
    idle: { cls: 'border-line bg-inset text-muted', icon: AlertTriangle, txt: 'Sin configurar' },
  }
  const s = map[state] ?? map.idle
  const Icon = s.icon
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', s.cls)}>
      <Icon className={clsx('h-3.5 w-3.5', state === 'checking' && 'animate-spin')} />
      {s.txt}
    </span>
  )
}

function Detail({ label, value, mono }) {
  return (
    <div className="bg-panel p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-faint">{label}</p>
      <p className={clsx('mt-0.5 truncate text-sm text-fg', mono && 'font-mono')} title={value}>{value || '—'}</p>
    </div>
  )
}

const TPL_STATUS = {
  APPROVED: 'text-emerald-600 dark:text-emerald-400',
  PENDING: 'text-amber-600 dark:text-amber-400',
  REJECTED: 'text-red-600 dark:text-red-400',
}

export default function MetaConfigBlock() {
  const { cloud, reloadCloud } = useWhatsApp()
  const { toast } = useToast()
  const [verifying, setVerifying] = useState(false)
  const [verifyErr, setVerifyErr] = useState(null)
  const [loadingTpl, setLoadingTpl] = useState(false)
  const [templates, setTemplates] = useState(null)
  const [tplErr, setTplErr] = useState(null)

  const pill = verifying
    ? 'checking'
    : verifyErr
      ? 'error'
      : cloud.configured
        ? cloud.status === 'connected'
          ? 'connected'
          : 'configured'
        : 'idle'

  async function verify() {
    setVerifying(true)
    setVerifyErr(null)
    try {
      const r = await whatsappCloud.verify()
      await reloadCloud()
      toast({
        type: 'success',
        title: 'Conexión verificada',
        message: r.displayPhone ? `${r.verifiedName || 'Número'} · ${r.displayPhone}` : 'Número verificado correctamente',
      })
    } catch (e) {
      setVerifyErr(e.message)
      toast({ type: 'error', title: 'No se pudo verificar', message: e.message })
    }
    setVerifying(false)
  }

  async function loadTemplates() {
    setLoadingTpl(true)
    setTplErr(null)
    try {
      const r = await whatsappCloud.templates()
      setTemplates(r.templates || [])
    } catch (e) {
      setTplErr(e.message)
      setTemplates(null)
    }
    setLoadingTpl(false)
  }

  return (
    <CollapsibleCard
      title="Bloque A · WhatsApp Business API"
      subtitle="Meta Cloud API · oficial · funciona en producción"
      icon={Cloud}
      right={<StatusPill state={pill} />}
    >
      {!cloud.configured ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <p className="font-medium">Aún no has conectado la WhatsApp Business API.</p>
          <p className="mt-1 text-amber-700/80 dark:text-amber-300/80">
            Ve a <strong>Ajustes → Integraciones / APIs → WhatsApp Business API</strong> e introduce tu{' '}
            <strong>Phone Number ID</strong>, <strong>Business Account ID</strong> y el{' '}
            <strong>token permanente</strong> de Meta (en{' '}
            <em>Meta Business → WhatsApp → Configuración de la API</em>). Es la API oficial: funciona en
            producción sin servidor propio.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            <Detail label="Número verificado" value={cloud.verifiedName || (cloud.status === 'connected' ? 'Verificado' : 'Pendiente de verificar')} />
            <Detail label="Teléfono" value={cloud.displayPhone} mono />
            <Detail label="Phone Number ID" value={cloud.phoneNumberId} mono />
            <Detail label="Token permanente" value={cloud.last4 ? `•••• ${cloud.last4}` : 'Guardado'} mono />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={verify}
              disabled={verifying}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Verificar conexión
            </button>
            <button
              onClick={loadTemplates}
              disabled={loadingTpl}
              className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-fg transition hover:bg-inset disabled:opacity-50"
            >
              {loadingTpl ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {templates ? 'Recargar plantillas' : 'Ver plantillas aprobadas'}
            </button>
          </div>

          {verifyErr && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="break-words">{verifyErr}</span>
            </div>
          )}

          {tplErr && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400">{tplErr}</div>
          )}

          {templates && (
            <div className="rounded-lg border border-line bg-inset/40">
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <p className="text-xs font-semibold text-fg">Plantillas de mensaje ({templates.length})</p>
                <span className="text-[11px] text-faint">Meta Business</span>
              </div>
              {templates.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted">
                  No hay plantillas. Créalas en <em>Meta Business → WhatsApp → Plantillas de mensajes</em> para
                  poder enviar mensajes proactivos (fuera de la ventana de 24 h).
                </p>
              ) : (
                <ul className="max-h-56 divide-y divide-line overflow-auto">
                  {templates.map((t) => (
                    <li key={`${t.name}-${t.language}`} className="flex items-start justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
                          <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-faint" />
                          <span className="truncate font-mono">{t.name}</span>
                        </p>
                        {t.bodyText && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">{t.bodyText}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={clsx('text-[11px] font-semibold', TPL_STATUS[t.status] || 'text-muted')}>{t.status}</span>
                        <p className="text-[11px] text-faint">{t.language} · {t.bodyVars} var.</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-lg border border-line bg-inset/40 p-2.5 text-[11px] text-muted">
            Los mensajes proactivos (fuera de la ventana de 24 h) requieren una{' '}
            <strong className="text-fg">plantilla aprobada</strong>. El texto libre solo se entrega a riders que te
            hayan escrito en las últimas 24 h. Cada mensaje consume 1 crédito del plan.
          </div>
        </div>
      )}
    </CollapsibleCard>
  )
}
