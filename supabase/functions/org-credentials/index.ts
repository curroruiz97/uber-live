// Edge Function (Deno): guarda las credenciales de integración POR ORGANIZACIÓN.
// El navegador no puede escribir org_secrets (RLS lo bloquea); esta función valida
// que el llamante es owner/admin de la org (x-org-id) y escribe el secreto con la
// service_role. El secreto NUNCA se devuelve; solo se guardan los últimos 4 dígitos
// (org_integrations) para mostrar un indicador en la UI.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const last4 = (s: string) => (s && s.length >= 4 ? s.slice(-4) : s ? '••' : '')

async function ensureRow(admin: any, table: string, orgId: string) {
  await admin.from(table).upsert({ org_id: orgId }, { onConflict: 'org_id', ignoreDuplicates: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json(401, { error: 'unauthorized', message: 'Sesión no válida.' })

  const orgId = req.headers.get('x-org-id') || ''
  if (!orgId) return json(400, { error: 'no_org', message: 'Falta la organización (x-org-id).' })

  // Solo owner/admin de esa org pueden guardar credenciales.
  // Filtra por el propio usuario: por RLS se ven todas las filas de la org y, con varias,
  // maybeSingle fallaría (y podría devolver el rol de otro miembro).
  const { data: mem } = await userClient.from('org_members').select('role').eq('org_id', orgId).eq('user_id', user.id).maybeSingle()
  if (!mem || !['owner', 'admin'].includes(mem.role)) {
    return json(403, { error: 'forbidden', message: 'Solo el propietario o un administrador pueden cambiar las credenciales.' })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/org-credentials/, '') || '/'
  const now = new Date().toISOString()

  try {
    if (path === '/uber') {
      const clientId = String(body.client_id ?? '').trim()
      const clientSecret = String(body.client_secret ?? '').trim()
      const scope = String(body.scope ?? '').trim()
      const environment = body.environment === 'production' ? 'production' : 'sandbox'

      await ensureRow(admin, 'org_secrets', orgId)
      await ensureRow(admin, 'org_integrations', orgId)

      // El secreto solo se actualiza si llega uno nuevo (no se borra al editar lo demás).
      const integ: any = {
        uber_client_id: clientId,
        uber_scope: scope,
        uber_environment: environment,
        updated_at: now,
      }
      if (clientSecret) {
        await admin.from('org_secrets').update({ uber_client_secret: clientSecret, updated_at: now }).eq('org_id', orgId)
        integ.uber_last4 = last4(clientSecret)
      }
      // configured = hay client_id y (hay secreto nuevo o ya había uno guardado)
      const { data: sec } = await admin.from('org_secrets').select('uber_client_secret').eq('org_id', orgId).maybeSingle()
      integ.uber_configured = Boolean(clientId && sec?.uber_client_secret)
      await admin.from('org_integrations').update(integ).eq('org_id', orgId)
      return json(200, { ok: true, configured: integ.uber_configured })
    }

    if (path === '/mensatek') {
      const apiUser = String(body.api_user ?? '').trim()
      const apiToken = String(body.api_token ?? '').trim()

      await ensureRow(admin, 'org_secrets', orgId)
      await ensureRow(admin, 'org_integrations', orgId)

      const integ: any = { mensatek_api_user: apiUser, updated_at: now }
      if (apiToken) {
        await admin.from('org_secrets').update({ mensatek_api_token: apiToken, updated_at: now }).eq('org_id', orgId)
        integ.mensatek_last4 = last4(apiToken)
      }
      const { data: sec } = await admin.from('org_secrets').select('mensatek_api_token').eq('org_id', orgId).maybeSingle()
      integ.mensatek_configured = Boolean(apiUser && sec?.mensatek_api_token)
      await admin.from('org_integrations').update(integ).eq('org_id', orgId)
      return json(200, { ok: true, configured: integ.mensatek_configured })
    }

    if (path === '/whatsapp') {
      // WhatsApp Business API (Meta Cloud API). El token permanente es el secreto;
      // phone_number_id y business_account_id son config no secreta.
      const phoneNumberId = String(body.phone_number_id ?? '').trim()
      const businessAccountId = String(body.business_account_id ?? '').trim()
      const token = String(body.token ?? '').trim()

      await ensureRow(admin, 'org_secrets', orgId)
      await ensureRow(admin, 'org_integrations', orgId)

      const integ: any = {
        whatsapp_phone_number_id: phoneNumberId,
        whatsapp_business_account_id: businessAccountId,
        updated_at: now,
      }
      if (token) {
        await admin.from('org_secrets').update({ whatsapp_token: token, updated_at: now }).eq('org_id', orgId)
        integ.whatsapp_last4 = last4(token)
      }
      const { data: sec } = await admin.from('org_secrets').select('whatsapp_token').eq('org_id', orgId).maybeSingle()
      integ.whatsapp_configured = Boolean(phoneNumberId && sec?.whatsapp_token)
      integ.whatsapp_status = integ.whatsapp_configured ? 'configured' : 'idle'
      await admin.from('org_integrations').update(integ).eq('org_id', orgId)
      return json(200, { ok: true, configured: integ.whatsapp_configured })
    }

    if (path === '/glovo') {
      // Glovo Live Ops. La clave privada RSA es el secreto; client_id, kid, company id,
      // city codes y entorno son config no secreta.
      const clientId = String(body.client_id ?? '').trim()
      const kid = String(body.kid ?? '').trim()
      const companyId = String(body.company_id ?? '').trim()
      const cityCodes = String(body.city_codes ?? '').trim()
      const environment = body.environment === 'production' ? 'production' : 'staging'
      const privateKey = String(body.private_key ?? '').trim()

      await ensureRow(admin, 'org_secrets', orgId)
      await ensureRow(admin, 'org_integrations', orgId)

      const integ: any = {
        glovo_client_id: clientId,
        glovo_kid: kid,
        glovo_company_id: companyId,
        glovo_city_codes: cityCodes,
        glovo_environment: environment,
        updated_at: now,
      }
      if (privateKey) {
        await admin.from('org_secrets').update({ glovo_private_key: privateKey, updated_at: now }).eq('org_id', orgId)
        integ.glovo_last4 = last4(privateKey)
      }
      const { data: sec } = await admin.from('org_secrets').select('glovo_private_key').eq('org_id', orgId).maybeSingle()
      integ.glovo_configured = Boolean(clientId && companyId && cityCodes && sec?.glovo_private_key)
      await admin.from('org_integrations').update(integ).eq('org_id', orgId)
      return json(200, { ok: true, configured: integ.glovo_configured })
    }

    return json(404, { error: 'not_found', message: `Ruta no soportada: ${path}` })
  } catch (e: any) {
    return json(500, { error: 'save_error', message: e.message })
  }
})
