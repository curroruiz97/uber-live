import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../state/OrgContext'
import { addDaysIso } from './platforms'

// Normaliza un nombre para cruzar PDF <-> roster (sin acentos, mayúsculas, espacios simples).
function normName(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}
const digits = (s) => (s || '').replace(/\D/g, '')

// Estado + persistencia en Supabase del planificador de turnos por rider y de los estados.
// shift_plans (turnos semanales) + rider_absences (estados con duración/previsión).
export function useShiftPlanner() {
  const { currentOrgId: orgId, isOwnerOrAdmin } = useOrg()
  const [shifts, setShifts] = useState([])
  const [absences, setAbsences] = useState([])
  const [roster, setRoster] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) {
      setShifts([])
      setAbsences([])
      setRoster([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [sp, ab, ro] = await Promise.all([
        supabase.from('shift_plans').select('*').eq('org_id', orgId),
        supabase.from('rider_absences').select('*').eq('org_id', orgId),
        supabase.from('rider_roster').select('rider_key, name, phone').eq('org_id', orgId),
      ])
      setShifts(sp.data || [])
      setAbsences(ab.data || [])
      setRoster(ro.data || [])
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    load()
  }, [load])

  // Mapa nombre normalizado -> teléfono del roster de Uber (para el cruce por teléfono).
  const phoneByName = useMemo(() => {
    const m = new Map()
    for (const r of roster) if (r.phone) m.set(normName(r.name), r.phone)
    return m
  }, [roster])

  const crossPhone = useCallback((name) => phoneByName.get(normName(name)) || null, [phoneByName])

  // ---- CRUD turnos ----
  const addShift = useCallback(
    async (riderName, city, provider, patch = {}) => {
      const phone = crossPhone(riderName)
      const row = {
        org_id: orgId,
        provider: provider || 'uber',
        city: city || null,
        rider_name: riderName,
        rider_phone: phone,
        rider_key: phone ? digits(phone) : null,
        dia: patch.dia || 'lunes',
        turno: patch.turno || 'manana',
        hora_inicio: patch.hora_inicio || '09:00',
        hora_fin: patch.hora_fin || '14:00',
        notas: patch.notas || null,
        sort: patch.sort ?? 0,
      }
      const { data, error } = await supabase.from('shift_plans').insert(row).select().single()
      if (error) throw new Error(error.message)
      setShifts((prev) => [...prev, data])
      return data
    },
    [orgId, crossPhone],
  )

  // Escribe PRIMERO y confirma que persistió. Si la RLS bloquea (no owner/admin),
  // Supabase no da error pero afecta 0 filas: con .select() lo detectamos y avisamos,
  // en vez de mostrar el cambio y que "se resetee" al recargar.
  const updateShift = useCallback(async (id, patch) => {
    const { data, error } = await supabase
      .from('shift_plans')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
    if (error) throw new Error(error.message)
    if (!data || !data.length) {
      throw new Error('No se pudo guardar el turno: necesitas permisos de propietario o administrador (o el turno ya no existe).')
    }
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }, [])

  const removeShift = useCallback(async (id) => {
    const { data, error } = await supabase.from('shift_plans').delete().eq('id', id).select()
    if (error) throw new Error(error.message)
    if (!data || !data.length) {
      throw new Error('No se pudo eliminar el turno: necesitas permisos de propietario o administrador.')
    }
    setShifts((prev) => prev.filter((s) => s.id !== id))
  }, [])

  // ---- CRUD estados/ausencias ----
  const addAbsence = useCallback(
    async (riderName, city, provider, patch = {}) => {
      const phone = crossPhone(riderName)
      const row = {
        org_id: orgId,
        provider: provider || 'uber',
        city: city || null,
        rider_name: riderName,
        rider_phone: phone,
        rider_key: phone ? digits(phone) : null,
        tipo: patch.tipo || 'baja_laboral',
        fecha_inicio: patch.fecha_inicio || null,
        dias: patch.dias ?? null,
        fecha_fin: patch.fecha_fin || null,
        nota: patch.nota || null,
      }
      const { data, error } = await supabase.from('rider_absences').insert(row).select().single()
      if (error) throw new Error(error.message)
      setAbsences((prev) => [...prev, data])
      return data
    },
    [orgId, crossPhone],
  )

  // Al cambiar fecha_inicio o días recalcula fecha_fin (previsión de días no trabajables).
  // Escribe primero y confirma persistencia (misma protección RLS que los turnos).
  const updateAbsence = useCallback(async (id, patch) => {
    const base = absences.find((a) => a.id === id) || {}
    const full = { ...patch }
    if ('fecha_inicio' in patch || 'dias' in patch) {
      const fi = patch.fecha_inicio ?? base.fecha_inicio
      const di = patch.dias ?? base.dias
      full.fecha_fin = fi && di ? addDaysIso(fi, Math.max(0, Number(di) - 1)) : null
    }
    const { data, error } = await supabase.from('rider_absences').update({ ...full, updated_at: new Date().toISOString() }).eq('id', id).select()
    if (error) throw new Error(error.message)
    if (!data || !data.length) {
      throw new Error('No se pudo guardar el estado: necesitas permisos de propietario o administrador.')
    }
    setAbsences((prev) => prev.map((a) => (a.id === id ? { ...a, ...full } : a)))
  }, [absences])

  const removeAbsence = useCallback(async (id) => {
    const { data, error } = await supabase.from('rider_absences').delete().eq('id', id).select()
    if (error) throw new Error(error.message)
    if (!data || !data.length) {
      throw new Error('No se pudo eliminar el estado: necesitas permisos de propietario o administrador.')
    }
    setAbsences((prev) => prev.filter((a) => a.id !== id))
  }, [])

  // Importa el seed (datos verificados de los PDFs). Idempotente: reemplaza los turnos y
  // estados de ese proveedor. Cruza nombre -> teléfono contra el roster cuando existe.
  const importSeed = useCallback(async () => {
    if (!orgId) throw new Error('Sin organización activa')
    setBusy(true)
    try {
      const seed = (await import('../../data/horariosSeed.json')).default
      const provider = seed.provider || 'uber'
      await supabase.from('shift_plans').delete().eq('org_id', orgId).eq('provider', provider)
      await supabase.from('rider_absences').delete().eq('org_id', orgId).eq('provider', provider)

      const shiftRows = seed.shifts.map((s) => {
        const phone = crossPhone(s.rider_name)
        return { ...s, org_id: orgId, provider, rider_phone: phone, rider_key: phone ? digits(phone) : null }
      })
      const absRows = (seed.absences || []).map((a) => {
        const phone = crossPhone(a.rider_name)
        return { ...a, org_id: orgId, provider, rider_phone: phone, rider_key: phone ? digits(phone) : null }
      })
      // Inserta en lotes para no superar límites de payload.
      for (let i = 0; i < shiftRows.length; i += 500) {
        const { error } = await supabase.from('shift_plans').insert(shiftRows.slice(i, i + 500))
        if (error) throw new Error(error.message)
      }
      if (absRows.length) {
        const { error } = await supabase.from('rider_absences').insert(absRows)
        if (error) throw new Error(error.message)
      }
      await load()
      return { shifts: shiftRows.length, absences: absRows.length }
    } finally {
      setBusy(false)
    }
  }, [orgId, crossPhone, load])

  return {
    shifts,
    absences,
    roster,
    loading,
    busy,
    isOwnerOrAdmin,
    matchedPhones: roster.filter((r) => r.phone).length,
    addShift,
    updateShift,
    removeShift,
    addAbsence,
    updateAbsence,
    removeAbsence,
    importSeed,
    reload: load,
  }
}
