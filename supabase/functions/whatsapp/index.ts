// Edge Function (Deno): WhatsApp Business API oficial (Meta Cloud API) — MULTI-TENANT
// + gating de plan. Resuelve la org del llamante, carga sus credenciales (token en
// org_secrets, phone_number_id/business_account_id en org_integrations) y llama a
// graph.facebook.com en su nombre. El token NUNCA llega al navegador.
//
// A diferencia de whatsapp-web.js (QR, requiere un Chromium persistente que NO encaja
// en serverless), la Cloud API es HTTP sin estado: funciona perfectamente en este
// despliegue (Supabase Edge Functions) y es la API soportada por WhatsApp para envío.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}
const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Versión de la Graph API. v21.0 es estable a fecha de hoy.
const GRAPH = Deno.env.get('WHATSAPP_GRAPH_BASE') ?? 'https://graph.facebook.com/v21.0'

// Fallback de plataforma (opcional): si una empresa no tiene credenciales propias y se
// definen estos secrets, se usan. Por defecto vacíos -> cada empresa pone las suyas.
const envCfg = {
  token: Deno.env.get('WHATSAPP_TOKEN') ?? '',
  phoneNumberId: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '',
  businessAccountId: Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID') ?? '',
}

type Creds = { token: string; phoneNumberId: string; businessAccountId: string }

// E.164 sin '+', espacios ni símbolos (lo que espera la Cloud API en "to").
function toPhone(s: unknown) {
  return String(s ?? '').replace(/\D/g, '')
}

// Traduce los errores de la Graph API a mensajes claros en español.
function graphError(status: number, data: any) {
  const e = data?.error ?? {}
  const code = Number(e.code)
  const map: Record<number, string> = {
    190: 'El token de acceso de Meta no es válido o ha caducado. Genera un token permanente nuevo en Meta Business.',
    100: 'Parámetro inválido. Revisa el Phone Number ID y el Business Account ID.',
    131047: 'No se puede enviar texto libre fuera de la ventana de 24 h. Para mensajes proactivos usa una plantilla aprobada.',
    131051: 'Tipo de mensaje no soportado.',
    131026: 'Mensaje no entregable (el destinatario puede no tener WhatsApp o el número es incorrecto).',
    131030: 'El destinatario no está en la lista de permitidos del número de pruebas. Añádelo en Meta o pasa el número a producción.',
    132000: 'El número de variables enviadas no coincide con las de la plantilla.',
    132001: 'La plantilla no existe o no está aprobada para ese idioma.',
    132005: 'Falta la traducción de la plantilla para ese idioma.',
    132007: 'La plantilla incumple la política de formato de WhatsApp.',
    132015: 'La plantilla está pausada por baja calidad.',
    132016: 'La plantilla está deshabilitada.',
    133010: 'El número de teléfono no está registrado en WhatsApp Cloud API.',
    133016: 'El número está bloqueado temporalmente. Inténtalo más tarde.',
    368: 'La cuenta de WhatsApp está bloqueada temporalmente por políticas de Meta.',
    80007: 'Has superado el límite de mensajes (rate limit) de tu número.',
    4: 'Has superado el límite de peticiones a la API. Inténtalo en unos minutos.',
  }
  const msg = (code && map[code]) || e?.error_data?.details || e?.message || `Meta respondió ${status}.`
  const err: any = new Error(msg)
  err.status = status === 401 || code === 190 ? 401 : status >= 500 ? 502 : status === 429 || code === 4 || code === 80007 ? 429 : 400
  err.kind = code === 190 || status === 401 ? 'auth' : 'graph'
  err.code = code || null
  return err
}

