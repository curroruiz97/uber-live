import { useState } from 'react'
import LoginScreen from './LoginScreen'
import SignupScreen from './SignupScreen'
import CheckEmailNotice from './CheckEmailNotice'

// Orquesta las pantallas sin sesión: login ⇄ registro ⇄ confirmación de email.
export default function AuthScreens() {
  const [mode, setMode] = useState('login')
  const [pendingEmail, setPendingEmail] = useState('')

  if (mode === 'signup') {
    return (
      <SignupScreen
        onLogin={() => setMode('login')}
        onCheckEmail={(email) => {
          setPendingEmail(email)
          setMode('check')
        }}
      />
    )
  }
  if (mode === 'check') {
    return <CheckEmailNotice email={pendingEmail} onBack={() => setMode('login')} />
  }
  return <LoginScreen onSignup={() => setMode('signup')} />
}
