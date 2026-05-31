import ThemeToggle from '../common/ThemeToggle'
import Logo from '../common/Logo'

// Marco visual común de las pantallas sin sesión (login, registro, confirmación,
// crear empresa): halos del color de marca, patrón de puntos, logo y toggle de tema.
export default function AuthShell({ children, subtitle = 'Centro de control de flota', maxWidth = 'max-w-md' }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(55% 45% at 50% 0%, rgb(var(--c-accent) / 0.20), transparent 70%), radial-gradient(45% 45% at 85% 100%, rgb(var(--c-accent) / 0.12), transparent 72%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.08]"
        style={{ backgroundImage: 'radial-gradient(rgb(var(--c-fg)) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />
      <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10">
        <ThemeToggle />
      </div>

      <div className={`relative w-full ${maxWidth} animate-fade-in`}>
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="h-[88px] w-auto" />
          {subtitle && <p className="mt-4 text-sm text-muted">{subtitle}</p>}
        </div>
        {children}
        <p className="mt-6 text-center text-[11px] text-faint">
          © {new Date().getFullYear()} Sapiens Telco · Gestión de flota
        </p>
      </div>
    </div>
  )
}
