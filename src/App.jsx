import { Loader2 } from 'lucide-react'
import { ThemeProvider } from './state/ThemeContext'
import { ToastProvider } from './state/toast'
import { AuthProvider, useAuth } from './state/AuthContext'
import { AppProvider, useApp } from './state/AppContext'
import { OrgProvider, useOrg } from './state/OrgContext'
import { BrandProvider } from './state/BrandContext'
import { PlanProvider, usePlan } from './state/PlanContext'
import { WhatsAppProvider } from './state/whatsapp'
import { MensatekProvider } from './state/mensatek'
import AuthScreens from './components/onboarding/AuthScreens'
import CreateOrgWizard from './components/onboarding/CreateOrgWizard'
import SubscriptionGate from './components/billing/SubscriptionGate'
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
  if (!session) return <AuthScreens />

  return (
    <OrgProvider>
      <OrgGate>
        <BrandProvider>
          <PlanProvider>
            <PlanGate>
              <AppProvider>
                <WhatsAppProvider>
                  <MensatekProvider>
                    <Root />
                  </MensatekProvider>
                </WhatsAppProvider>
              </AppProvider>
            </PlanGate>
          </PlanProvider>
        </BrandProvider>
      </OrgGate>
    </OrgProvider>
  )
}

// Gate de organización: espera a cargar las orgs del usuario. Si no tiene ninguna,
// muestra el asistente de creación de empresa (alta autoservicio).
function OrgGate({ children }) {
  const { loading, hasOrg } = useOrg()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }
  if (!hasOrg) return <CreateOrgWizard />
  return children
}

// Gate de suscripción: bloquea la app si el plan no está activo (past_due/canceled).
function PlanGate({ children }) {
  const { loading, isBlocked } = usePlan()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }
  if (isBlocked) return <SubscriptionGate />
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
