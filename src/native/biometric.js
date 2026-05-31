import { isNative } from './platform'

// Bloqueo biométrico (Face ID / huella) al reabrir la app. Envuelve el plugin
// @aparajita/capacitor-biometric-auth con carga perezosa y degradación limpia: en
// web siempre devuelve "no disponible" y verify() resuelve a true (no bloquea).

const PREF_KEY = 'ul-biometric-lock' // '1' = activado por el usuario

let _plugin = null
async function plugin() {
  if (!isNative) return null
  if (!_plugin) {
    try {
      const m = await import('@aparajita/capacitor-biometric-auth')
      _plugin = m.BiometricAuth
    } catch {
      _plugin = null
    }
  }
  return _plugin
}

// ¿El dispositivo tiene biometría utilizable (enrolada)?
export async function isBiometricAvailable() {
  const p = await plugin()
  if (!p) return false
  try {
    const info = await p.checkBiometry()
    return Boolean(info?.isAvailable)
  } catch {
    return false
  }
}

// Lanza la verificación nativa. Devuelve true si el usuario se autenticó.
export async function verifyBiometric(reason = 'Desbloquea Sapiens Telco Live') {
  const p = await plugin()
  if (!p) return true // sin plugin (web): no bloqueamos
  try {
    await p.authenticate({
      reason,
      cancelTitle: 'Cancelar',
      allowDeviceCredential: true,
      iosFallbackTitle: 'Usar código',
      androidTitle: 'Verifica tu identidad',
      androidSubtitle: 'Sapiens Telco Live',
    })
    return true
  } catch {
    return false
  }
}

// Preferencia persistida (usa @capacitor/preferences en nativo; localStorage en web).
export async function isBiometricLockEnabled() {
  try {
    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences')
      const { value } = await Preferences.get({ key: PREF_KEY })
      return value === '1'
    }
    return localStorage.getItem(PREF_KEY) === '1'
  } catch {
    return false
  }
}

export async function setBiometricLockEnabled(enabled) {
  const v = enabled ? '1' : '0'
  try {
    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences')
      await Preferences.set({ key: PREF_KEY, value: v })
    } else {
      localStorage.setItem(PREF_KEY, v)
    }
  } catch {
    /* ignore */
  }
}
