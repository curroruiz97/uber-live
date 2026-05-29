import { Loader2 } from 'lucide-react'
import { ThemeProvider } from './state/ThemeContext'
import { ToastProvider } from './state/toast'
import { AuthProvider, useAuth } from './state/AuthContext'
import { AppProvider, useApp } from './state/AppContext'
import { OrgProvider, useOrg } from './state/OrgContext'
import { BrandProvider } from './state/BrandContext'
import { WhatsAppProvider } from './state/whatsapp'
import { MensatekProvider } from './state/mensatek'
import LoginScreen from './components/onboarding/LoginScreen'
import ConnectScreen from './components/onboarding/ConnectScreen'
import DashboardLayout from './components/layout/DashboardLayout'

function Root() {
  const { connected } = useApp()
  return connected ? <DashboardLayout /> : <ConnectScreen />
}

// Gate de autenticación: sin sesión -> login; con sesión -> la app del equipo.
function AuthGate() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }
  if (!session) return <LoginScreen />

  return (
    <OrgProvider>
      <OrgGate>
        <BrandProvider>
          <AppProvider>
            <WhatsAppProvider>
              <MensatekProvider>
                <Root />
              </MensatekProvider>
            </WhatsAppProvider>
          </AppProvider>
        </BrandProvider>
      </OrgGate>
    </OrgProvider>
  )
}

// Gate de organización: espera a cargar las orgs del usuario y exige tener al menos
// una. (El alta autoservicio / asistente de creación llega en una fase posterior.)
function OrgGate({ children }) {
  const { loading, hasOrg } = useOrg()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }
  if (!hasOrg) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-4">
        <div className="max-w-sm rounded-2xl border border-line bg-panel p-6 text-center shadow-soft">
          <h2 className="text-base font-semibold text-fg">Sin organización</h2>
          <p className="mt-2 text-sm text-muted">
            Tu cuenta todavía no pertenece a ninguna empresa. Pide a un administrador que te invite.
          </p>
        </div>
      </div>
    )
  }
  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
