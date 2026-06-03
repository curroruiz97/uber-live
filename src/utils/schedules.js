// Helpers de horarios: normalización de teléfono (rider_key), parseo de fecha/hora
// del CSV y emparejado de filas subidas contra el roster.
import { parseCsv } from './csv'

// Clave de rider = teléfono solo dígitos (estable entre proveedores). Igual criterio
// que toWaPhone/toMensatekPhone del resto de la app.
export function riderKeyFromPhone(phone) {
  return String(phone || '').replace(/\D/g, '')
}

// "DD/MM/YYYY" -> "YYYY-MM-DD" (acepta también ISO y separador -).
export function parseDateEs(s) {
  const t = String(s || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (!m) return null
  let [, d, mo, y] = m
  if (y.length === 2) y = `20${y}`
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// "HH:MM" -> minutos desde medianoche (o null).
export function parseHm(s) {
  const m = String(s || '').trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return null
  return h * 60 + mi
}

// Construye un instante (epoch ms) a partir de fecha YYYY-MM-DD + minutos. Para la
// demo se usa hora local del navegador; en el backend real se ancla a la zona de la org.
export function instantFrom(dateIso, minutes) {
  const [y, mo, d] = dateIso.split('-').map(Number)
  const dt = new Date(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0)
  return dt.getTime()
}

// Parsea un CSV de horarios a filas normalizadas. Columnas esperadas (es):
//   telefono ; nombre ; fecha ; hora_inicio ; hora_fin
// Acepta sinónimos comunes. Devuelve { rows:[{phone,name,date,start,end,riderKey,plannedStart,plannedEnd,plannedMinutes,ok,error}], total }.
const COL = {
  phone: ['telefono', 'teléfono', 'phone', 'movil', 'móvil', 'whatsapp'],
  name: ['nombre', 'name', 'rider'],
  date: ['fecha', 'date', 'dia', 'día'],
  start: ['hora_inicio', 'inicio', 'entrada', 'start', 'hora inicio'],
  end: ['hora_fin', 'fin', 'salida', 'end', 'hora fin'],
}
function pickCol(obj, names) {
  for (const n of names) if (n in obj) return obj[n]
  return ''
}

export function parseScheduleCsv(text) {
  const { rows } = parseCsv(text)
  const out = rows.map((r) => {
    const phone = pickCol(r, COL.phone)
    const name = pickCol(r, COL.name)
    const dateRaw = pickCol(r, COL.date)
    const startRaw = pickCol(r, COL.start)
    const endRaw = pickCol(r, COL.end)

    const date = parseDateEs(dateRaw)
    const startMin = parseHm(startRaw)
    const endMin = parseHm(endRaw)
    const riderKey = riderKeyFromPhone(phone)

    let error = null
    if (!riderKey) error = 'Teléfono inválido'
    else if (!date) error = 'Fecha inválida'
    else if (startMin == null || endMin == null) error = 'Hora inválida'
    else if (endMin <= startMin) error = 'Fin antes que inicio'

    const ok = !error
    const plannedStart = ok ? instantFrom(date, startMin) : null
    const plannedEnd = ok ? instantFrom(date, endMin) : null
    const plannedMinutes = ok ? endMin - startMin : 0

    return { phone, name, date, start: startRaw, end: endRaw, riderKey, plannedStart, plannedEnd, plannedMinutes, ok, error }
  })
  return { rows: out, total: out.length }
}
