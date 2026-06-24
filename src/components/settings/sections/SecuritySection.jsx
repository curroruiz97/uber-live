import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { ShieldCheck, Fingerprint } from 'lucide-react'
import { SettingsCard } from '../SettingsField'
import { useToast } from '../../../state/toast'
import { isNative } from '../../../native/platform'
import {
  isBiometricLockEnabled,
  setBiometricLockEnabled,
  verifyBiometric,
} from '../../../native/biometric'

function Toggle({ on, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50',
        on ? 'bg-accent' : 'bg-inset ring-1 ring-line',
      )}
      aria-pressed={on}
    >
      <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  )
}

export default function SecuritySection() {
  const { toast } = useToast()
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isNative) return
    let alive = true
    isBiometricLockEnabled().then((en) => {
      if (alive) setEnabled(en)
    })
    return () => { alive = false }
  }, [])

  async function toggle() {
    if (busy) return
    setBusy(true)
    try {
      if (!enabled) {
        const ok = await verifyBiometric('Confirma para activar el bloqueo')
        if (!ok) {
          toast({ type: 'warning', title: 'No se activó', message: 'Configura huella, Face ID o PIN en tu dispositivo.' })
          return
        }
        await setBiometricLockEnabled(true)
        setEnabled(true)
        toast({ type: 'success', title: 'Bloqueo activado', message: 'Se pedirá huella o PIN al abrir la app.' })
      } else {
        await setBiometricLockEnabled(false)
        setEnabled(false)
        toast({ type: 'success', title: 'Bloqueo desactivado' })
      }
    } catch {
      toast({ type: 'error', title: 'Error', message: 'No se pudo cambiar el bloqueo.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsCard icon={ShieldCheck} title="Seguridad" subtitle="Protege el acceso a la app en este dispositivo">
      {!isNative ? (
        <div className="flex items-start gap-3 rounded-lg border border-line bg-inset p-3">
          <Fingerprint className="mt-0.5 h-5 w-5 shrink-0 text-faint" />
          <p className="text-sm text-muted">
            El bloqueo biométrico está disponible en la app móvil (iOS / Android). Instala Sapiens Telco Live en tu
            teléfono para activarlo.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 py-1">
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">Bloqueo biométrico</p>
            <p className="text-xs text-muted">
              Pide huella, Face ID o PIN al abrir la app y al volver desde segundo plano.
            </p>
          </div>
          <Toggle on={enabled} onClick={toggle} disabled={busy} />
        </div>
      )}
    </SettingsCard>
  )
}
