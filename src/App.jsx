import { ThemeProvider } from './state/ThemeContext'
import { ToastProvider } from './state/toast'
import { AppProvider, useApp } from './state/AppContext'
import { WhatsAppProvider } from './state/whatsapp'
import ConnectScreen from './components/onboarding/ConnectScreen'
import DashboardLayout from './components/layout/DashboardLayout'

function Root() {
  const { connected } = useApp()
  return connected ? <DashboardLayout /> : <ConnectScreen />
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppProvider>
          <WhatsAppProvider>
            <Root />
          </WhatsAppProvider>
        </AppProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
