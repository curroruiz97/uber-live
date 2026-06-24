import { Capacitor } from '@capacitor/core'
import { isNative } from './platform'

// Bloqueo biométrico (Face ID / huella / PIN) al reabrir la app.
// Usa directamente el plugin nativo de Capacitor sin pasar por el proxy JS
// de @aparajita/capacitor-biometric-auth (que falla con code-splitting de Vite).

const PREF_KEY = 'ul-biometric-lock'

function getNativePlugin() {
  if (!isNative) return null
  if (!Capacitor.isPluginAvailable('BiometricAuthNative')) return null
  return Capacitor.Plugins.BiometricAuthNative
}

// Lanza la verificación nativa. Devuelve true si el usuario se autenticó.
export async function verifyBiometric(reason = 'Desbloquea Sapiens Telco Live') {
  const p = getNativePlugin()
  if (!p) return true
  try {
    await p.internalAuthenticate({
      reason,
      cancelTitle: 'Cancelar',
      allowDeviceCredential: true,
      iosFallbackTitle: 'Usar código',
      androidTitle: 'Verifica tu identidad',
      androidSubtitle: reason,
      androidConfirmationRequired: false,
      androidBiometryStrength: 0,
    })
    return true
  } catch {
    return false
  }
}

// Preferencia persistida.
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
