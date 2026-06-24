import React from 'react'
import { Loader2 } from 'lucide-react'
import { ThemeProvider } from './state/ThemeContext'
import { ToastProvider } from './state/toast'
import { NetworkProvider } from './state/NetworkContext'
import { AuthProvider, useAuth } from './state/AuthContext'
import { AppProvider, useApp } from './state/AppContext'
import { OrgProvider, useOrg } from './state/OrgContext'
import { BrandProvider } from './state/BrandContext'
import { PlanProvider, usePlan } from './state/PlanContext'
import { WhatsAppProvider } from './state/whatsapp'
import { MensatekProvider } from './state/mensatek'
import { SchedulesProvider } from './state/schedules'
import AuthScreens from './components/onboarding/AuthScreens'
import CreateOrgWizard from './components/onboarding/CreateOrgWizard'
import SubscriptionGate from './components/billing/SubscriptionGate'
import ConnectScreen from './components/onboarding/ConnectScreen'
import DashboardLayout from './components/layout/DashboardLayout'
import NativeBridge from './native/NativeBridge'
import AppLock from './components/common/AppLock'

class ErrorBoundary extends React.Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app px-6 text-center">
          <p className="text-lg font-semibold text-fg">Algo salió mal</p>
          <p className="text-sm text-muted">{this.state.error?.message || 'Error inesperado'}</p>
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white" onClick={() => { this.setState({ error: null }); window.location.reload() }}>
            Recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

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
                    <SchedulesProvider>
                      <Root />
                    </SchedulesProvider>
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
      <ErrorBoundary>
        <NativeBridge />
        <ToastProvider>
          <NetworkProvider>
            <AuthProvider>
              <AuthGate />
            </AuthProvider>
          </NetworkProvider>
        </ToastProvider>
        <AppLock />
      </ErrorBoundary>
    </ThemeProvider>
  )
}
