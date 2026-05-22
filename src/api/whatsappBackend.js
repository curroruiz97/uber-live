// Cliente del backend real de WhatsApp (whatsapp-web.js), expuesto por el backend
// Express en /api/wa/*. Si el backend no responde, waStatus() degrada a "no
// conectado" y el envío masivo cae al modo simulado.
import { API_BASE, authHeaders } from '../config/api'

export async function waStatus() {
  try {
    const r = await fetch(`${API_BASE}/api/wa/status`, { headers: await authHeaders() })
    if (!r.ok) return { status: 'idle', ready: false }
    return await r.json()
  } catch {
    return { status: 'idle', ready: false }
  }
}

export async function waSend(phone, message) {
  const r = await fetch(`${API_BASE}/api/wa/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ phone, message }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok || !data.ok) throw new Error(data.message || `HTTP ${r.status}`)
  return data
}
