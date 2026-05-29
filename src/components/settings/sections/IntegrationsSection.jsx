import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { Loader2, Save, CheckCircle2, XCircle, Plug, ShieldCheck, MessageSquareText } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useOrg } from '../../../state/OrgContext'
import { useToast } from '../../../state/toast'
import { createUberClient } from '../../../api/uberClient'
import { mensatekApi } from '../../../api/mensatekClient'
import { orgCredentials } from '../../../api/orgCredentials'
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

export default function IntegrationsSection() {
  const { currentOrgId: orgId, isOwnerOrAdmin } = useOrg()
  const { toast } = useToast()
  const [integ, setInteg] = useState(null)
  const [loading, setLoading] = useState(true)

  // Uber form
  const [uClientId, setUClientId] = useState('')
  const [uSecret, setUSecret] = useState('')
  const [uScope, setUScope] = useState('')
  const [uEnv, setUEnv] = useState('sandbox')
  const [uSaving, setUSaving] = useState(false)
  const [uVerifying, setUVerifying] = useState(false)

  // Mensatek form
  const [mUser, setMUser] = useState('')
  const [mToken, setMToken] = useState('')
  const [mSaving, setMSaving] = useState(false)
  const [mVerifying, setMVerifying] = useState(false)

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

  useEffect(() => {
    load()
  }, [load])

  async function saveUber() {
    setUSaving(true)
    try {
      await orgCredentials.saveUber({ client_id: uClientId.trim(), client_secret: uSecret.trim(), scope: uScope.trim(), environment: uEnv })
      setUSecret('')
      toast({ type: 'success', title: 'Credenciales de Uber guardadas' })
      load()
    } catch (e) {
      toast({ type: 'error', title: 'No se pudo guardar', message: e.message })
    }
    setUSaving(false)
  }

  async function verifyUber() {
    setUVerifying(true)
    try {
      const res = await createUberClient({ environment: uEnv }).getPing()
      toast({ type: 'success', title: 'Conexión Uber OK', message: `${res.orgs ?? 0} organizaciones visibles` })
    } catch (e) {
      toast({ type: 'error', title: 'Falló la verificación', message: e.message })
    }
    setUVerifying(false)
  }

  async function saveMensatek() {
    setMSaving(true)
    try {
      await orgCredentials.saveMensatek({ api_user: mUser.trim(), api_token: mToken.trim() })
      setMToken('')
      toast({ type: 'success', title: 'Credenciales de Mensatek guardadas' })
      load()
    } catch (e) {
      toast({ type: 'error', title: 'No se pudo guardar', message: e.message })
    }
    setMSaving(false)
  }

  async function verifyMensatek() {
    setMVerifying(true)
    try {
      const res = await mensatekApi.credits()
      toast({ type: 'success', title: 'Conexión Mensatek OK', message: `${(res.cred ?? 0).toLocaleString('es-ES')} créditos` })
    } catch (e) {
      toast({ type: 'error', title: 'Falló la verificación', message: e.message })
    }
    setMVerifying(false)
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
  }

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
        right={<StatusPill configured={Boolean(integ?.uber_configured)} />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsField label="Client ID" value={uClientId} onChange={setUClientId} disabled={ro} mono placeholder="Application ID de Uber" />
          <SettingsField
            label="Client Secret"
            type="password"
            value={uSecret}
            onChange={setUSecret}
            disabled={ro}
            mono
            placeholder={integ?.uber_last4 ? `•••• ${integ.uber_last4} (sin cambios)` : 'Secreto de la app'}
            autoComplete="off"
          />
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
          <SettingsField
            label="API Token"
            type="password"
            value={mToken}
            onChange={setMToken}
            disabled={ro}
            mono
            placeholder={integ?.mensatek_last4 ? `•••• ${integ.mensatek_last4} (sin cambios)` : 'Token de la API'}
            autoComplete="off"
          />
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
        <p className="mt-3 text-xs text-faint">Encuentra estas claves en tu panel de Mensatek: <em>Tus Datos → Configurar Cuenta</em>.</p>
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
