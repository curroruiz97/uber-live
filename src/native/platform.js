import { Capacitor } from '@capacitor/core'

// Capa fina sobre Capacitor. Todo el código de la app pregunta aquí en vez de
// importar Capacitor directamente, para que el comportamiento en web (donde no hay
// shell nativo) sea un no-op limpio y testeable.

export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform() // 'ios' | 'android' | 'web'
export const isIOS = platform === 'ios'
export const isAndroid = platform === 'android'

// True si el plugin nativo indicado está realmente disponible en esta plataforma.
export function hasPlugin(name) {
  return Capacitor.isPluginAvailable(name)
}
