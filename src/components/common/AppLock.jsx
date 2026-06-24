import { useEffect, useRef, useState } from 'react'
import { Fingerprint, Lock, Loader2 } from 'lucide-react'
import { isNative } from '../../native/platform'
import { pushBackHandler } from '../../native/backStack'
import { isBiometricLockEnabled, verifyBiometric } from '../../native/biometric'
import Logo from './Logo'

// Bloqueo biométrico: si el usuario lo activó en Ajustes, la app pide Face ID/huella
// al arrancar en frío y al volver desde segundo plano. Overlay por encima de todo.
// No-op total en web.
export default function AppLock() {
  const [locked, setLocked] = useState(false)
  const [verifying, setVerifying] = useState(false)
  // Cooldown: el prompt biométrico (AuthActivity) dispara appStateChange al cerrarse.
  // Sin cooldown, el listener re-bloquea inmediatamente → bucle infinito.
  const unlockTimestamp = useRef(0)

  async function lockIfEnabled() {
    // Ignorar eventos de reactivación dentro de 2s del último desbloqueo
    if (Date.now() - unlockTimestamp.current < 2000) return
    if (await isBiometricLockEnabled()) setLocked(true)
  }

  async function unlock() {
    if (verifying) return
    setVerifying(true)
    const ok = await verifyBiometric('Desbloquea Sapiens Telco Live')
    setVerifying(false)
    if (ok) {
      unlockTimestamp.current = Date.now()
      setLocked(false)
    }
  }

  // Bloqueo en arranque en frío.
  useEffect(() => {
    if (!isNative) return
    lockIfEnabled()
  }, [])

  // Re-bloqueo al volver de segundo plano.
  useEffect(() => {
    if (!isNative) return undefined
    let listener
    ;(async () => {
      try {
        const { App } = await import('@capacitor/app')
        listener = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) lockIfEnabled()
        })
      } catch {
        /* ignore */
      }
    })()
    return () => {
      try {
        listener?.remove?.()
      } catch {
        /* ignore */
      }
    }
  }, [])

  // Mientras está bloqueado, el botón atrás no debe saltarse el lock.
  useEffect(() => {
    if (!locked) return undefined
    return pushBackHandler(() => true)
  }, [locked])

  // Pide biometría automáticamente al aparecer el lock (mejor UX que un botón).
  useEffect(() => {
    if (locked && !verifying) unlock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked])

  if (!locked) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-app px-6 pt-safe pb-safe">
      <Logo className="h-16 w-auto" />
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Lock className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted">App bloqueada por seguridad</p>
      </div>
      <button
        onClick={unlock}
        disabled={verifying}
        className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition active:opacity-90 disabled:opacity-60"
      >
        {verifying ? <Loader2 className="h-5 w-5 animate-spin" /> : <Fingerprint className="h-5 w-5" />}
        {verifying ? 'Verificando…' : 'Desbloquear'}
      </button>
    </div>
  )
}
