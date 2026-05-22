import { Zap } from 'lucide-react'
import MetaConfigBlock from './MetaConfigBlock'
import QrConnectBlock from './QrConnectBlock'
import QuickTemplatesBlock from './QuickTemplatesBlock'
import SentMessagesPanel from './SentMessagesPanel'

export default function WhatsAppView() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
        <Zap className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>Estado.</strong> Los botones de la tabla y el mapa abren{' '}
          <span className="font-mono">wa.me</span> directamente (funciona ya). La conexión por QR
          (Bloque B) usa un backend <strong>real</strong> de{' '}
          <span className="font-mono">whatsapp-web.js</span>: el QR es real y escaneable. El envío vía
          Meta Cloud API (Bloque A) y el envío masivo siguen siendo UI <strong>simulada</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <MetaConfigBlock />
        <QrConnectBlock />
      </div>

      <QuickTemplatesBlock />
      <SentMessagesPanel />
    </div>
  )
}
