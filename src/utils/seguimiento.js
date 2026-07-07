// Generación del "Excel Seguimiento" (Historial de Cumplimiento).
// Parte pura (datos + reglas de RESULTADO/RESUMEN, testeable) + generación XLSX con
// colores vía exceljs (import diferido para no cargar la librería hasta que se usa).
// Especificación tomada del Word "MODIFICACIONES FLEET UBER".

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10

// Minutos -> "H:MM".
export function hMM(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0))
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h}:${String(mm).padStart(2, '0')}`
}

// Horas (float) -> "H:MM".
export function hoursToHMM(hours) {
  return hMM(Math.round((Number(hours) || 0) * 60))
}

const DIAS_ABBR = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

// 'YYYY-MM-DD' -> "SÁB 04/07".
export function dayLabel(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const wd = new Date(y, m - 1, d).getDay()
  return `${DIAS_ABBR[wd]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

// Acept% del día (accept / (accept+reject)). null si no hubo pedidos asignados.
export function acceptPct(row) {
  const assigned = (row.accept || 0) + (row.reject || 0)
  if (assigned <= 0) return null
  return Math.round(((row.accept || 0) / assigned) * 100)
}

// RESULTADO de un día según la fila diaria del motor de cumplimiento.
// Devuelve { text, tone } con tone ∈ cumple|exceso|deficit|libre|ausente|justif|none.
export function resultado(row) {
  if (!row) return { text: '', tone: 'none' }
  const plannedH = (row.plannedMin || 0) / 60
  const onlineH = row.onlineHours || 0
  if (!row.scheduled) {
    // Sin turno planificado: solo destacamos si trabajó (día libre).
    return row.attended ? { text: 'DÍA LIBRE', tone: 'libre' } : { text: '', tone: 'none' }
  }
  if (row.absenceTipo || row.status === 'justificado') {
    return { text: 'JUSTIF.', tone: 'justif' }
  }
  if (row.status === 'ausente' || (!row.attended && onlineH <= 0)) {
    return { text: 'AUSENTE', tone: 'ausente' }
  }
  const diff = round1(onlineH - plannedH)
  if (Math.abs(diff) <= 0.1) return { text: 'CUMPLE', tone: 'cumple' }
  if (diff > 0) return { text: `+${round1(diff)}h EXCESO`, tone: 'exceso' }
  return { text: `${round1(diff)}h DÉFICIT`, tone: 'deficit' }
}

// Teléfono legible del rider (rider_key = dígitos del teléfono).
function phoneOf(riderKey, meta) {
  if (meta?.phone) return meta.phone
  const d = String(riderKey || '').replace(/\D/g, '')
  return d || ''
}

// Construye el dataset del seguimiento: una fila por rider, columnas por día + resumen.
// daily: filas del motor (buildDaily). rosterByKey: Map riderKey -> {name, phone, city}.
// opts: { dates: string[] (ISO, ordenadas), cities: string[]|null (null = todas) }.
export function buildSeguimiento(daily, rosterByKey, { dates, cities } = {}) {
  const dateSet = new Set(dates || [])
  const cityset = cities && cities.length ? new Set(cities) : null

  // Agrupa por rider las filas dentro de las fechas (y ciudades) elegidas.
  const byRider = new Map()
  for (const r of daily || []) {
    if (dateSet.size && !dateSet.has(r.date)) continue
    if (cityset && !cityset.has(r.city)) continue
    if (!byRider.has(r.riderKey)) byRider.set(r.riderKey, { key: r.riderKey, name: r.name, city: r.city, days: new Map() })
    const e = byRider.get(r.riderKey)
    if (r.city && !e.city) e.city = r.city
    e.days.set(r.date, r)
  }

  const orderedDates = [...(dates || [])].sort()
  const riders = [...byRider.values()].map((rd) => {
    const meta = rosterByKey?.get?.(rd.key) || {}
    const days = orderedDates.map((date) => {
      const row = rd.days.get(date) || null
      return { date, row, res: resultado(row), acept: row ? acceptPct(row) : null, trips: row?.trips || 0 }
    })
    // Resumen semana (solo días con turno planificado cuentan para plan/OK/INC).
    let planMin = 0
    let onlineH = 0
    let diasOk = 0
    let diasIncHoras = 0
    let diasAusente = 0
    let cancel = 0
    let trips = 0
    const aceptVals = []
    const obs = []
    for (const d of days) {
      const r = d.row
      if (!r) continue
      cancel += r.cancel || 0
      trips += r.trips || 0
      const ap = acceptPct(r)
      if (ap != null) aceptVals.push(ap)
      if (r.scheduled) {
        planMin += r.plannedMin || 0
        onlineH += r.onlineHours || 0
      } else if (r.onlineHours) {
        onlineH += r.onlineHours || 0
      }
      const tone = d.res.tone
      if (tone === 'cumple') diasOk += 1
      else if (tone === 'exceso' || tone === 'deficit') diasIncHoras += 1
      else if (tone === 'ausente') diasAusente += 1
      // Observaciones por día.
      const lbl = dayLabel(d.date).split(' ')[0]
      if (tone === 'ausente') obs.push(`${lbl}: AUSENTE`)
      else if (tone === 'exceso' || tone === 'deficit') obs.push(`${lbl}: ${d.res.text}`)
      if ((r.cancel || 0) > 0) obs.push(`${lbl}: ${r.cancel} cancel.`)
      if (ap != null && ap < 100) obs.push(`${lbl}: acept ${ap}%`)
    }
    const planH = planMin / 60
    const dif = round1(onlineH - planH)
    const mediaAcept = aceptVals.length ? Math.round(aceptVals.reduce((a, b) => a + b, 0) / aceptVals.length) : null
    return {
      key: rd.key,
      name: rd.name || rd.key,
      city: rd.city || meta.city || '',
      phone: phoneOf(rd.key, meta),
      days,
      summary: {
        planHMM: hoursToHMM(planH),
        onlineHMM: hoursToHMM(onlineH),
        dif,
        diasOk,
        diasInc: diasIncHoras + diasAusente,
        diasIncTone: diasAusente > 0 ? 'ausente' : diasIncHoras > 0 ? 'exceso' : 'none',
        mediaAcept,
        cancel,
        trips,
        observaciones: obs.join('; '),
      },
    }
  })
  riders.sort((a, b) => a.name.localeCompare(b.name))
  return { dates: orderedDates, riders }
}

// Paleta de rellenos (ARGB) por tono + texto legible (tinte claro Tailwind + texto oscuro).
const FILL = {
  cumple: { fill: 'FFDCFCE7', font: 'FF166534' },
  exceso: { fill: 'FFFEF3C7', font: 'FF92400E' },
  deficit: { fill: 'FFFEF3C7', font: 'FF92400E' },
  ausente: { fill: 'FFFEE2E2', font: 'FF991B1B' },
  libre: { fill: 'FFEDE9FE', font: 'FF5B21B6' },
  justif: { fill: 'FFE0F2FE', font: 'FF075985' },
  azul: { fill: 'FFDBEAFE', font: 'FF1E40AF' },
  rojo: { fill: 'FFFEE2E2', font: 'FF991B1B' },
  naranja: { fill: 'FFFEF3C7', font: 'FF92400E' },
}

function setFill(cell, tone) {
  const c = FILL[tone]
  if (!c) return
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.fill } }
  cell.font = { ...(cell.font || {}), color: { argb: c.font } }
}

