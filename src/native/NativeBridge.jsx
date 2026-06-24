import { useEffect } from 'react'
import { useTheme } from '../state/ThemeContext'
import { isNative } from './platform'
import { initNativeShell, syncStatusBar } from './index'

// Inicializa el shell nativo una sola vez y mantiene la barra de estado sincronizada
// con el tema. No renderiza nada; no-op en web.
export default function NativeBridge() {
  const { resolved } = useTheme()

  useEffect(() => {
    if (!isNative) return undefined

    let cleanup = () => {}

    // Siempre intentar ocultar el splash al montar, como red de seguridad.
    // Si launchAutoHide ya lo ocultó, esto es un no-op.
    import('@capacitor/splash-screen')
      .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 200 }))
      .catch(() => {})

    initNativeShell().then((c) => {
      cleanup = c
    })

    return () => cleanup()
  }, [])

  useEffect(() => {
    if (!isNative) return
    syncStatusBar(resolved)
  }, [resolved])

  return null
}
