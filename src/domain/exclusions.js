// Filtro de riders dados de baja (rider_exclusions). Puro y testeable, sin red.
// La baja oculta al rider en TODAS las vistas de cumplimiento sin borrar histórico:
// se aplica quitando sus filas de shift_plans y rider_daily_stats ANTES de calcular.
// Cruce por doble clave: rider_key (teléfono) o name_norm (nombre normalizado),
// porque el listado de bajas suele venir solo con nombres.
import { matchKey } from '../utils/identityMatch'

// Construye los conjuntos de cruce a partir de las exclusiones activas.
// exclusions: [{ name_norm, rider_key, active }]. Devuelve { keys:Set, names:Set }.
export function buildExclusionSets(exclusions) {
  const keys = new Set()
  const names = new Set()
  for (const e of exclusions || []) {
    if (e && e.active === false) continue
    if (e && e.rider_key) keys.add(String(e.rider_key))
    if (e && e.name_norm) names.add(String(e.name_norm))
  }
  return { keys, names }
}

// ¿Está este rider (por teléfono o nombre) dado de baja?
export function isRiderExcluded(riderKey, name, sets) {
  if (!sets) return false
  if (riderKey && sets.keys.has(String(riderKey))) return true
  const n = matchKey(name)
  return n ? sets.names.has(n) : false
}

// Atajo: ¿los conjuntos están vacíos? (para evitar recorrer arrays sin necesidad).
function empty(sets) {
  return !sets || (sets.keys.size === 0 && sets.names.size === 0)
}

// Quita de shift_plans los turnos de riders dados de baja (nombre en `rider_name`).
export function filterExcludedShiftPlans(shiftPlans, sets) {
  if (empty(sets)) return shiftPlans || []
  return (shiftPlans || []).filter((s) => !isRiderExcluded(s.rider_key, s.rider_name, sets))
}

// Quita de rider_daily_stats la actividad de riders dados de baja (nombre en `driver_name`).
export function filterExcludedStats(rawStats, sets) {
  if (empty(sets)) return rawStats || []
  return (rawStats || []).filter((s) => !isRiderExcluded(s.rider_key, s.driver_name, sets))
}

// Quita del roster (identidades) a los riders dados de baja (clave camelCase `riderKey`).
export function filterExcludedRoster(roster, sets) {
  if (empty(sets)) return roster || []
  return (roster || []).filter((r) => !isRiderExcluded(r.riderKey, r.name, sets))
}
