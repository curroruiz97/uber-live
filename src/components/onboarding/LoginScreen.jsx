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
      {/* Halos de fondo con el naranja Sapiens */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(55% 45% at 50% 0%, rgb(var(--c-accent) / 0.20), transparent 70%), radial-gradient(45% 45% at 85% 100%, rgb(var(--c-accent) / 0.12), transparent 72%)',
        }}
      />
      {/* Patrón de puntos sutil para profundidad */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            'radial-gradient(rgb(var(--c-fg)) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo + tagline centrados */}
        <div className="mb-10 flex flex-col items-center text-center">
          <Logo className="h-[100px] w-auto" />
          <p className="mt-4 text-sm text-muted">Centro de control de flota</p>
        </div>

        {/* Card de acceso */}
        <div className="rounded-2xl border border-line bg-panel/95 p-7 shadow-2xl shadow-black/10 ring-1 ring-accent/10 backdrop-blur sm:p-8">
          <div className="mb-6 text-center">
            <h2 className="text-lg font-semibold text-fg">Acceso del equipo</h2>
            <p className="mt-1.5 text-sm text-muted">Inicia sesión con tu cuenta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                Email
              </label>
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
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-lg border border-line bg-inset py-3 pl-3.5 pr-10 text-sm text-fg placeholder-faint outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
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
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-3 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition hover:shadow-accent/40 hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
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

          <p className="mt-6 text-center text-xs text-faint">
            ¿Sin cuenta? Pídele acceso al administrador del equipo.
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] text-faint">
          © {new Date().getFullYear()} Sapiens Telco · Gestión de flota
        </p>
      </div>
    </div>
  )
}
