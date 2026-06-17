import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrg } from '../../state/OrgContext'

const KEY_BASE = 'ul-shift-planner'

// Clave de almacenamiento por organización (cada empresa tiene su propio planificador).
function storageKey(orgId) {
  return orgId ? `${KEY_BASE}:${orgId}` : KEY_BASE
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `s_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`
}

function makeShift(plataforma) {
  return { id: newId(), plataforma, dia: 'lunes', horaInicio: '09:00', horaFin: '17:00', notas: '' }
}

// Sanea cualquier dato previo del almacenamiento a la forma esperada del turno.
function normalize(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((s) => s && (s.plataforma === 'uber' || s.plataforma === 'glovo'))
    .map((s) => ({
      id: s.id || newId(),
      plataforma: s.plataforma,
      dia: s.dia || 'lunes',
      horaInicio: s.horaInicio || '09:00',
      horaFin: s.horaFin || '17:00',
      notas: typeof s.notas === 'string' ? s.notas : '',
    }))
}

// Estado + persistencia (localStorage por organización) del planificador de turnos.
// Estructura de cada turno: { id, plataforma, dia, horaInicio, horaFin, notas }.
export function useShiftPlanner() {
  const { currentOrgId: orgId } = useOrg()
  const key = storageKey(orgId)
  const [shifts, setShifts] = useState([])
  // hydratedKey es estado (no ref) para que el efecto de guardado capture el valor
  // previo al cambio de org y nunca escriba los turnos de una org en la clave de otra.
  const [hydratedKey, setHydratedKey] = useState(null)

  // Carga al montar y cada vez que cambia la organización.
  useEffect(() => {
    try {
      setShifts(normalize(JSON.parse(localStorage.getItem(key) || '[]')))
    } catch {
      setShifts([])
    }
    setHydratedKey(key)
  }, [key])

  // Persiste solo cuando los turnos cargados corresponden a la clave actual.
  useEffect(() => {
    if (hydratedKey !== key) return
    try {
      localStorage.setItem(key, JSON.stringify(shifts))
    } catch {
      /* almacenamiento lleno o no disponible: se ignora */
    }
  }, [shifts, hydratedKey, key])

  const addShift = useCallback((plataforma) => {
    const shift = makeShift(plataforma)
    setShifts((prev) => [...prev, shift])
    return shift.id
  }, [])

  const updateShift = useCallback((id, patch) => {
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }, [])

  const removeShift = useCallback((id) => {
    setShifts((prev) => prev.filter((s) => s.id !== id))
  }, [])

  // Mueve un turno arriba/abajo intercambiándolo con su vecino de la MISMA plataforma.
  const moveShift = useCallback((id, dir) => {
    setShifts((prev) => {
      const idx = prev.findIndex((s) => s.id === id)
      if (idx < 0) return prev
      const step = dir === 'up' ? -1 : 1
      let j = idx + step
      while (j >= 0 && j < prev.length && prev[j].plataforma !== prev[idx].plataforma) j += step
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }, [])

  const byPlatform = useMemo(() => {
    const out = { uber: [], glovo: [] }
    for (const s of shifts) if (out[s.plataforma]) out[s.plataforma].push(s)
    return out
  }, [shifts])

  return { shifts, byPlatform, ready: hydratedKey === key, addShift, updateShift, removeShift, moveShift }
}
