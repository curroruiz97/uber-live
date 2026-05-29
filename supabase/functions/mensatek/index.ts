// Edge Function (Deno): proxy de Mensatek (API v7) — MULTI-TENANT.
// Resuelve la organización del llamante (header x-org-id, validado contra org_members)
// y carga sus credenciales de Mensatek desde org_integrations/org_secrets (service_role),
// con fallback a los secrets de entorno (org Sapiens durante la transición).
// El API Token nunca llega al navegador. POST form-urlencoded con Basic Auth.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const envCfg = {
  apiUser: Deno.env.get('MENSATEK_API_USER') ?? '',
  apiToken: Deno.env.get('MENSATEK_API_TOKEN') ?? '',
  base: Deno.env.get('MENSATEK_BASE') ?? 'https://api.mensatek.com/v7',
}

type Creds = { apiUser: string; apiToken: string; base: string }

function basicAuth(creds: Creds) {
  return 'Basic ' + btoa(`${creds.apiUser}:${creds.apiToken}`)
}

function firstOf(data: any) {
  if (Array.isArray(data)) return data[0] ?? {}
  return data ?? {}
}

async function call(creds: Creds, fn: string, fields: Record<string, string>) {
  const body = new URLSearchParams({ ...fields, Resp: 'JSON' })
  let r: Response
  try {
    r = await fetch(`${creds.base}/${fn}`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(creds),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    })
  } catch (_e) {
    const err: any = new Error('No se pudo contactar con la API de Mensatek.')
    err.status = 502
    err.kind = 'network'
    throw err
  }
  const text = await r.text()
  let data: any
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  if (r.status === 401) {
    const err: any = new Error('Mensatek rechazó las credenciales (Usuario API / API Token).')
    err.status = 401
    err.kind = 'auth'
    throw err
  }
  if (!r.ok) {
    const err: any = new Error(`Mensatek respondió ${r.status}.`)
    err.status = r.status >= 500 ? 502 : r.status
    err.kind = 'http'
    throw err
  }
  return firstOf(data)
}

async function getCredits(creds: Creds) {
  const res = await call(creds, 'GetCreditos', {})
  return { ok: Number(res.Res) >= 0 || res.Cred != null, cred: Number(res.Cred) || 0, raw: res }
}

async function sendSms(creds: Creds, p: any) {
  const destinatarios = (p.destinatarios || []).map((d: any) => {
    const o: Record<string, string> = { Movil: String(d.movil || d.Movil || '') }
    for (let i = 1; i <= 10; i += 1) {
      const v = d[`variable_${i}`] ?? d[`Variable_${i}`]
      if (v != null && v !== '') o[`Variable_${i}`] = String(v)
    }
    return o
  })
  const fields: Record<string, string> = {
    Remitente: String(p.remitente ?? ''),
    Destinatarios: JSON.stringify(destinatarios),
    Mensaje: String(p.mensaje ?? ''),
    Contacto: String(p.contacto ?? ''),
    Telcontacto: String(p.telcontacto ?? ''),
    Cifcontacto: String(p.cifcontacto ?? ''),
    Tipocontrato: String(p.tipocontrato ?? 0),
    Unicode: String(p.unicode ?? 1),
  }
  if (p.fecha) fields.Fecha = String(p.fecha)
  if (p.referencia) fields.Referenciausuario = String(p.referencia)
  const res = await call(creds, 'EnviarSMSCERTIFICADO', fields)
  return shapeSend(res)
}

async function sendEmail(creds: Creds, p: any) {
  const destinatarios = (p.destinatarios || []).map((d: any) => {
    const o: Record<string, string> = {
      Nombre: String(d.nombre || d.Nombre || ''),
      Email: String(d.email || d.Email || ''),
    }
    for (let i = 1; i <= 10; i += 1) {
      const v = d[`variable_${i}`] ?? d[`Variable_${i}`]
      if (v != null && v !== '') o[`Variable_${i}`] = String(v)
    }
    return o
  })
  const fields: Record<string, string> = {
    Remitente: String(p.remitente ?? ''),
    Destinatarios: JSON.stringify(destinatarios),
    Asunto: String(p.asunto ?? ''),
    Mensaje: String(p.mensaje ?? ''),
  }
  if (p.fecha) fields.Fecha = String(p.fecha)
  if (p.referencia) fields.Referenciausuario = String(p.referencia)
  if (p.aceptacion === 'SI') {
    fields.Aceptacion = 'SI'
    fields.Caducidadaceptacion = String(p.caducidad ?? 10)
  }
  const res = await call(creds, 'EnviarEMAILCERTIFICADO', fields)
  return shapeSend(res)
}

