import { useState } from 'react'
import clsx from 'clsx'
import { Eye, EyeOff, Loader2, Plug, Zap, TriangleAlert, Lock, ChevronDown } from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { ENVIRONMENTS } from '../../config/constants'
import { validateConnection } from '../../api/validateConnection'
import ThemeToggle from '../common/ThemeToggle'
import Logo from '../common/Logo'

// Pistas accionables según el tipo de error que devuelve el proxy.
const ERROR_HINTS = {
  not_configured: 'Edita el archivo .env (UBER_CLIENT_SECRET y, si aplica, UBER_SCOPE) y reinicia npm run dev.',
  oauth: 'Uber rechazó las credenciales: revisa el client_secret y el scope en .env.',
  endpoint: 'Ruta no encontrada (404): ajusta UBER_DELIVERIES_PATH en .env a la ruta real del 3PL Consumer API.',
  network: 'Arranca el proxy local con npm run dev (sirve el SPA y el proxy juntos).',
  auth: 'Credenciales/token no autorizados (401/403).',
}

export default function ConnectScreen() {
  const { connectReal, connectDemo } = useApp()
  const [token, setToken] = useState('')
  const [environment, setEnvironment] = useState('sandbox')
  const [showToken, setShowToken] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)

  async function handleConnect(e) {
    e.preventDefault()
    setConnecting(true)
    setError(null)
    const res = await validateConnection({ environment, token: token.trim() || undefined })
    setConnecting(false)
    if (res.ok) connectReal({ environment, token: token.trim() })
    else setError(res)
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

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="mb-8">
          <Logo className="h-10 w-auto" />
          <p className="mt-2 text-xs text-faint">Centro de control de flota · 3PL Delivery</p>
        </div>

        <div className="rounded-2xl border border-line bg-panel p-6 shadow-soft">
          <h2 className="text-base font-semibold text-fg">Conectar con la API de Uber</h2>
          <p className="mt-1 text-sm text-muted">
            La autenticación (OAuth) la gestiona un proxy local con tus credenciales del{' '}
            <span className="font-mono text-xs">.env</span>. No hace falta pegar nada.
          </p>

          <form onSubmit={handleConnect} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Entorno</label>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-inset p-1">
                {Object.values(ENVIRONMENTS).map((env) => (
                  <button
                    type="button"
                    key={env.id}
                    onClick={() => setEnvironment(env.id)}
                    className={clsx(
                      'rounded-md px-3 py-2 text-sm font-medium transition',
                      environment === env.id ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg',
                    )}
                  >
                    {env.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Token manual: opcional / avanzado */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-faint transition hover:text-muted"
              >
                <ChevronDown className={clsx('h-3.5 w-3.5 transition', showAdvanced && 'rotate-180')} />
                Token manual (opcional)
              </button>
              {showAdvanced && (
                <div className="mt-2">
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Vacío = usa el client_secret del .env"
                      autoComplete="off"
                      className="w-full rounded-lg border border-line bg-inset py-2.5 pl-3 pr-10 text-sm text-fg placeholder-faint outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-faint transition hover:text-fg"
                      aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-faint">
                    Si ya tienes un access token, el proxy lo reenviará en vez de mintear uno.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p>{error.message}</p>
                  {ERROR_HINTS[error.kind] && (
                    <p className="mt-1 text-xs opacity-80">{ERROR_HINTS[error.kind]}</p>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={connecting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Validando conexión…
                </>
              ) : (
                <>
                  <Plug className="h-4 w-4" /> Conectar
                </>
              )}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-faint">
            <span className="h-px flex-1 bg-line" />
            o
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            onClick={connectDemo}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-inset py-2.5 text-sm font-medium text-fg transition hover:border-accent/40"
          >
            <Zap className="h-4 w-4 text-amber-500 dark:text-amber-400" /> Explorar en modo demo
          </button>
          <p className="mt-2 text-center text-xs text-faint">
            ~26 riders simulados en Valladolid y Madrid · sin credenciales
          </p>
        </div>

        <div className="mt-4 flex items-start gap-2 px-1 text-xs text-faint">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            El client_secret vive solo en el proxy local (.env), nunca en el navegador. El proxy evita
            el bloqueo CORS de Uber. Configúralo en{' '}
            <span className="font-mono">.env</span> antes de conectar.
          </p>
        </div>
      </div>
    </div>
  )
}
