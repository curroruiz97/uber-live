// Ámbito de ciudades de un usuario (rol "visor"): restringe qué riders puede ver.
// city_scope se guarda en org_members.city_scope como text[] canónico (MAYÚSCULAS,
// sin acentos ni sufijo de país). null / [] => sin restricción (ve todas las ciudades).
import { canonCity } from '../domain/compliance'

// Normaliza un ámbito (array de nombres de ciudad) a la forma canónica, sin vacíos ni duplicados.
export function normalizeScope(scope) {
  if (!Array.isArray(scope)) return null
  const set = new Set()
  for (const c of scope) {
    const k = canonCity(c)
    if (k) set.add(k)
  }
  return set.size ? [...set] : null
}

// ¿El ámbito permite ver esta ciudad? Ámbito nulo/vacío => todo permitido.
export function cityInScope(city, scope) {
  const norm = normalizeScope(scope)
  if (!norm) return true
  const c = canonCity(city)
  // Sin ciudad conocida y con ámbito activo => no se muestra (evita fugas).
  if (!c) return false
  return norm.includes(c)
}

// Devuelve un predicado (city) => boolean para el ámbito dado, o null si no hay restricción.
export function cityFilterFor(scope) {
  const norm = normalizeScope(scope)
  if (!norm) return null
  return (city) => {
    const c = canonCity(city)
    return c ? norm.includes(c) : false
  }
}
