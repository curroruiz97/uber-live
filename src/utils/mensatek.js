// Helpers de Mensatek (formato de teléfono, plantillas con variables, validaciones).

// Mensatek espera el móvil como dígitos con prefijo de país, sin '+', espacios ni
// símbolos (ej. 34600000000). Si el número no trae prefijo y parece español
// (9 dígitos empezando por 6/7), se le antepone 34.
export function toMensatekPhone(phone) {
  let d = String(phone || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.length === 9 && /^[67]/.test(d)) d = `34${d}`
  return d
}

// Canales disponibles.
export const CHANNELS = {
  sms: { id: 'sms', label: 'SMS Certificado', tipocontrato: 0 },
  sms_contrato: { id: 'sms_contrato', label: 'SMS Contrato', tipocontrato: 1 },
  email: { id: 'email', label: 'Email Certificado', tipocontrato: 0 },
}

// Variables de plantilla (igual filosofía que WhatsApp): {nombre} {pedido_id} {store}
// {matricula} {email} {telefono}. Se rellenan en cliente antes de enviar.
export const TEMPLATE_VARS = ['nombre', 'pedido_id', 'store', 'matricula', 'email', 'telefono']

export function buildMessage(template, rider) {
  if (!template) return ''
  const vars = {
    nombre: rider?.name ?? '',
    pedido_id: rider?.currentDelivery?.id ?? '—',
    store: rider?.zone?.label ?? '—',
    matricula: rider?.licensePlate ?? '—',
    email: rider?.email ?? '—',
    telefono: rider?.phone ?? '—',
  }
  return template.replace(/\{(\w+)\}/g, (m, key) => (key in vars ? vars[key] : m))
}

// Remitente alfanumérico de SMS: máximo 11 caracteres (límite de Mensatek/GSM).
export function clampSenderSms(s) {
  return String(s || '').slice(0, 11)
}

export function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim())
}

// ¿Está la configuración del emisor completa para poder enviar por SMS?
// (Mensatek exige Contacto, Telcontacto y Cifcontacto en los certificados.)
export function smsIssuerReady(cfg) {
  return Boolean(cfg?.contacto && cfg?.telcontacto && cfg?.cifcontacto)
}

// Descripciones de los estados de entrega que devuelve Mensatek (reports).
export const SMS_STATUS_TXT = {
  0: 'Esperando entrega',
  2: 'Esperando entrega',
  10: 'Esperando entrega',
  13: 'Entregado al teléfono',
  14: 'Entregado y certificado',
  15: 'Esperando respuesta (contrato)',
  16: 'Respuesta recibida · certificando',
  17: 'Contrato certificado',
  50: 'El teléfono no existe',
  51: 'Falló la entrega',
  54: 'En lista negra',
  200: 'Rechazado por la operadora',
}
export const EMAIL_STATUS_TXT = {
  10: 'Apertura registrada',
  11: 'Entregado',
  12: 'Leído',
  13: 'Entregado, leído y descargado',
  14: 'Respondido',
  15: 'Abierto',
  16: 'Aceptado',
  17: 'Rechazado',
  50: 'No entregable',
  51: 'Dominio inexistente',
  55: 'La dirección no existe',
  56: 'Marcado como spam',
  1000: 'Enviado',
  1001: 'Programado',
}
