// Edge Function (Deno): proxy de Mensatek (API v7 unificada).
// Envío de SMS Certificado, SMS Contrato y Email Certificado a los riders.
// Mantiene el API Token de Mensatek en los secrets de la función (nunca en el
// navegador) y añade la Autenticación Básica (UsuarioAPI:APIToken) server-side.
//
// Doc oficial: https://api.mensatek.com/v7/  (Basic Auth, POST, Resp=JSON)
//   - POST /EnviarSMSCERTIFICADO   (SMS Certificado / SMS Contrato vía Tipocontrato)
//   - POST /EnviarEMAILCERTIFICADO (Email Certificado)
//   - POST /GetCreditos            (créditos restantes)
//   - POST /GetReportSMSCERTIFICADO | /GetReportEMAILCERTIFICADO
//
// Seguridad: exige un USUARIO real de Supabase (getUser); la anon key sola no basta.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

const cfg = {
  apiUser: Deno.env.get('MENSATEK_API_USER') ?? '',
  apiToken: Deno.env.get('MENSATEK_API_TOKEN') ?? '',
  base: Deno.env.get('MENSATEK_BASE') ?? 'https://api.mensatek.com/v7',
}

function basicAuth() {
  return 'Basic ' + btoa(`${cfg.apiUser}:${cfg.apiToken}`)
}

// Mensatek responde un array JSON [{...}] en las funciones; normalizamos al objeto.
function firstOf(data: any) {
  if (Array.isArray(data)) return data[0] ?? {}
  return data ?? {}
}

// POST form-urlencoded a Mensatek con Basic Auth. Devuelve el objeto normalizado.
async function call(fn: string, fields: Record<string, string>) {
  const body = new URLSearchParams({ ...fields, Resp: 'JSON' })
  let r: Response
  try {
    r = await fetch(`${cfg.base}/${fn}`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(),
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

// --- Acciones expuestas al frontend -----------------------------------------

async function getCredits() {
  const res = await call('GetCreditos', {})
  return { ok: Number(res.Res) >= 0 || res.Cred != null, cred: Number(res.Cred) || 0, raw: res }
}

// Envío de SMS Certificado / SMS Contrato.
// destinatarios: [{ movil, variable_1?, ... }]  (movil = dígitos con prefijo, ej 34600...)
async function sendSms(p: any) {
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
  const res = await call('EnviarSMSCERTIFICADO', fields)
  return shapeSend(res)
}

// Envío de Email Certificado.
// destinatarios: [{ nombre, email, variable_1? }]
async function sendEmail(p: any) {
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
  const res = await call('EnviarEMAILCERTIFICADO', fields)
  return shapeSend(res)
}

// Normaliza la respuesta de envío a una forma común para el frontend.
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

async function getReport(p: any) {
  const fn = p.channel === 'email' ? 'GetReportEMAILCERTIFICADO' : 'GetReportSMSCERTIFICADO'
  const res = await call(fn, { Idmensaje: String(p.idMensaje ?? '') })
  return res
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Exigir usuario real de Supabase (no solo la anon key, que es pública).
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json(401, { error: 'unauthorized', message: 'Sesión no válida.' })

  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/mensatek/, '') || '/'

  // /health no necesita credenciales: informa si la función está configurada.
  if (path === '/health' || path === '/') {
    return json(200, {
      configured: Boolean(cfg.apiUser && cfg.apiToken),
      hasUser: Boolean(cfg.apiUser),
      hasToken: Boolean(cfg.apiToken),
      base: cfg.base,
    })
  }

  if (!cfg.apiUser || !cfg.apiToken) {
    return json(503, {
      error: 'not_configured',
      message: 'Faltan MENSATEK_API_USER / MENSATEK_API_TOKEN en los secrets de la función.',
    })
  }

  let payload: any = {}
  if (req.method === 'POST') {
    try {
      payload = await req.json()
    } catch {
      payload = {}
    }
  }

  try {
    if (path === '/credits') return json(200, await getCredits())
    if (path === '/send-sms') return json(200, await sendSms(payload))
    if (path === '/send-email') return json(200, await sendEmail(payload))
    if (path === '/report') return json(200, await getReport(payload))
    return json(404, { error: 'not_found', message: `Ruta no soportada: ${path}` })
  } catch (e: any) {
    return json(e.status || 500, { error: e.kind || 'proxy_error', message: e.message })
  }
})
