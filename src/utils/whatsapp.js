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

export const TEMPLATE_VARS = ['nombre', 'pedido_id', 'store']

// Rellena {nombre} {pedido_id} {store} con datos del rider.
export function buildMessage(template, rider) {
  if (!template) return ''
  const vars = {
    nombre: rider?.name ?? '',
    pedido_id: rider?.currentDelivery?.id ?? '—',
    store: rider?.zone?.label ?? '—',
  }
  return template.replace(/\{(\w+)\}/g, (m, key) => (key in vars ? vars[key] : m))
}
