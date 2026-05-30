// Edge Function (Deno): receptor de reports de Mensatek (entrega/estado en tiempo real).
// Mensatek hace POST aquí cada vez que cambia el estado de un SMS/Email certificado.
// Actualiza la fila correspondiente de mensatek_sent_log (por id_mensaje) con el estado.
//
// verify_jwt = false: Mensatek NO envía JWT de Supabase. Para que Mensatek pueda
// "verificar" la URL primero, GET/HEAD siempre responde 200. Los POST se procesan con
// service_role. Se puede endurecer con una clave compartida (?key=) si se define el
// secret MENSATEK_WEBHOOK_KEY.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const WEBHOOK_KEY = Deno.env.get('MENSATEK_WEBHOOK_KEY') ?? ''

// Mapea el código de Resultado de Mensatek a una etiqueta legible.
function statusLabel(servicio: string, code: number): string {
  const isEmail = /EMAIL/i.test(servicio || '')
  if (isEmail) {
    const m: Record<number, string> = {
      10: 'abierto', 11: 'entregado', 12: 'leído', 13: 'leído y descargado',
      14: 'respondido', 15: 'abierto', 16: 'aceptado', 17: 'rechazado',
      18: 'expirado', 19: 'expirado', 50: 'no entregable', 51: 'dominio inexistente',
      52: 'dirección incorrecta', 53: 'expirado', 54: 'buzón lleno', 55: 'no existe',
      56: 'spam', 57: 'duplicado', 58: 'baja', 1000: 'enviado', 1001: 'programado', 1002: 'enviando',
    }
    if (code >= 101 && code <= 120) return 'click'
    return m[code] || `estado ${code}`
  }
  const m: Record<number, string> = {
    0: 'esperando', 2: 'esperando', 10: 'esperando', 11: 'entregado', 13: 'entregado',
    14: 'entregado y certificado', 15: 'esperando respuesta', 16: 'certificando',
    17: 'contrato certificado', 50: 'teléfono no existe', 51: 'falló la entrega',
    53: 'expirado', 54: 'lista negra', 55: 'bloqueado', 70: 'entregado',
    160: 'contrato abierto', 161: 'contrato leído', 162: 'contrato aceptado', 163: 'contrato firmado',
    180: 'contrato aceptado', 181: 'contrato firmado (biométrica)', 190: 'contrato rechazado',
    195: 'contrato expirado', 200: 'rechazado por operadora', 1000: 'enviado', 1001: 'programado', 1002: 'enviando',
  }
  return m[code] || `estado ${code}`
}

function ok(body = 'OK') {
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/plain' } })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // Verificación de la URL por Mensatek (y health checks): responder 200 siempre.
  if (req.method === 'GET' || req.method === 'HEAD') {
    return ok('mensatek-webhook ready')
  }
  if (req.method !== 'POST') return ok()

  // Clave compartida opcional (si está configurada).
  if (WEBHOOK_KEY) {
    const key = url.searchParams.get('key') || req.headers.get('x-webhook-key') || ''
    if (key !== WEBHOOK_KEY) return new Response('forbidden', { status: 403 })
  }

  // Lee el cuerpo en cualquier formato que envíe Mensatek (JSON o form-urlencoded).
  let p: Record<string, any> = {}
  try {
    const ct = req.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      p = await req.json()
    } else {
      const form = await req.formData()
      for (const [k, v] of form.entries()) p[k] = v
    }
  } catch {
    // Si no se puede parsear, igualmente devolvemos 200 para no provocar reintentos infinitos.
    return ok()
  }

  const idMensaje = String(p.idMensaje ?? p.IdMensaje ?? p.Idmensaje ?? p.Msgid ?? '').trim()
  const resultado = Number(p.Resultado ?? p.resultado ?? p.Estado ?? NaN)
  const servicio = String(p.Servicio ?? p.servicio ?? '')
  const target = String(p.Movil ?? p.Destinatario ?? p.movil ?? p.destinatario ?? '').trim()
  const csv = String(p.CSV ?? p.csv ?? '').trim()

  if (!idMensaje || Number.isNaN(resultado)) return ok() // nada que actualizar

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const status = statusLabel(servicio, resultado)

  // Actualiza la(s) fila(s) del log con ese id_mensaje (afinando por destinatario si viene).
  let q = admin.from('mensatek_sent_log').update({ status }).eq('id_mensaje', idMensaje)
  if (target) {
    // El target guardado puede tener formato distinto; intentamos coincidencia por sufijo.
    const digits = target.replace(/\D/g, '')
    if (servicio && /EMAIL/i.test(servicio)) q = q.ilike('target', `%${target}%`)
    else if (digits) q = q.ilike('target', `%${digits.slice(-9)}%`)
  }
  await q

  // Guarda el CSV (código de verificación del certificado) si llega y hay una sola fila.
  if (csv) {
    await admin.from('mensatek_sent_log').update({ csv }).eq('id_mensaje', idMensaje).is('csv', null)
  }

  return ok()
})
