import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { Loader2, Save, CheckCircle2, XCircle, Plug, ShieldCheck, MessageSquareText, Copy } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useOrg } from '../../../state/OrgContext'
import { useToast } from '../../../state/toast'
import { createUberClient } from '../../../api/uberClient'
import { mensatekApi } from '../../../api/mensatekClient'
import { orgCredentials } from '../../../api/orgCredentials'
import { MENSATEK_WEBHOOK_URL } from '../../../config/api'
import SettingsField, { SettingsCard } from '../SettingsField'

function StatusPill({ configured }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
      configured ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-line bg-inset text-muted',
    )}>
      {configured ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {configured ? 'Configurada' : 'Sin configurar'}
    </span>
  )
}

function VerifyResult({ result }) {
  if (!result || result.status === 'idle') return null
  const ok = result.status === 'ok'
  return (
    <p className={clsx('mt-3 flex items-center gap-1.5 text-xs', ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {result.msg}
    </p>
  )
}

export default function IntegrationsSection() {
  const { currentOrgId: orgId, isOwnerOrAdmin } = useOrg()
  const { toast } = useToast()
  const [integ, setInteg] = useState(null)
  const [loading, setLoading] = useState(true)

  const [uClientId, setUClientId] = useState('')
  const [uSecret, setUSecret] = useState('')
  const [uScope, setUScope] = useState('')
  const [uEnv, setUEnv] = useState('sandbox')
  const [uSaving, setUSaving] = useState(false)
  const [uVerifying, setUVerifying] = useState(false)
  const [uResult, setUResult] = useState(null)

  const [mUser, setMUser] = useState('')
  const [mToken, setMToken] = useState('')
  const [mSaving, setMSaving] = useState(false)
  const [mVerifying, setMVerifying] = useState(false)
  const [mResult, setMResult] = useState(null)

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase.from('org_integrations').select('*').eq('org_id', orgId).maybeSingle()
    setInteg(data || {})
    setUClientId(data?.uber_client_id || '')
    setUScope(data?.uber_scope || '')
    setUEnv(data?.uber_environment || 'sandbox')
    setMUser(data?.mensatek_api_user || '')
    setLoading(false)
  }, [orgId])

  useEffect(() => { load() }, [load])

  async function saveUber() {
    setUSaving(true)
    try {
      const res = await orgCredentials.saveUber({ client_id: uClientId.trim(), client_secret: uSecret.trim(), scope: uScope.trim(), environment: uEnv })
      setUSecret('')
      await load()
      if (res?.configured) toast({ type: 'success', title: 'Credenciales de Uber guardadas' })
      else toast({ type: 'warning', title: 'Faltan datos', message: 'Rellena Client ID y Client Secret.' })
    } catch (e) {
      toast({ type: 'error', title: 'No se pudo guardar', message: e.message })
    }
    setUSaving(false)
  }
  async function verifyUber() {
    setUVerifying(true)
    setUResult({ status: 'idle' })
    try {
      if (uClientId.trim() || uSecret.trim()) {
        await orgCredentials.saveUber({ client_id: uClientId.trim(), client_secret: uSecret.trim(), scope: uScope.trim(), environment: uEnv })
        setUSecret('')
        await load()
      }
      const res = await createUberClient({ environment: uEnv }).getPing()
      setUResult({ status: 'ok', msg: `Conexión correcta · ${res.orgs ?? 0} organizaciones visibles` })
    } catch (e) {
      setUResult({ status: 'error', msg: e.message })
    }
    setUVerifying(false)
  }

  async function saveMensatek() {
    setMSaving(true)
    try {
      const res = await orgCredentials.saveMensatek({ api_user: mUser.trim(), api_token: mToken.trim() })
      setMToken('')
      await load()
      if (res?.configured) toast({ type: 'success', title: 'Credenciales de Mensatek guardadas' })
      else toast({ type: 'warning', title: 'Faltan datos', message: 'Rellena Usuario API y API Token.' })
    } catch (e) {
      toast({ type: 'error', title: 'No se pudo guardar', message: e.message })
    }
    setMSaving(false)
  }
  async function verifyMensatek() {
    setMVerifying(true)
    setMResult({ status: 'idle' })
    try {
      if (mUser.trim() || mToken.trim()) {
        await orgCredentials.saveMensatek({ api_user: mUser.trim(), api_token: mToken.trim() })
        setMToken('')
        await load()
      }
      const res = await mensatekApi.credits()
      setMResult({ status: 'ok', msg: `Conexión correcta · ${(res.cred ?? 0).toLocaleString('es-ES')} créditos disponibles` })
    } catch (e) {
      setMResult({ status: 'error', msg: e.message })
    }
    setMVerifying(false)
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>

  const ro = !isOwnerOrAdmin

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Conecta las APIs de <strong className="text-fg">tu empresa</strong>. Las claves se guardan cifradas en el servidor
        y nunca se muestran de nuevo (solo verás los últimos dígitos).
      </p>

      {/* Uber */}
      <SettingsCard
        icon={Plug}
        title="Uber Vehicle Solutions"
        subtitle="Datos de tu flota de riders (OAuth client credentials)"
        right={
          <div className="flex items-center gap-2">
            <span className={clsx('rounded-full border px-2 py-0.5 text-[11px] font-medium', uEnv === 'production' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-line bg-inset text-muted')}>
              {uEnv === 'production' ? 'Producción' : 'Sandbox'}
            </span>
            <StatusPill configured={Boolean(integ?.uber_configured)} />
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsField label="Client ID" value={uClientId} onChange={setUClientId} disabled={ro} mono placeholder="Application ID de Uber" />
          <SettingsField label="Client Secret" type="password" value={uSecret} onChange={setUSecret} disabled={ro} mono placeholder={integ?.uber_last4 ? `•••• ${integ.uber_last4} (sin cambios)` : 'Secreto de la app'} autoComplete="off" />
          <SettingsField label="Scope (opcional)" value={uScope} onChange={setUScope} disabled={ro} mono placeholder="vehicle_suppliers..." />
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Entorno</label>
            <select value={uEnv} onChange={(e) => setUEnv(e.target.value)} disabled={ro} className="w-full rounded-lg border border-line bg-inset px-3 py-2.5 text-sm text-fg outline-none focus:border-accent/60 disabled:opacity-60">
              <option value="sandbox">Sandbox</option>
              <option value="production">Producción</option>
            </select>
          </div>
        </div>
        {!ro && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={saveUber} disabled={uSaving} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
              {uSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </button>
            <button onClick={verifyUber} disabled={uVerifying} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-fg transition hover:bg-inset disabled:opacity-50">
              {uVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verificar
            </button>
          </div>
        )}
        <VerifyResult result={uResult} />
      </SettingsCard>

      {/* Mensatek */}
      <SettingsCard
        icon={MessageSquareText}
        title="Mensatek"
        subtitle="SMS y Email certificado (API v7, Basic Auth)"
        right={<StatusPill configured={Boolean(integ?.mensatek_configured)} />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsField label="Usuario API" value={mUser} onChange={setMUser} disabled={ro} mono placeholder="Usuario API de Mensatek" />
          <SettingsField label="API Token" type="password" value={mToken} onChange={setMToken} disabled={ro} mono placeholder={integ?.mensatek_last4 ? `•••• ${integ.mensatek_last4} (sin cambios)` : 'Token de la API'} autoComplete="off" />
        </div>
        {!ro && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={saveMensatek} disabled={mSaving} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
              {mSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </button>
            <button onClick={verifyMensatek} disabled={mVerifying} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-fg transition hover:bg-inset disabled:opacity-50">
              {mVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verificar
            </button>
          </div>
        )}
        <VerifyResult result={mResult} />
        <p className="mt-3 text-xs text-faint">Encuentra estas claves en tu panel de Mensatek: <em>Tus Datos → Configurar Cuenta</em>.</p>

        {/* Webhook de reports de entrega */}
        <div className="mt-4 rounded-lg border border-line bg-inset/40 p-3">
          <p className="text-xs font-medium text-fg">Reports de entrega (opcional)</p>
          <p className="mt-1 text-xs text-muted">
            Para recibir el estado de entrega en tiempo real, pega esta URL en tu panel de Mensatek
            (<em>Configuración API → recepción de reports en tu web</em>):
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-line bg-panel px-2 py-1.5 font-mono text-[11px] text-muted">{MENSATEK_WEBHOOK_URL}</code>
            <button
              onClick={() => { navigator.clipboard?.writeText(MENSATEK_WEBHOOK_URL); toast({ type: 'success', title: 'URL copiada' }) }}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-fg transition hover:bg-inset"
            >
              <Copy className="h-3.5 w-3.5" /> Copiar
            </button>
          </div>
        </div>
      </SettingsCard>

      {/* WhatsApp */}
      <SettingsCard icon={MessageSquareText} title="WhatsApp" subtitle="Contacto directo (wa.me) y sesión por QR">
        <p className="text-sm text-muted">
          El botón de WhatsApp por rider (<span className="font-mono">wa.me</span>) funciona sin configuración. La sesión por
          QR para envío directo se gestiona desde la sección <strong className="text-fg">WhatsApp</strong> del menú.
        </p>
      </SettingsCard>
    </div>
  )
}
