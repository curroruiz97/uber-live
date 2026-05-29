import { useState } from 'react'
import { MailCheck, Loader2, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../state/AuthContext'
import AuthShell from './AuthShell'

export default function CheckEmailNotice({ email, onBack }) {
  const { resend } = useAuth()
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleResend() {
    setBusy(true)
    await resend(email)
    setBusy(false)
    setSent(true)
  }

  return (
    <AuthShell subtitle={null}>
      <div className="rounded-2xl border border-line bg-panel/95 p-7 text-center shadow-2xl shadow-black/10 ring-1 ring-accent/10 backdrop-blur sm:p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
          <MailCheck className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-fg">Revisa tu correo</h2>
        <p className="mt-2 text-sm text-muted">
          Te hemos enviado un enlace de confirmación a{' '}
          <span className="font-medium text-fg">{email}</span>. Ábrelo para activar tu cuenta y luego inicia sesión.
        </p>

        <button
          onClick={handleResend}
          disabled={busy || sent}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2.5 text-sm font-medium text-fg transition hover:bg-inset disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {sent ? 'Correo reenviado ✓' : 'Reenviar correo'}
        </button>

        <button onClick={onBack} className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-fg">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al inicio de sesión
        </button>
      </div>
    </AuthShell>
  )
}
