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