async function graph(creds: Creds, method: string, path: string, body?: unknown) {
  let r: Response
  try {
    r = await fetch(`${GRAPH}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (_e) {
    const err: any = new Error('No se pudo contactar con la API de WhatsApp (Meta).')
    err.status = 502
    err.kind = 'network'
    throw err
  }
  const text = await r.text()
  let data: any
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = {}
  }
  if (!r.ok || data?.error) throw graphError(r.status, data)
  return data
}

// Verifica el número leyendo su ficha (también confirma que el token es válido).
async function verify(creds: Creds) {
  const fields = 'verified_name,display_phone_number,quality_rating,code_verification_status,platform_type'
  const data = await graph(creds, 'GET', `${creds.phoneNumberId}?fields=${fields}`)
  return {
    verifiedName: data.verified_name ?? '',
    displayPhone: data.display_phone_number ?? '',
    qualityRating: data.quality_rating ?? null,
    codeVerificationStatus: data.code_verification_status ?? null,
    platformType: data.platform_type ?? null,
  }
}

function bodyText(components: any[]) {
  return (components || []).find((c) => c?.type === 'BODY')?.text || ''
}
// Nº de variables {{n}} en el cuerpo de una plantilla.
function bodyVarCount(components: any[]) {
  const matches = String(bodyText(components)).match(/\{\{(\d+)\}\}/g) || []
  let max = 0
  for (const m of matches) {
    const n = Number(m.replace(/\D/g, ''))
    if (n > max) max = n
  }
  return max
}

// Lista las plantillas de mensaje de la WABA (para elegir una aprobada en la UI).
async function listTemplates(creds: Creds) {
  if (!creds.businessAccountId) {
    const err: any = new Error('Falta el Business Account ID (WABA) para listar plantillas.')
    err.status = 400
    err.kind = 'config'
    throw err
  }
  const fields = 'name,status,language,category,components'
  const data = await graph(creds, 'GET', `${creds.businessAccountId}/message_templates?fields=${fields}&limit=200`)
  const templates = (data.data || []).map((t: any) => ({
    name: t.name,
    status: t.status,
    language: t.language,
    category: t.category,
    bodyText: bodyText(t.components),
    bodyVars: bodyVarCount(t.components),
  }))
  return { templates }
}

// Envía un mensaje (plantilla aprobada o texto libre dentro de la ventana de 24 h).
async function sendMessage(creds: Creds, p: any) {
  const to = toPhone(p.to)
  if (!to) {
    const e: any = new Error('Falta el teléfono del destinatario.')
    e.status = 400
    e.kind = 'bad_request'
    throw e
  }
  const payload: any = { messaging_product: 'whatsapp', recipient_type: 'individual', to }

  if (p.type === 'template') {
    const name = String(p.template?.name ?? '').trim()
    if (!name) {
      const e: any = new Error('Falta el nombre de la plantilla.')
      e.status = 400
      e.kind = 'bad_request'
      throw e
    }
    const params = Array.isArray(p.template?.params) ? p.template.params : []
    const components = params.length
      ? [{ type: 'body', parameters: params.map((v: any) => ({ type: 'text', text: String(v ?? '') })) }]
      : []
    payload.type = 'template'
    payload.template = {
      name,
      language: { code: String(p.template?.language || 'es') },
      ...(components.length ? { components } : {}),
    }
  } else {
    const text = String(p.text ?? '').trim()
    if (!text) {
      const e: any = new Error('El mensaje está vacío.')
      e.status = 400
      e.kind = 'bad_request'
      throw e
    }
    payload.type = 'text'
    payload.text = { preview_url: false, body: text }
  }

  const data = await graph(creds, 'POST', `${creds.phoneNumberId}/messages`, payload)
  return {
    ok: true,
    wamid: data?.messages?.[0]?.id ?? null,
    waId: data?.contacts?.[0]?.wa_id ?? to,
    raw: data,
  }
}

async function resolveOrgCreds(userClient: any, adminClient: any, requestedOrgId: string) {
  let orgId = requestedOrgId
  if (orgId) {
    const { data } = await userClient.from('org_members').select('org_id').eq('org_id', orgId).maybeSingle()
    if (!data) {
      const err: any = new Error('No perteneces a esta organización.')
      err.status = 403
      err.kind = 'forbidden'
      throw err
    }
  } else {
    const { data } = await userClient
      .from('org_members')
      .select('org_id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    orgId = data?.org_id || ''
  }
  let integ: any = null
  let secrets: any = null
  if (orgId) {
    const [{ data: i }, { data: s }] = await Promise.all([
      adminClient
        .from('org_integrations')
        .select('whatsapp_phone_number_id, whatsapp_business_account_id')
        .eq('org_id', orgId)
        .maybeSingle(),
      adminClient.from('org_secrets').select('whatsapp_token').eq('org_id', orgId).maybeSingle(),
    ])
    integ = i
    secrets = s
  }
  const creds: Creds = {
    token: secrets?.whatsapp_token || envCfg.token,
    phoneNumberId: integ?.whatsapp_phone_number_id || envCfg.phoneNumberId,
    businessAccountId: integ?.whatsapp_business_account_id || envCfg.businessAccountId,
  }
  return { orgId, creds }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json(401, { error: 'unauthorized', message: 'Sesión no válida.' })

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/whatsapp/, '') || '/'
  const requestedOrgId = req.headers.get('x-org-id') || ''

  let payload: any = {}
  if (req.method === 'POST') {
    try {
      payload = await req.json()
    } catch {
      payload = {}
    }
  }

  try {
    const { orgId, creds } = await resolveOrgCreds(userClient, adminClient, requestedOrgId || payload?.org_id || '')
    const configured = Boolean(creds.token && creds.phoneNumberId)

    if (path === '/health' || path === '/') {
      return json(200, {
        orgId,
        configured,
        hasToken: Boolean(creds.token),
        hasPhone: Boolean(creds.phoneNumberId),
        hasWaba: Boolean(creds.businessAccountId),
      })
    }

    if (!configured) {
      return json(503, {
        error: 'not_configured',
        message: 'Esta organización no tiene configurada la WhatsApp Business API (token + Phone Number ID).',
      })
    }

    if (path === '/verify') {
      const info = await verify(creds)
      // Persiste el nombre verificado y el teléfono para mostrarlos en la UI.
      await adminClient
        .from('org_integrations')
        .update({
          whatsapp_verified_name: info.verifiedName,
          whatsapp_display_phone: info.displayPhone,
          whatsapp_status: 'connected',
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)
      return json(200, { ok: true, ...info })
    }

    if (path === '/templates') {
      return json(200, await listTemplates(creds))
    }

    if (path === '/send') {
      // Gating: suscripción activa + descuento de 1 crédito por mensaje (reembolso si falla).
      const { data: sub } = await adminClient.from('subscriptions').select('status').eq('org_id', orgId).maybeSingle()
      if (!sub || !['active', 'trialing'].includes(sub.status)) {
        return json(402, { error: 'subscription_inactive', message: 'La suscripción de tu empresa no está activa.' })
      }
      const { data: okC, error: cErr } = await adminClient.rpc('consume_credits', {
        p_org: orgId,
        p_amount: 1,
        p_channel: 'whatsapp',
        p_ref: payload?.riderId ? String(payload.riderId) : null,
      })
      // Si la RPC falla, NO enviamos (evita cursar mensajes sin descontar crédito).
      if (cErr) return json(500, { error: 'credit_error', message: 'No se pudieron verificar los créditos del plan.' })
      if (okC !== true) return json(402, { error: 'insufficient_credits', message: 'Créditos insuficientes para este envío.' })

      try {
        const res = await sendMessage(creds, payload)
        return json(200, res)
      } catch (e: any) {
        // Reembolsa el crédito si el envío no llegó a cursarse.
        await adminClient.rpc('grant_credits', {
          p_org: orgId,
          p_amount: 1,
          p_bucket: 'included',
          p_reason: 'refund',
          p_channel: 'whatsapp',
          p_ref: payload?.riderId ? String(payload.riderId) : null,
        })
        throw e
      }
    }

    return json(404, { error: 'not_found', message: `Ruta no soportada: ${path}` })
  } catch (e: any) {
    return json(e.status || 500, { error: e.kind || 'proxy_error', message: e.message, code: e.code ?? null })
  }
})
