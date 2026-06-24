import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { Loader2, Save, CheckCircle2, XCircle, Plug, ShieldCheck, MessageSquareText, Copy, Cloud, Bike } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useOrg } from '../../../state/OrgContext'
import { useApp } from '../../../state/AppContext'
import { useToast } from '../../../state/toast'
import { createUberClient } from '../../../api/uberClient'
import { mensatekApi } from '../../../api/mensatekClient'
import { whatsappCloud } from '../../../api/whatsappCloud'
import { createGlovoClient } from '../../../api/glovoClient'
import { orgCredentials } from '../../../api/orgCredentials'
import { MENSATEK_WEBHOOK_URL } from '../../../config/api'
import SettingsField from '../SettingsField'

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
  const { updateEnvironment } = useApp()
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

  const [wPhone, setWPhone] = useState('')
  const [wWaba, setWWaba] = useState('')
  const [wToken, setWToken] = useState('')
  const [wSaving, setWSaving] = useState(false)
  const [wVerifying, setWVerifying] = useState(false)
  const [wResult, setWResult] = useState(null)

  const [gClientId, setGClientId] = useState('')
  const [gKid, setGKid] = useState('')
  const [gCompany, setGCompany] = useState('')
  const [gCities, setGCities] = useState('')
  const [gEnv, setGEnv] = useState('staging')
  const [gKey, setGKey] = useState('')
  const [gSaving, setGSaving] = useState(false)
  const [gVerifying, setGVerifying] = useState(false)
  const [gResult, setGResult] = useState(null)

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase.from('org_integrations').select('*').eq('org_id', orgId).maybeSingle()
    setInteg(data || {})
    setUClientId(data?.uber_client_id || '')
    setUScope(data?.uber_scope || '')
    setUEnv(data?.uber_environment || 'sandbox')
    setMUser(data?.mensatek_api_user || '')
    setWPhone(data?.whatsapp_phone_number_id || '')
    setWWaba(data?.whatsapp_business_account_id || '')
    setGClientId(data?.glovo_client_id || '')
    setGKid(data?.glovo_kid || '')
    setGCompany(data?.glovo_company_id || '')
    setGCities(data?.glovo_city_codes || '')
    setGEnv(data?.glovo_environment || 'staging')
    setLoading(false)
  }, [orgId])

  useEffect(() => { load() }, [load])

  async function saveUber() {
    setUSaving(true)
    try {
      const res = await orgCredentials.saveUber({ client_id: uClientId.trim(), client_secret: uSecret.trim(), scope: uScope.trim(), environment: uEnv })
      setUSecret('')
      await load()
      if (res?.configured) {
        toast({ type: 'success', title: 'Credenciales de Uber guardadas' })
        updateEnvironment(uEnv)
      } else toast({ type: 'warning', title: 'Faltan datos', message: 'Rellena Client ID y Client Secret.' })
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

  async function saveWhatsApp() {
    setWSaving(true)
    try {
      const res = await orgCredentials.saveWhatsApp({ phone_number_id: wPhone.trim(), business_account_id: wWaba.trim(), token: wToken.trim() })
      setWToken('')
      await load()
      if (res?.configured) toast({ type: 'success', title: 'WhatsApp Business API guardada' })
      else toast({ type: 'warning', title: 'Faltan datos', message: 'Rellena el Phone Number ID y el token permanente.' })
    } catch (e) {
      toast({ type: 'error', title: 'No se pudo guardar', message: e.message })
    }
    setWSaving(false)
  }
  async function verifyWhatsApp() {
    setWVerifying(true)
    setWResult({ status: 'idle' })
    try {
      if (wPhone.trim() || wWaba.trim() || wToken.trim()) {
        await orgCredentials.saveWhatsApp({ phone_number_id: wPhone.trim(), business_account_id: wWaba.trim(), token: wToken.trim() })
        setWToken('')
        await load()
      }
      const res = await whatsappCloud.verify()
      setWResult({ status: 'ok', msg: `Conexión correcta · ${res.verifiedName || 'número'}${res.displayPhone ? ` (${res.displayPhone})` : ''}` })
    } catch (e) {
      setWResult({ status: 'error', msg: e.message })
    }
    setWVerifying(false)
  }

  async function saveGlovo() {
    setGSaving(true)
    try {
      const res = await orgCredentials.saveGlovo({ client_id: gClientId.trim(), kid: gKid.trim(), company_id: gCompany.trim(), city_codes: gCities.trim(), environment: gEnv, private_key: gKey.trim() })
      setGKey('')
      await load()
      if (res?.configured) toast({ type: 'success', title: 'Credenciales de Glovo guardadas' })
      else toast({ type: 'warning', title: 'Faltan datos', message: 'Rellena Client ID, Company ID, ciudades y la clave privada RSA.' })
    } catch (e) {
      toast({ type: 'error', title: 'No se pudo guardar', message: e.message })
    }
    setGSaving(false)
  }
  async function verifyGlovo() {
    setGVerifying(true)
    setGResult({ status: 'idle' })
    try {
      if (gClientId.trim() || gKey.trim() || gCompany.trim() || gCities.trim()) {
        await orgCredentials.saveGlovo({ client_id: gClientId.trim(), kid: gKid.trim(), company_id: gCompany.trim(), city_codes: gCities.trim(), environment: gEnv, private_key: gKey.trim() })
        setGKey('')
        await load()
      }
      const res = await createGlovoClient({ environment: gEnv }).getPing()
      setGResult({ status: 'ok', msg: `Conexión correcta · ${res.riders ?? 0} riders visibles` })
    } catch (e) {
      setGResult({ status: 'error', msg: e.message })
    }
    setGVerifying(false)
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
      <section className="rounded-xl border border-line bg-panel shadow-soft">
        <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Plug className="h-4.5 w-4.5" />
            </span>
            <h3 className="text-[15px] font-semibold text-fg">Uber Vehicle Solutions</h3>
          </div>
          <p className="text-xs text-muted">Datos de tu flota de riders (OAuth client credentials).</p>
          <div className="flex items-center gap-2">
            <span className={clsx('rounded-full border px-2 py-0.5 text-[11px] font-medium', uEnv === 'production' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-line bg-inset text-muted')}>
              {uEnv === 'production' ? 'Producción' : 'Sandbox'}
            </span>
            <StatusPill configured={Boolean(integ?.uber_configured)} />
          </div>
        </div>
        <div className="border-t border-line px-4 py-4 sm:px-5 sm:py-5">
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
            <div className="mt-4 flex gap-2">
              <button onClick={saveUber} disabled={uSaving} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
                {uSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
              </button>
              <button onClick={verifyUber} disabled={uVerifying} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2.5 text-sm font-medium text-fg transition hover:bg-inset disabled:opacity-50">
                {uVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verificar
              </button>
            </div>
          )}
          <VerifyResult result={uResult} />
        </div>
      </section>

      {/* Glovo (Live Operations API) */}
      <section className="rounded-xl border border-line bg-panel shadow-soft">
        <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Bike className="h-4.5 w-4.5" />
            </span>
            <h3 className="text-[15px] font-semibold text-fg">Glovo</h3>
          </div>
          <p className="text-xs text-muted">Flota de riders en vivo con GPS real (Live Operations API).</p>
          <div className="flex items-center gap-2">
            <span className={clsx('rounded-full border px-2 py-0.5 text-[11px] font-medium', gEnv === 'production' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-line bg-inset text-muted')}>
              {gEnv === 'production' ? 'Producción' : 'Staging'}
            </span>
            <StatusPill configured={Boolean(integ?.glovo_configured)} />
          </div>
        </div>
        <div className="border-t border-line px-4 py-4 sm:px-5 sm:py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SettingsField label="Client ID" value={gClientId} onChange={setGClientId} disabled={ro} mono placeholder="client_id (del fichero 101)" />
            <SettingsField label="Key ID (kid)" value={gKid} onChange={setGKid} disabled={ro} mono placeholder="kid de tu clave pública" />
            <SettingsField label="Company ID (DH)" value={gCompany} onChange={setGCompany} disabled={ro} mono placeholder="tu glovo fleet company id" />
            <SettingsField label="Ciudades" value={gCities} onChange={setGCities} disabled={ro} mono placeholder="BCN:12,MAD:7 (code:cityId)" />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Entorno</label>
              <select value={gEnv} onChange={(e) => setGEnv(e.target.value)} disabled={ro} className="w-full rounded-lg border border-line bg-inset px-3 py-2.5 text-sm text-fg outline-none focus:border-accent/60 disabled:opacity-60">
                <option value="staging">Staging</option>
                <option value="production">Producción</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-muted">Clave privada RSA (PEM PKCS8)</label>
            <textarea
              value={gKey}
              onChange={(e) => setGKey(e.target.value)}
              disabled={ro}
              rows={4}
              autoComplete="off"
              placeholder={integ?.glovo_last4 ? `•••• ${integ.glovo_last4} (sin cambios)` : '-----BEGIN PRIVATE KEY-----\n…'}
              className="w-full resize-y rounded-lg border border-line bg-inset px-3 py-2.5 font-mono text-xs text-fg outline-none focus:border-accent/60 disabled:opacity-60"
            />
          </div>
          {!ro && (
            <div className="mt-4 flex gap-2">
              <button onClick={saveGlovo} disabled={gSaving} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
                {gSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
              </button>
              <button onClick={verifyGlovo} disabled={gVerifying} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2.5 text-sm font-medium text-fg transition hover:bg-inset disabled:opacity-50">
                {gVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verificar
              </button>
            </div>
          )}
          <VerifyResult result={gResult} />
          <p className="mt-3 text-xs text-faint">
            Onboarding de Glovo: genera un par de claves <span className="font-mono">RSA</span> (2048+ bits), envía la
            <strong> clave pública</strong> + tus ciudades a Glovo y te devuelven el <span className="font-mono">client_id</span> y el
            <span className="font-mono"> kid</span>. La clave privada se guarda cifrada en el servidor y nunca se muestra.
          </p>
        </div>
      </section>

      {/* Mensatek */}
      <section className="rounded-xl border border-line bg-panel shadow-soft">
        <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <MessageSquareText className="h-4.5 w-4.5" />
            </span>
            <h3 className="text-[15px] font-semibold text-fg">Mensatek</h3>
          </div>
          <p className="text-xs text-muted">SMS y Email certificado (API v7, Basic Auth).</p>
          <StatusPill configured={Boolean(integ?.mensatek_configured)} />
        </div>
        <div className="border-t border-line px-4 py-4 sm:px-5 sm:py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SettingsField label="Usuario API" value={mUser} onChange={setMUser} disabled={ro} mono placeholder="Usuario API de Mensatek" />
            <SettingsField label="API Token" type="password" value={mToken} onChange={setMToken} disabled={ro} mono placeholder={integ?.mensatek_last4 ? `•••• ${integ.mensatek_last4} (sin cambios)` : 'Token de la API'} autoComplete="off" />
          </div>
          {!ro && (
            <div className="mt-4 flex gap-2">
              <button onClick={saveMensatek} disabled={mSaving} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
                {mSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
              </button>
              <button onClick={verifyMensatek} disabled={mVerifying} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2.5 text-sm font-medium text-fg transition hover:bg-inset disabled:opacity-50">
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
        </div>
      </section>

      {/* WhatsApp Business API (Meta Cloud API) */}
      <section className="rounded-xl border border-line bg-panel shadow-soft">
        <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Cloud className="h-4.5 w-4.5" />
            </span>
            <h3 className="text-[15px] font-semibold text-fg">WhatsApp Business API</h3>
          </div>
          <p className="text-xs text-muted">Envío oficial vía Meta Cloud API (funciona en producción).</p>
          <StatusPill configured={Boolean(integ?.whatsapp_configured)} />
        </div>
        <div className="border-t border-line px-4 py-4 sm:px-5 sm:py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SettingsField label="Phone Number ID" value={wPhone} onChange={setWPhone} disabled={ro} mono placeholder="Ej. 123456789012345" />
            <SettingsField label="Business Account ID (WABA)" value={wWaba} onChange={setWWaba} disabled={ro} mono placeholder="Ej. 987654321098765 (para plantillas)" />
            <SettingsField
              label="Token permanente"
              type="password"
              value={wToken}
              onChange={setWToken}
              disabled={ro}
              mono
              placeholder={integ?.whatsapp_last4 ? `•••• ${integ.whatsapp_last4} (sin cambios)` : 'EAAG… (token de System User)'}
              autoComplete="off"
            />
          </div>
          {!ro && (
            <div className="mt-4 flex gap-2">
              <button onClick={saveWhatsApp} disabled={wSaving} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
                {wSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
              </button>
              <button onClick={verifyWhatsApp} disabled={wVerifying} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2.5 text-sm font-medium text-fg transition hover:bg-inset disabled:opacity-50">
                {wVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verificar
              </button>
            </div>
          )}
          <VerifyResult result={wResult} />
          <p className="mt-3 text-xs text-faint">
            Genera estas claves en <em>Meta Business → WhatsApp → Configuración de la API</em>. El token permanente
            se crea con un <em>System User</em> con permiso <span className="font-mono">whatsapp_business_messaging</span>.
            El botón por rider (<span className="font-mono">wa.me</span>) seguirá funcionando gratis sin esto.
          </p>
        </div>
      </section>
    </div>
  )
}
