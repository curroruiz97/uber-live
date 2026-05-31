import { isNative, isAndroid, hasPlugin } from './platform'
import { runTopBackHandler } from './backStack'
import { handleAuthDeepLink } from './deepLinks'

export { isNative, isAndroid, isIOS, platform } from './platform'
export { pushBackHandler } from './backStack'

// Color de fondo de la barra de estado (Android) por tema, en hex sin alfa.
const STATUS_BG = { dark: '#0A0B0D', light: '#F7F8FA' }

let _statusBar = null
async function statusBar() {
  if (!isNative || !hasPlugin('StatusBar')) return null
  if (!_statusBar) {
    try {
      _statusBar = (await import('@capacitor/status-bar')).StatusBar
    } catch {
      _statusBar = null
    }
  }
  return _statusBar
}

// Sincroniza la barra de estado con el tema (texto claro/oscuro + fondo en Android).
export async function syncStatusBar(resolvedTheme) {
  const sb = await statusBar()
  if (!sb) return
  const isDark = resolvedTheme === 'dark'
  try {
    // Style.Dark = texto/iconos claros (para fondos oscuros); Style.Light = al revés.
    await sb.setStyle({ style: isDark ? 'DARK' : 'LIGHT' })
    if (isAndroid) await sb.setBackgroundColor({ color: STATUS_BG[isDark ? 'dark' : 'light'] })
  } catch {
    /* ignore */
  }
}

// Inicializa el shell nativo una sola vez. Idempotente. Devuelve cleanup.
let _initialized = false
export async function initNativeShell() {
  if (!isNative || _initialized) return () => {}
  _initialized = true

  document.documentElement.classList.add('native')

  const cleanups = []

  // Splash: la ocultamos cuando la web ya está montada (evita el "flash blanco").
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {
    /* ignore */
  }

  // Teclado: marca el body para que la UI pueda reaccionar (ocultar tab bar, etc.).
  try {
    if (hasPlugin('Keyboard')) {
      const { Keyboard } = await import('@capacitor/keyboard')
      cleanups.push((await Keyboard.addListener('keyboardWillShow', () => {
        document.documentElement.classList.add('kb-open')
      })).remove)
      cleanups.push((await Keyboard.addListener('keyboardWillHide', () => {
        document.documentElement.classList.remove('kb-open')
      })).remove)
    }
  } catch {
    /* ignore */
  }

  // App: botón atrás, deep links de auth.
  try {
    const { App } = await import('@capacitor/app')

    cleanups.push((await App.addListener('backButton', () => {
      // Primero las superficies efímeras (hojas, drawers, lock, palette…).
      if (runTopBackHandler()) return
      // Nada que cerrar: salir de la app.
      App.exitApp()
    })).remove)

    cleanups.push((await App.addListener('appUrlOpen', ({ url }) => {
      handleAuthDeepLink(url)
    })).remove)
  } catch {
    /* ignore */
  }

  return () => {
    for (const c of cleanups) {
      try {
        c?.()
      } catch {
        /* ignore */
      }
    }
  }
}