// Genera y descarga el .xlsx con formato/colores. data = salida de buildSeguimiento.
export async function generateSeguimientoXlsx(data, filename = 'seguimiento.xlsx') {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Seguimiento', { views: [{ state: 'frozen', xSplit: 3, ySplit: 2 }] })

  const DAY_SUB = ['PLAN (H:MM)', 'ONLINE (H:MM)', 'RESULTADO', 'ACEPT%', 'VIAJES']
  const SUM_SUB = ['∑ PLAN (H:MM)', '∑ ONLINE (H:MM)', 'DIF (h)', 'DÍAS OK', 'DÍAS INC', 'MEDIA ACEPT%', 'CANCEL TOTAL', '∑ VIAJES', 'OBSERVACIONES', 'NOTAS (uso interno)']
  const nDays = data.dates.length
  const totalCols = 3 + nDays * DAY_SUB.length + SUM_SUB.length

  // Fila 1 (grupos) y fila 2 (sub-cabeceras).
  const row1 = ws.getRow(1)
  const row2 = ws.getRow(2)
  const headBase = ['RIDER', 'CIUDAD', 'TELÉFONO']
  headBase.forEach((h, i) => {
    ws.mergeCells(1, i + 1, 2, i + 1)
    row1.getCell(i + 1).value = h
  })
  let col = 4
  for (const date of data.dates) {
    ws.mergeCells(1, col, 1, col + DAY_SUB.length - 1)
    row1.getCell(col).value = dayLabel(date)
    DAY_SUB.forEach((s, j) => { row2.getCell(col + j).value = s })
    col += DAY_SUB.length
  }
  ws.mergeCells(1, col, 1, col + SUM_SUB.length - 1)
  row1.getCell(col).value = 'RESUMEN SEMANA'
  SUM_SUB.forEach((s, j) => { row2.getCell(col + j).value = s })

  // Estilo cabeceras.
  for (let c = 1; c <= totalCols; c += 1) {
    for (const rr of [row1, row2]) {
      const cell = rr.getCell(c)
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = { top: { style: 'thin', color: { argb: 'FFCBD5E1' } }, bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, left: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } }
    }
  }

  // Filas de datos.
  let rIdx = 3
  for (const rider of data.riders) {
    const row = ws.getRow(rIdx)
    row.getCell(1).value = rider.name
    row.getCell(2).value = rider.city
    row.getCell(3).value = rider.phone
    let c = 4
    for (const d of rider.days) {
      row.getCell(c).value = d.row && d.row.scheduled ? hMM(d.row.plannedMin) : (d.row && d.row.plannedMin ? hMM(d.row.plannedMin) : '')
      row.getCell(c + 1).value = d.row ? hoursToHMM(d.row.onlineHours) : ''
      const resCell = row.getCell(c + 2)
      resCell.value = d.res.text
      setFill(resCell, d.res.tone)
      row.getCell(c + 3).value = d.acept != null ? `${d.acept}%` : ''
      const acCell = row.getCell(c + 3)
      if (d.acept != null && d.acept < 100) setFill(acCell, 'rojo')
      row.getCell(c + 4).value = d.trips || ''
      c += DAY_SUB.length
    }
    const s = rider.summary
    row.getCell(c).value = s.planHMM
    row.getCell(c + 1).value = s.onlineHMM
    row.getCell(c + 2).value = s.dif
    const okCell = row.getCell(c + 3)
    okCell.value = s.diasOk
    if (s.diasOk > 0) setFill(okCell, 'cumple')
    const incCell = row.getCell(c + 4)
    incCell.value = s.diasInc
    if (s.diasInc > 0) setFill(incCell, s.diasIncTone === 'ausente' ? 'rojo' : 'naranja')
    const maCell = row.getCell(c + 5)
    maCell.value = s.mediaAcept != null ? `${s.mediaAcept}%` : ''
    if (s.mediaAcept != null && s.mediaAcept < 100) setFill(maCell, 'rojo')
    const cancelCell = row.getCell(c + 6)
    cancelCell.value = s.cancel || 0
    if (s.cancel > 0) setFill(cancelCell, 'naranja')
    const viajesCell = row.getCell(c + 7)
    viajesCell.value = s.trips || 0
    if (s.trips >= 1) setFill(viajesCell, 'azul')
    const obsCell = row.getCell(c + 8)
    obsCell.value = s.observaciones
    if (s.observaciones) setFill(obsCell, 'rojo')
    // NOTAS (c+9) queda vacío.

    for (let cc = 1; cc <= totalCols; cc += 1) {
      const cell = row.getCell(cc)
      cell.alignment = { vertical: 'middle', horizontal: cc <= 2 ? 'left' : 'center', wrapText: cc >= totalCols - 1 }
      if (!cell.border) cell.border = { top: { style: 'hair', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } }, left: { style: 'hair', color: { argb: 'FFE5E7EB' } }, right: { style: 'hair', color: { argb: 'FFE5E7EB' } } }
    }
    rIdx += 1
  }

  // Anchos de columna.
  ws.getColumn(1).width = 26
  ws.getColumn(2).width = 12
  ws.getColumn(3).width = 13
  for (let c = 4; c < 4 + nDays * DAY_SUB.length; c += 1) {
    const sub = (c - 4) % DAY_SUB.length
    ws.getColumn(c).width = sub === 2 ? 14 : 10 // RESULTADO más ancho
  }
  const sumStart = 4 + nDays * DAY_SUB.length
  SUM_SUB.forEach((_, j) => { ws.getColumn(sumStart + j).width = j === 8 ? 34 : j === 9 ? 22 : 12 })
  row1.height = 20
  row2.height = 28

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
