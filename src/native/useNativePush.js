import { useEffect } from 'react'
import { useApp } from '../state/AppContext'
import { useToast } from '../state/toast'
import { isNative } from './platform'
import { enablePush } from './push'

// Conecta las push notifications con la UI: pide permiso (en el primer acceso al
// panel, no al arrancar), muestra un toast en primer plano y navega al tocar la
// notificación si trae `data.route` (p. ej. 'whatsapp', 'riders', 'mensatek').
export function useNativePush() {
  const { setActiveNav } = useApp()
  const { toast } = useToast()

  useEffect(() => {
    if (!isNative) return undefined
    let cleanup = () => {}
    enablePush({
      onForeground: (n) => {
        toast({ type: 'info', title: n?.title || 'Notificación', message: n?.body || '' })
      },
      onAction: (n) => {
        const route = n?.data?.route
        if (route) setActiveNav(route)
      },
    }).then((c) => {
      cleanup = c
    })
    return () => cleanup()
  }, [setActiveNav, toast])
}
