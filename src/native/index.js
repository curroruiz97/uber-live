import { isNative, isAndroid, hasPlugin } from './platform'
import { runTopBackHandler } from './backStack'
import { handleAuthDeepLink } from './deepLinks'

export { isNative, isAndroid, isIOS, platform } from './platform'
export { pushBackHandler } from './backStack'

let _statusBar = null
let _sbPromise = null
// Carga el plugin StatusBar en la variable _statusBar. IMPORTANTE: la función async
// NO devuelve el objeto-plugin. Si lo devolviera, `await` intentaría adoptarlo como
// "thenable" (los plugins de Capacitor exponen un .then que lanza) y provocaría el error
// "StatusBar.then() is not implemented on android" (no capturado en WebView antiguo).
function ensureStatusBar() {
  if (!_sbPromise) {
    _sbPromise = (async () => {
      if (!isNative || !hasPlugin('StatusBar')) return
      try {
        _statusBar = (await import('@capacitor/status-bar')).StatusBar
      } catch {
        _statusBar = null
      }
    })()
  }
  return _sbPromise
}

// Sincroniza la barra de estado con el tema (texto claro/oscuro). El fondo siempre
// es transparente (edge-to-edge); el color real lo pone el CSS del Topbar con pt-safe.
export async function syncStatusBar(resolvedTheme) {
  await ensureStatusBar()
  if (!_statusBar) return
  const isDark = resolvedTheme === 'dark'
  try {
    await _statusBar.setStyle({ style: isDark ? 'DARK' : 'LIGHT' })
    // No llamar setOverlaysWebView ni setBackgroundColor en Android:
    // el edge-to-edge se gestiona nativamente en MainActivity.java y
    // los flags deprecated del plugin StatusBar lo rompen.
  } catch {
    /* ignore */
  }
}

// Inicializa el shell nativo. Idempotente. Devuelve cleanup.
let _initialized = false
export async function initNativeShell() {
  if (!isNative || _initialized) return () => {}
  _initialized = true

  document.documentElement.classList.add('native')

  const cleanups = []

  // StatusBar: solo sincronizar estilo (DARK/LIGHT) al arrancar.
  // El edge-to-edge se gestiona nativamente en MainActivity.java.
  try {
    await ensureStatusBar()
    if (_statusBar) {
      await _statusBar.setStyle({ style: 'DARK' })
    }
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
      if (runTopBackHandler()) return
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
