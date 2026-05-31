import { useEffect } from 'react'
import { useApp } from '../state/AppContext'
import { isNative } from './platform'
import { pushBackHandler } from './backStack'

// Manejador base del botón atrás dentro del panel: si no estamos en "Inicio", vuelve
// a Inicio; si ya estamos, no consume el evento (el shell global saldrá de la app).
// Se registra al fondo de la pila, así las hojas/drawers (que se registran después)
// tienen prioridad.
export function useNativeBackToDashboard() {
  const { activeNav, setActiveNav } = useApp()
  useEffect(() => {
    if (!isNative) return undefined
    return pushBackHandler(() => {
      if (activeNav !== 'dashboard') {
        setActiveNav('dashboard')
        return true
      }
      return false
    })
  }, [activeNav, setActiveNav])
}
