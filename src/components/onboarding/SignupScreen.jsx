import { useState } from 'react'
import { Eye, EyeOff, Loader2, UserPlus, TriangleAlert } from 'lucide-react'
import { useAuth } from '../../state/AuthContext'
import AuthShell from './AuthShell'

export default function SignupScreen({ onLogin, onCheckEmail }) {
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (password !== confirm) return setError('Las contraseñas no coinciden.')
    setBusy(true)
    const { data, error: err } = await signUp(email, password)
    setBusy(false)
    if (err) {
      setError(err.message === 'User already registered' ? 'Ya existe una cuenta con ese email.' : err.message)
      return
    }
    // Si Supabase devuelve sesión (confirmación desactivada), el gate continúa solo.
    // Si no, hay que confirmar el email.
    if (!data?.session) onCheckEmail(email.trim())
  }

  return (
    <AuthShell subtitle="Crea tu empresa y empieza gratis">
      <div className="rounded-2xl border border-line bg-panel/95 p-7 shadow-2xl shadow-black/10 ring-1 ring-accent/10 backdrop-blur sm:p-8">
        <div className="mb-6 text-center">
          <h2 className="text-lg font-semibold text-fg">Crear cuenta</h2>
          <p className="mt-1.5 text-sm text-muted">14 días de prueba · sin tarjeta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted">Email de trabajo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@empresa.com"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-line bg-inset px-3.5 py-3 text-sm text-fg placeholder-faint outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted">Contraseña</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                required
                className="w-full rounded-lg border border-line bg-inset py-3 pl-3.5 pr-10 text-sm text-fg placeholder-faint outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-faint transition hover:text-fg" aria-label={showPw ? 'Ocultar' : 'Mostrar'}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted">Repite la contraseña</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              className="w-full rounded-lg border border-line bg-inset px-3.5 py-3 text-sm text-fg placeholder-faint outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {error && (
            <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-3 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando…</> : <><UserPlus className="h-4 w-4" /> Crear cuenta</>}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          ¿Ya tienes cuenta?{' '}
          <button onClick={onLogin} className="font-semibold text-accent transition hover:brightness-110">Inicia sesión</button>
        </p>
      </div>
    </AuthShell>
  )
}
