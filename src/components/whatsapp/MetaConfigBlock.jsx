import { useState } from 'react'
import clsx from 'clsx'
import { Eye, EyeOff, Loader2, Plug, Cloud } from 'lucide-react'
import { useWhatsApp } from '../../state/whatsapp'
import CollapsibleCard from '../common/CollapsibleCard'

function StatusPill({ status }) {
  const map = {
    idle: { text: 'text-muted', label: 'Sin verificar' },
    connected: { text: 'text-emerald-600 dark:text-emerald-400', label: '🟢 Conectado' },
    error: { text: 'text-red-600 dark:text-red-400', label: '🔴 Desconectado' },
  }
  const s = map[status] ?? map.idle
  return <span className={clsx('text-xs font-medium', s.text)}>{s.label}</span>
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-inset px-2.5 py-2 text-sm text-fg placeholder-faint outline-none transition focus:border-accent/60"
      />
    </div>
  )
}

export default function MetaConfigBlock() {
  const { settings, setMetaConfig, metaToken, setMetaToken } = useWhatsApp()
  const { phoneNumberId, businessAccountId } = settings.metaConfig
  const [showToken, setShowToken] = useState(false)
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState('idle')
  const [mode, setMode] = useState('template')
  const [templateName, setTemplateName] = useState('')
  const [langCode, setLangCode] = useState('es')

  function verify() {
    setChecking(true)
    setStatus('idle')
    // DEMO: validación simulada. Producción -> GET graph.facebook.com/v21.0/{phone_number_id} (backend).
    setTimeout(() => {
      setStatus(phoneNumberId && businessAccountId && metaToken ? 'connected' : 'error')
      setChecking(false)
    }, 900)
  }

  return (
    <CollapsibleCard
      title="Bloque A · WhatsApp Business API"
      subtitle="Envío oficial vía Meta Cloud API · producción"
      icon={Cloud}
      right={<StatusPill status={checking ? 'idle' : status} />}
    >
      <div className="space-y-3">
        <Field label="Phone Number ID" value={phoneNumberId} onChange={(v) => setMetaConfig({ phoneNumberId: v })} placeholder="1234567890" />
        <Field label="Business Account ID" value={businessAccountId} onChange={(v) => setMetaConfig({ businessAccountId: v })} placeholder="9876543210" />
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Access Token permanente</label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={metaToken}
              onChange={(e) => setMetaToken(e.target.value)}
              placeholder="EAAG…"
              autoComplete="off"
              className="w-full rounded-lg border border-line bg-inset py-2 pl-2.5 pr-10 text-sm text-fg placeholder-faint outline-none transition focus:border-accent/60"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-faint transition hover:text-fg"
              aria-label="Mostrar/ocultar token"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-faint">El token vive solo en memoria (no se guarda).</p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Modo de mensaje</label>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-inset p-1">
            {[
              { id: 'template', label: 'Plantilla aprobada' },
              { id: 'freetext', label: 'Texto libre' },
            ].map((o) => (
              <button
                key={o.id}
                onClick={() => setMode(o.id)}
                className={clsx(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition',
                  mode === o.id ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          {mode === 'template' && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="Nombre de plantilla" value={templateName} onChange={setTemplateName} placeholder="turno_recordatorio" />
              <Field label="Idioma (lang code)" value={langCode} onChange={setLangCode} placeholder="es" />
            </div>
          )}
        </div>

        <button
          onClick={verify}
          disabled={checking}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
          Verificar conexión
        </button>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
          Demo: verificación y envío simulados. En producción el backend hace
          <span className="font-mono"> GET/POST graph.facebook.com/v21.0/&#123;phone_number_id&#125;</span>.
        </div>
      </div>
    </CollapsibleCard>
  )
}