function shapeSend(res: any) {
  const r = Number(res.Res)
  const ok = r > 0
  const errorMap: Record<number, string> = {
    [-1]: 'Error de autenticación (Usuario API / API Token).',
    [-2]: 'No hay créditos suficientes.',
    [-3]: res.Error ? `Datos incorrectos: ${res.Error}` : 'Error en los datos de la llamada.',
    [-4]: 'Fichero adjunto no permitido.',
    [-5]: 'No dispone de créditos suficientes.',
    [-15]: 'SMS Contrato: falta el PDF en el mensaje (FILE:2:archivo.pdf).',
    [-16]: 'El PDF indicado no está en la biblioteca.',
  }
  return {
    ok,
    res: r,
    error: ok ? null : errorMap[r] || res.Error || 'Error en el envío.',
    idMensaje: res.idMensaje ?? res.Msgid ?? null,
    enviados: Number(res.Enviados ?? res.Mensajes ?? 0),
    noEnviados: Number(res.NoEnviados ?? 0),
    duplicados: Number(res.Duplicados ?? 0),
    cred: res.Cred != null ? Number(res.Cred) : null,
    creditosUsados: res.CreditosUsados != null ? Number(res.CreditosUsados) : null,
    raw: res,
  }
}

async function getReport(creds: Creds, p: any) {
  const fn = p.channel === 'email' ? 'GetReportEMAILCERTIFICADO' : 'GetReportSMSCERTIFICADO'
  return await call(creds, fn, { Idmensaje: String(p.idMensaje ?? '') })
}

// Resuelve la org del llamante y carga sus credenciales (con fallback a env).
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
    const { data } = await userClient.from('org_members').select('org_id').order('created_at', { ascending: true }).limit(1).maybeSingle()
    orgId = data?.org_id || ''
  }
  let integ: any = null
  let secrets: any = null
  if (orgId) {
    const [{ data: i }, { data: s }] = await Promise.all([
      adminClient.from('org_integrations').select('mensatek_api_user').eq('org_id', orgId).maybeSingle(),
      adminClient.from('org_secrets').select('mensatek_api_token').eq('org_id', orgId).maybeSingle(),
    ])
    integ = i
    secrets = s
  }
  const creds: Creds = {
    apiUser: integ?.mensatek_api_user || envCfg.apiUser,
    apiToken: secrets?.mensatek_api_token || envCfg.apiToken,
    base: envCfg.base,
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
  const path = url.pathname.replace(/^\/mensatek/, '') || '/'
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

    if (path === '/health' || path === '/') {
      return json(200, {
        orgId,
        configured: Boolean(creds.apiUser && creds.apiToken),
        hasUser: Boolean(creds.apiUser),
        hasToken: Boolean(creds.apiToken),
      })
    }

    if (!creds.apiUser || !creds.apiToken) {
      return json(503, { error: 'not_configured', message: 'Esta organización no tiene configuradas las credenciales de Mensatek.' })
    }

    if (path === '/credits') return json(200, await getCredits(creds))

    // Envío con gating de plan: suscripción activa + consumo atómico de créditos.
    if (path === '/send-sms' || path === '/send-email') {
      const isEmail = path === '/send-email'
      const recipients = Array.isArray(payload.destinatarios) ? payload.destinatarios.length : 0
      const channel = isEmail ? 'email' : (Number(payload.tipocontrato) ? 'sms_contrato' : 'sms')

      const { data: sub } = await adminClient.from('subscriptions').select('status').eq('org_id', orgId).maybeSingle()
      if (!sub || !['active', 'trialing'].includes(sub.status)) {
        return json(402, { error: 'subscription_inactive', message: 'La suscripción de tu empresa no está activa.' })
      }
      if (recipients > 0) {
        const { data: okC } = await adminClient.rpc('consume_credits', { p_org: orgId, p_amount: recipients, p_channel: channel, p_ref: null })
        if (okC === false) return json(402, { error: 'insufficient_credits', message: 'Créditos insuficientes para este envío.' })
      }
      let res: any
      try {
        res = isEmail ? await sendEmail(creds, payload) : await sendSms(creds, payload)
      } catch (e) {
        if (recipients > 0) await adminClient.rpc('grant_credits', { p_org: orgId, p_amount: recipients, p_bucket: 'included', p_reason: 'refund', p_channel: channel, p_ref: null })
        throw e
      }
      // Reembolso de lo no entregado.
      if (!res.ok && recipients > 0) {
        await adminClient.rpc('grant_credits', { p_org: orgId, p_amount: recipients, p_bucket: 'included', p_reason: 'refund', p_channel: channel, p_ref: null })
      } else if (res.noEnviados > 0) {
        await adminClient.rpc('grant_credits', { p_org: orgId, p_amount: res.noEnviados, p_bucket: 'included', p_reason: 'refund', p_channel: channel, p_ref: null })
      }
      return json(200, res)
    }

    if (path === '/report') return json(200, await getReport(creds, payload))
    return json(404, { error: 'not_found', message: `Ruta no soportada: ${path}` })
  } catch (e: any) {
    return json(e.status || 500, { error: e.kind || 'proxy_error', message: e.message })
  }
})
