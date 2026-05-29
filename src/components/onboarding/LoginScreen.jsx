import { useState } from 'react'
import { Eye, EyeOff, Loader2, LogIn, TriangleAlert } from 'lucide-react'
import { useAuth } from '../../state/AuthContext'
import ThemeToggle from '../common/ThemeToggle'
import Logo from '../common/Logo'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await signIn(email, password)
    setBusy(false)
    if (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos.'
          : err.message,
      )
    }
    // En éxito, onAuthStateChange actualiza la sesión y el gate muestra la app.
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgb(var(--c-accent) / 0.16), transparent 70%), radial-gradient(40% 40% at 80% 100%, rgb(14 165 233 / 0.10), transparent 70%)',
        }}
      />
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="mb-8">
          <Logo className="h-10 w-auto" />
          <p className="mt-2 text-xs text-faint">Centro de control de flota</p>
        </div>

        <div className="rounded-2xl border border-line bg-panel p-6 shadow-soft">
          <h2 className="text-base font-semibold text-fg">Acceso del equipo</h2>
          <p className="mt-1 text-sm text-muted">Inicia sesión con tu cuenta para continuar.</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                autoComplete="email"
                required
                className="w-full rounded-lg border border-line bg-inset px-3 py-2.5 text-sm text-fg placeholder-faint outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Contraseña</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-lg border border-line bg-inset py-2.5 pl-3 pr-10 text-sm text-fg placeholder-faint outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-faint transition hover:text-fg"
                  aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Entrando…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" /> Entrar
                </>
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-faint">
            ¿Sin cuenta? Pídele acceso al administrador del equipo.
          </p>
        </div>
      </div>
    </div>
  )
}
