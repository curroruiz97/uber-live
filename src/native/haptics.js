import { isNative } from './platform'

// Haptics: feedback táctil en acciones clave. No-op silencioso en web o si el
// plugin no está. Carga perezosa para no pesar en el arranque web.
let _haptics = null
async function mod() {
  if (!isNative) return null
  if (!_haptics) {
    try {
      _haptics = await import('@capacitor/haptics')
    } catch {
      _haptics = { Haptics: null, ImpactStyle: {} }
    }
  }
  return _haptics
}

export async function impactLight() {
  const m = await mod()
  try {
    await m?.Haptics?.impact({ style: m.ImpactStyle.Light })
  } catch {
    /* ignore */
  }
}

export async function impactMedium() {
  const m = await mod()
  try {
    await m?.Haptics?.impact({ style: m.ImpactStyle.Medium })
  } catch {
    /* ignore */
  }
}

export async function selection() {
  const m = await mod()
  try {
    await m?.Haptics?.selectionStart()
    await m?.Haptics?.selectionEnd()
  } catch {
    /* ignore */
  }
}

export async function notifyWarning() {
  const m = await mod()
  try {
    await m?.Haptics?.notification({ type: m.NotificationType?.Warning ?? 'WARNING' })
  } catch {
    /* ignore */
  }
}

export async function success() {
  const m = await mod()
  try {
    await m?.Haptics?.notification({ type: m.NotificationType?.Success ?? 'SUCCESS' })
  } catch {
    /* ignore */
  }
}

export async function error() {
  const m = await mod()
  try {
    await m?.Haptics?.notification({ type: m.NotificationType?.Error ?? 'ERROR' })
  } catch {
    /* ignore */
  }
}
