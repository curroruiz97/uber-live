import { WifiOff } from 'lucide-react'
import { useNetwork } from '../../state/NetworkContext'

// Banda fina y clara cuando no hay conexión. Se ancla bajo la cabecera y deja sitio
// a la safe area lateral. Los datos en pantalla son el último snapshot cacheado.
export default function OfflineBanner() {
  const { online } = useNetwork()
  if (online) return null
  return (
    <div className="flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
      <WifiOff className="h-3.5 w-3.5" />
      Sin conexión · mostrando los últimos datos
    </div>
  )
}
