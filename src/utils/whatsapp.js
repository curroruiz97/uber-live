// Helpers de WhatsApp (enlace wa.me + plantillas con variables).

// wa.me requiere dígitos con prefijo de país, sin '+', espacios ni símbolos.
export function toWaPhone(phone) {
  return String(phone || '').replace(/\D/g, '')
}

export function waLink(phone, message) {
  const p = toWaPhone(phone)
  const text = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${p}${text}`
}

export const TEMPLATE_VARS = ['nombre', 'pedido_id', 'store', 'turno_inicio', 'turno_fin']

// Rellena {nombre} {pedido_id} {store} {turno_inicio} {turno_fin} con datos del rider.
// turno_inicio/turno_fin no existen en la API actual -> '—'.
export function buildMessage(template, rider) {
  if (!template) return ''
  const vars = {
    nombre: rider?.name ?? '',
    pedido_id: rider?.currentDelivery?.id ?? '—',
    store: rider?.zone?.label ?? '—',
    turno_inicio: rider?.shiftStart ?? '—',
    turno_fin: rider?.shiftEnd ?? '—',
  }
  return template.replace(/\{(\w+)\}/g, (m, key) => (key in vars ? vars[key] : m))
}
