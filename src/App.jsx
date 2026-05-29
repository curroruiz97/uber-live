import { Loader2 } from 'lucide-react'
import { ThemeProvider } from './state/ThemeContext'
import { ToastProvider } from './state/toast'
import { AuthProvider, useAuth } from './state/AuthContext'
import { AppProvider, useApp } from './state/AppContext'
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
    <AppProvider>
      <WhatsAppProvider>
        <MensatekProvider>
          <Root />
        </MensatekProvider>
      </WhatsAppProvider>
    </AppProvider>
  )
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
